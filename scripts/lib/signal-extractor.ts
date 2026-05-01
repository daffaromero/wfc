/**
 * scripts/lib/signal-extractor.ts
 *
 * Stage 1 of the pipeline: extract WFC signals from a single review.
 * Two passes:
 *   1. Keyword pass  — fast, free, deterministic bilingual regex matching
 *   2. LLM pass      — semantic extraction via OpenAI structured output
 *                      (skipped if OPENAI_API_KEY is not set)
 *
 * The LLM pass catches:
 *   - Implied negations ("struggled to find somewhere to charge")
 *   - Nuanced sentiment ("wifi is decent for Instagram but not for uploads")
 *   - Novel phrasing not yet in the keyword rules
 */

import type { RawReview, ReviewSignals, WfcSignal, Sentiment } from "../../src/types/review";
import { ALL_RULES } from "./keywords";

// ─── Keyword pass ─────────────────────────────────────────────────────────────

function extractSnippet(text: string, match: RegExpMatchArray, window = 60): string {
  const start = Math.max(0, (match.index ?? 0) - 20);
  const end = Math.min(text.length, start + window);
  return text.slice(start, end).trim();
}

function keywordExtract(review: RawReview): WfcSignal[] {
  const lower = review.text.toLowerCase();
  const signals: WfcSignal[] = [];

  for (const rule of ALL_RULES) {
    const match = lower.match(rule.pattern);
    if (!match) continue;
    if (rule.negate && rule.negate.test(lower)) continue;

    // Boost confidence when rating aligns with sentiment
    const ratingPositive = review.rating >= 4;
    const ratingNegative = review.rating <= 2;
    const sentimentAligned =
      (rule.sentiment === "positive" && ratingPositive) ||
      (rule.sentiment === "negative" && ratingNegative) ||
      rule.sentiment === "neutral";

    signals.push({
      dimension: rule.dimension,
      value: rule.value,
      sentiment: rule.sentiment,
      confidence: sentimentAligned ? "medium" : "low",
      evidence: extractSnippet(review.text, match),
      source: "keyword",
    });
  }

  return signals;
}

// ─── LLM pass ─────────────────────────────────────────────────────────────────

const LLM_SYSTEM = `You are an expert at extracting work-from-cafe (WFC) signals from cafe reviews.
Reviews may be in Indonesian or English. Extract structured signals about:
- wifi_speed: "fast" | "moderate" | "slow" | null
- wifi_available: true | false | null
- plugs: "ample" | "limited" | "none" | null
- noise: "quiet" | "moderate" | "loud" | null
- seating_capacity: "large" | "medium" | "small" | null
- time_limit: true | false | null  (is there a maximum stay time?)
- prayer_room: true | false | "basement" | "small" | "staff_only" | "nearby_mosque" | null
- parking: "free" | "paid" | "none" | null
- food: "good" | "poor" | "available" | null
- price: "budget" | "mid" | "expensive" | null
- crowdedness: "crowded" | "moderate" | "empty" | null

For each non-null signal include:
- value: the extracted value
- sentiment: "positive" | "neutral" | "negative"
- confidence: "low" | "medium" | "high"
- evidence: the exact excerpt from the review (max 80 chars) that supports this

Return ONLY valid JSON in this format:
{
  "overallSentiment": "positive" | "neutral" | "negative",
  "signals": [
    { "dimension": "...", "value": "...", "sentiment": "...", "confidence": "...", "evidence": "..." }
  ]
}`;

interface LlmResponse {
  overallSentiment: Sentiment;
  signals: Array<{
    dimension: WfcSignal["dimension"];
    value: string;
    sentiment: Sentiment;
    confidence: WfcSignal["confidence"];
    evidence: string;
  }>;
}

async function llmExtract(
  review: RawReview,
  apiKey: string
): Promise<{ overallSentiment: Sentiment; signals: WfcSignal[] } | null> {
  const prompt = `Review (rating: ${review.rating}/5, date: ${review.publishedAt.slice(0, 10)}):
"${review.text}"`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: LLM_SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!resp.ok) {
      console.warn(`  ⚠️  OpenAI error ${resp.status} for review ${review.reviewId}`);
      return null;
    }

    const data = await resp.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const parsed: LlmResponse = JSON.parse(data.choices[0].message.content);

    return {
      overallSentiment: parsed.overallSentiment,
      signals: parsed.signals.map((s) => ({ ...s, source: "llm" as const })),
    };
  } catch (err) {
    console.warn(`  ⚠️  LLM extraction failed for review ${review.reviewId}:`, err);
    return null;
  }
}

// ─── Naive sentiment from rating (fallback) ───────────────────────────────────

function sentimentFromRating(rating: number): Sentiment {
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
}

// ─── Dedup: prefer LLM signals over keyword for the same dimension ────────────

function mergeSignals(keyword: WfcSignal[], llm: WfcSignal[]): WfcSignal[] {
  const llmDimensions = new Set(llm.map((s) => s.dimension));
  // Keep keyword signals only for dimensions the LLM didn't cover
  const filteredKeyword = keyword.filter((s) => !llmDimensions.has(s.dimension));
  return [...llm, ...filteredKeyword];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function extractSignals(
  review: RawReview,
  placeId: string,
  openaiKey?: string
): Promise<ReviewSignals> {
  const kwSignals = keywordExtract(review);

  let overallSentiment: Sentiment = sentimentFromRating(review.rating);
  let finalSignals = kwSignals;

  if (openaiKey && review.text.length > 20) {
    const llmResult = await llmExtract(review, openaiKey);
    if (llmResult) {
      overallSentiment = llmResult.overallSentiment;
      finalSignals = mergeSignals(kwSignals, llmResult.signals);
    }
  }

  return {
    reviewId: review.reviewId,
    placeId,
    rating: review.rating,
    publishedAt: review.publishedAt,
    overallSentiment,
    signals: finalSignals,
  };
}

/** Batch-extract with optional rate limiting for the LLM pass */
export async function batchExtractSignals(
  reviews: RawReview[],
  placeId: string,
  openaiKey?: string,
  concurrency = 5
): Promise<ReviewSignals[]> {
  const results: ReviewSignals[] = [];

  for (let i = 0; i < reviews.length; i += concurrency) {
    const batch = reviews.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((r) => extractSignals(r, placeId, openaiKey))
    );
    results.push(...batchResults);

    // Polite delay between LLM batches
    if (openaiKey && i + concurrency < reviews.length) {
      await Bun.sleep(200);
    }
  }

  return results;
}
