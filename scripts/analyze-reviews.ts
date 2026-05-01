#!/usr/bin/env bun
/**
 * scripts/analyze-reviews.ts
 *
 * Main review analysis pipeline for Curated.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=xxx OPENAI_API_KEY=yyy bun run scripts/analyze-reviews.ts
 *
 * Flags:
 *   --place <id>          Analyze a single place ID (default: all)
 *   --dry-run             Print analysis, don't write back to places.ts
 *   --no-llm              Skip the LLM pass (keyword-only, free)
 *   --confidence <0–1>    Min confidence to apply a suggested update (default: 0.6)
 *   --output <path>       Write full analysis JSON to a file (for inspection)
 *
 * What it does:
 *   1. Fetch reviews for each place via Google Places API
 *   2. Extract WFC signals per review (keyword + optional LLM pass)
 *   3. Aggregate signals with confidence weighting
 *   4. Compute trend windows and popularity metrics
 *   5. Suggest updates to wfc fields in places.ts
 *   6. Print a ranked "trending" list
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { places } from "../src/data/places";
import { batchExtractSignals } from "./lib/signal-extractor";
import { aggregateSignals, scoresToWfcUpdates } from "./lib/aggregator";
import { analyzeTrends, computePopularity, trendingScore } from "./lib/trend-analyzer";
import type { RawReview, PlaceAnalysis } from "../src/types/review";

// ─── Config ───────────────────────────────────────────────────────────────────

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const args = process.argv.slice(2);
const placeFilter = args[args.indexOf("--place") + 1] as string | undefined;
const isDryRun = args.includes("--dry-run");
const noLlm = args.includes("--no-llm");
const confidenceArg = args[args.indexOf("--confidence") + 1];
const minConfidence = confidenceArg ? parseFloat(confidenceArg) : 0.6;
const outputPath = args[args.indexOf("--output") + 1] as string | undefined;

if (!GOOGLE_KEY) {
  console.error("❌  GOOGLE_PLACES_API_KEY is required.");
  process.exit(1);
}

if (!OPENAI_KEY && !noLlm) {
  console.warn("⚠️  OPENAI_API_KEY not set — running keyword-only mode (--no-llm).");
}

const effectiveOpenaiKey = noLlm ? undefined : OPENAI_KEY;

// ─── Google Places review fetcher ─────────────────────────────────────────────

async function fetchReviews(googlePlaceId: string): Promise<RawReview[]> {
  const fields = "reviews";
  const url = `https://places.googleapis.com/v1/places/${googlePlaceId}`;

  const resp = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": GOOGLE_KEY!,
      "X-Goog-FieldMask": fields,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Google Places API ${resp.status}: ${body}`);
  }

  const data = await resp.json() as {
    reviews?: Array<{
      name: string;
      rating: number;
      text?: { text: string; languageCode?: string };
      publishTime?: string;
      authorAttribution?: { displayName: string };
    }>;
  };

  return (data.reviews ?? []).map((r, i) => ({
    reviewId: r.name ?? `${googlePlaceId}-${i}`,
    authorName: r.authorAttribution?.displayName ?? "Anonymous",
    rating: Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5,
    publishedAt: r.publishTime ?? new Date().toISOString(),
    text: r.text?.text ?? "",
    lang: r.text?.languageCode,
  }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const targetPlaces = placeFilter
  ? places.filter((p) => p.id === placeFilter || p.googlePlaceId === placeFilter)
  : places.filter((p) => p.googlePlaceId); // only places with a known Google ID

if (targetPlaces.length === 0) {
  console.error("❌  No places with googlePlaceId found. Run seed first.");
  process.exit(1);
}

console.log(`\n🔍  Analyzing ${targetPlaces.length} place(s)…`);
console.log(`    LLM pass: ${effectiveOpenaiKey ? "✓ enabled (gpt-4o-mini)" : "✗ keyword-only"}`);
console.log(`    Confidence threshold: ${minConfidence}\n`);

const allAnalyses: PlaceAnalysis[] = [];

for (const place of targetPlaces) {
  console.log(`\n📍  ${place.name} (${place.googlePlaceId})`);

  // 1. Fetch reviews
  let rawReviews: RawReview[] = [];
  try {
    rawReviews = await fetchReviews(place.googlePlaceId!);
    console.log(`   ${rawReviews.length} reviews fetched`);
  } catch (err) {
    console.warn(`   ⚠️  Failed to fetch reviews: ${err}`);
    continue;
  }

  if (rawReviews.length === 0) {
    console.log("   No reviews — skipping.");
    continue;
  }

  // Filter out reviews with no text (ratings-only)
  const textReviews = rawReviews.filter((r) => r.text.trim().length > 10);
  console.log(`   ${textReviews.length} reviews with text`);

  // 2. Extract signals
  const reviewSignals = await batchExtractSignals(
    textReviews,
    place.id,
    effectiveOpenaiKey,
    5
  );

  const signalCount = reviewSignals.reduce((n, rs) => n + rs.signals.length, 0);
  console.log(`   ${signalCount} signals extracted`);

  // 3. Aggregate
  const dimensionScores = aggregateSignals(reviewSignals);

  // 4. Trends + popularity
  const trends = analyzeTrends(reviewSignals);
  const popularity = computePopularity(reviewSignals);
  const trending = trendingScore(popularity);

  // 5. Suggested updates
  const suggestedUpdates = scoresToWfcUpdates(dimensionScores, minConfidence);
  const updateCount = Object.keys(suggestedUpdates).length;

  console.log(`   ${dimensionScores.length} dimension scores | ${updateCount} suggested updates`);
  console.log(`   Trending score: ${trending}/100 | Momentum: ${popularity.momentumRatio}×`);

  if (updateCount > 0) {
    console.log("   Suggested updates:");
    for (const [field, value] of Object.entries(suggestedUpdates)) {
      console.log(`     ${field}: ${JSON.stringify(value)}`);
    }
  }

  // Top dimension scores
  console.log("   Top signals:");
  for (const score of dimensionScores.slice(0, 5)) {
    const pct = Math.round(score.confidence * 100);
    console.log(
      `     ${score.dimension.padEnd(20)} → ${String(score.inferredValue).padEnd(12)} (${pct}% conf, ${score.mentionCount} mentions)`
    );
  }

  allAnalyses.push({
    placeId: place.id,
    analyzedAt: new Date().toISOString(),
    reviewCount: textReviews.length,
    dimensionScores,
    trends,
    popularity,
    suggestedUpdates,
  });
}

// ─── Trending leaderboard ─────────────────────────────────────────────────────

console.log("\n\n📊  Trending leaderboard");
console.log("─".repeat(60));

const ranked = allAnalyses
  .map((a) => ({
    placeId: a.placeId,
    name: places.find((p) => p.id === a.placeId)?.name ?? a.placeId,
    score: trendingScore(a.popularity),
    velocity: a.popularity.recentVelocity,
    rating: a.popularity.recentAvgRating,
    delta: a.popularity.ratingDelta,
    reviews: a.reviewCount,
  }))
  .sort((a, b) => b.score - a.score);

for (const [i, r] of ranked.entries()) {
  const trend = r.delta > 0.1 ? "↑" : r.delta < -0.1 ? "↓" : "→";
  console.log(
    `  ${String(i + 1).padStart(2)}. ${r.name.slice(0, 35).padEnd(36)} ${String(r.score).padStart(3)}/100  ${trend}  ★${r.rating}  ${r.velocity.toFixed(1)} rev/mo`
  );
}

// ─── Optional JSON output ─────────────────────────────────────────────────────

if (outputPath) {
  const dest = join(process.cwd(), outputPath);
  writeFileSync(dest, JSON.stringify(allAnalyses, null, 2), "utf-8");
  console.log(`\n💾  Full analysis written to ${dest}`);
}

if (isDryRun) {
  console.log("\n🏃  Dry run — no changes written.");
} else if (allAnalyses.some((a) => Object.keys(a.suggestedUpdates).length > 0)) {
  console.log(`
📝  To apply suggested updates, re-run with --apply (not yet implemented).
    Review the suggestions above and update src/data/places.ts manually,
    or integrate this output into your enrichment workflow.`);
}

console.log("\n✅  Done.\n");
