/**
 * scripts/lib/aggregator.ts
 *
 * Stage 2: aggregate per-review signals into a single DimensionScore per
 * WFC attribute, with Bayesian-style confidence weighting.
 *
 * Weighting model:
 *   - LLM signals outweigh keyword signals (1.5×)
 *   - High-confidence signals outweigh low (high=1.0, medium=0.7, low=0.4)
 *   - Recency weight: signals from last 90 days get a 1.3× boost
 *   - Rating alignment bonus: sentiment matches review star rating → +0.2
 *   - Minimum mention threshold before a dimension is included: 2 mentions
 *     (except prayer_room which is trusted from single mention)
 */

import type {
  ReviewSignals,
  WfcSignal,
  DimensionScore,
  Sentiment,
} from "../../src/types/review";

const CONFIDENCE_WEIGHT: Record<WfcSignal["confidence"], number> = {
  high: 1.0,
  medium: 0.7,
  low: 0.4,
};

const SOURCE_WEIGHT: Record<WfcSignal["source"], number> = {
  llm: 1.5,
  keyword: 1.0,
};

const RECENCY_CUTOFF_DAYS = 90;
const RECENCY_BOOST = 1.3;

// Dimensions that we trust from a single mention
const SINGLE_MENTION_DIMENSIONS: WfcSignal["dimension"][] = [
  "prayer_room",
  "time_limit",
  "wifi_available",
];

function isRecent(publishedAt: string): boolean {
  const reviewDate = new Date(publishedAt);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENCY_CUTOFF_DAYS);
  return reviewDate >= cutoff;
}

function ratingAlignedWithSentiment(
  sentiment: Sentiment,
  rating: number
): boolean {
  return (
    (sentiment === "positive" && rating >= 4) ||
    (sentiment === "negative" && rating <= 2) ||
    sentiment === "neutral"
  );
}

interface WeightedVote {
  value: string;
  weight: number;
  sentiment: Sentiment;
  evidence: string;
}

export function aggregateSignals(allReviewSignals: ReviewSignals[]): DimensionScore[] {
  // Group all signals by dimension
  const dimensionMap = new Map<
    WfcSignal["dimension"],
    { votes: WeightedVote[]; sentiments: Sentiment[] }
  >();

  for (const rs of allReviewSignals) {
    for (const signal of rs.signals) {
      if (!dimensionMap.has(signal.dimension)) {
        dimensionMap.set(signal.dimension, { votes: [], sentiments: [] });
      }
      const entry = dimensionMap.get(signal.dimension)!;

      let weight =
        CONFIDENCE_WEIGHT[signal.confidence] * SOURCE_WEIGHT[signal.source];

      // Recency boost
      if (isRecent(rs.publishedAt)) weight *= RECENCY_BOOST;

      // Rating alignment bonus
      if (ratingAlignedWithSentiment(signal.sentiment, rs.rating)) weight += 0.2;

      entry.votes.push({
        value: signal.value,
        weight,
        sentiment: signal.sentiment,
        evidence: signal.evidence,
      });
      entry.sentiments.push(signal.sentiment);
    }
  }

  const scores: DimensionScore[] = [];

  for (const [dimension, { votes, sentiments }] of dimensionMap.entries()) {
    const mentionCount = votes.length;

    // Skip weak signals unless they're high-trust dimensions
    const minMentions = SINGLE_MENTION_DIMENSIONS.includes(dimension) ? 1 : 2;
    if (mentionCount < minMentions) continue;

    // Weighted vote for best value
    const valueWeights = new Map<string, number>();
    for (const vote of votes) {
      valueWeights.set(
        vote.value,
        (valueWeights.get(vote.value) ?? 0) + vote.weight
      );
    }

    // Pick the highest-weighted value
    const inferredValue = [...valueWeights.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const totalWeight = [...valueWeights.values()].reduce((a, b) => a + b, 0);
    const winningWeight = valueWeights.get(inferredValue)!;

    // Confidence = proportion of weight supporting the winning value, capped at 0.95
    const confidence = Math.min(0.95, winningWeight / totalWeight);

    // Sentiment breakdown
    const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
    for (const s of sentiments) sentimentBreakdown[s]++;

    // Top evidence snippets (deduplicated, max 3)
    const topEvidence = [
      ...new Set(
        votes
          .filter((v) => v.value === inferredValue)
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 3)
          .map((v) => v.evidence)
      ),
    ];

    scores.push({
      dimension,
      inferredValue,
      confidence,
      mentionCount,
      sentimentBreakdown,
      topEvidence,
    });
  }

  // Sort by confidence desc
  return scores.sort((a, b) => b.confidence - a.confidence);
}

// ─── Map DimensionScores → Place wfc field suggestions ───────────────────────

export function scoresToWfcUpdates(
  scores: DimensionScore[],
  confidenceThreshold = 0.5
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  for (const score of scores) {
    if (score.confidence < confidenceThreshold) continue;

    switch (score.dimension) {
      case "wifi_available":
        updates["wfc.wifi.available"] = score.inferredValue === "true";
        break;
      case "wifi_speed":
        if (["fast", "moderate", "slow"].includes(score.inferredValue)) {
          updates["wfc.wifi.speed"] = score.inferredValue;
        }
        break;
      case "plugs":
        if (["ample", "limited", "none"].includes(score.inferredValue)) {
          updates["wfc.plugs"] = score.inferredValue;
        }
        break;
      case "noise":
        if (["quiet", "moderate", "loud"].includes(score.inferredValue)) {
          updates["wfc.noiseLevel"] = score.inferredValue;
        }
        break;
      case "seating_capacity":
        if (["large", "medium", "small"].includes(score.inferredValue)) {
          updates["wfc.seating.capacity"] = score.inferredValue;
        }
        break;
      case "time_limit":
        if (score.inferredValue === "true") {
          updates["wfc.seating.timeLimitDetected"] = true;
        }
        break;
      case "prayer_room":
        updates["wfc.prayerRoom"] = score.inferredValue !== "false";
        if (["basement", "small", "staff_only", "nearby_mosque"].includes(score.inferredValue)) {
          updates["wfc.prayerRoomNote"] = score.inferredValue;
        }
        break;
      case "parking":
        if (["free", "paid", "none"].includes(score.inferredValue)) {
          updates["wfc.parking"] = score.inferredValue;
        }
        break;
      case "food":
        if (score.inferredValue !== "poor") {
          updates["wfc.menu.food"] = true;
        }
        break;
      case "price":
        updates["wfc.menu.reviewedPriceSignal"] = score.inferredValue;
        break;
    }
  }

  return updates;
}
