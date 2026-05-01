/**
 * scripts/lib/trend-analyzer.ts
 *
 * Stage 3: temporal analysis of review streams.
 *
 * Produces:
 *   - TrendWindows: rolling 30d / 90d / older buckets with signal summaries
 *   - PopularityMetrics: review velocity, rating momentum, trending score
 *
 * Trending score formula (0–100):
 *   score = (recentVelocity / max(historicVelocity, 0.1)) * 30     // velocity momentum
 *         + (clamp(ratingDelta * 10, -20, 20) + 20)                 // rating direction
 *         + min(totalReviews / 50, 1) * 20                          // absolute size
 *         + (recentAvgRating / 5) * 30                              // absolute quality
 *   Clamped to [0, 100].
 */

import type { ReviewSignals, TrendWindow, PopularityMetrics } from "../../src/types/review";

const WINDOWS = [
  { label: "last_30d", days: 30 },
  { label: "last_90d", days: 90 },
  { label: "last_365d", days: 365 },
  { label: "older", days: Infinity },
] as const;

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Returns reviews published within [afterDate, beforeDate) */
function reviewsInWindow(
  reviews: ReviewSignals[],
  afterDate: Date,
  beforeDate: Date = new Date()
): ReviewSignals[] {
  return reviews.filter((r) => {
    const d = new Date(r.publishedAt);
    return d >= afterDate && d < beforeDate;
  });
}

/** Most frequent signal values across a set of reviews */
function topSignalValues(reviews: ReviewSignals[], limit = 5): string[] {
  const freq = new Map<string, number>();
  for (const r of reviews) {
    for (const s of r.signals) {
      const key = `${s.dimension}:${s.value}`;
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

export function analyzeTrends(reviews: ReviewSignals[]): TrendWindow[] {
  if (reviews.length === 0) return [];

  const sorted = [...reviews].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );

  const results: TrendWindow[] = [];
  let prevCutoff = new Date();

  for (const window of WINDOWS) {
    let inWindow: ReviewSignals[];

    if (window.days === Infinity) {
      // "older" = everything before last_365d
      const cutoff = daysAgo(365);
      inWindow = sorted.filter((r) => new Date(r.publishedAt) < cutoff);
    } else {
      const afterDate = daysAgo(window.days);
      // Exclude reviews already captured in a finer window
      inWindow = reviewsInWindow(sorted, afterDate, prevCutoff);
      prevCutoff = afterDate;
    }

    if (inWindow.length === 0) continue;

    const avgRating =
      inWindow.reduce((sum, r) => sum + r.rating, 0) / inWindow.length;

    results.push({
      label: window.label,
      reviewCount: inWindow.length,
      avgRating: Math.round(avgRating * 10) / 10,
      topSignals: topSignalValues(inWindow),
    });
  }

  return results;
}

export function computePopularity(reviews: ReviewSignals[]): PopularityMetrics {
  const total = reviews.length;
  if (total === 0) {
    return {
      totalReviews: 0,
      recentVelocity: 0,
      historicVelocity: 0,
      momentumRatio: 1,
      avgRating: 0,
      recentAvgRating: 0,
      ratingDelta: 0,
    };
  }

  const now = new Date();
  const recent90 = reviewsInWindow(reviews, daysAgo(90));

  // Monthly velocity
  const recentVelocity = recent90.length / 3; // 3 months

  // Find oldest review date for historic rate
  const oldest = reviews
    .map((r) => new Date(r.publishedAt))
    .reduce((a, b) => (a < b ? a : b));
  const totalMonths = Math.max(
    1,
    (now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  const historicVelocity = total / totalMonths;

  const momentumRatio =
    historicVelocity > 0 ? recentVelocity / historicVelocity : 1;

  const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / total;
  const recentAvgRating =
    recent90.length > 0
      ? recent90.reduce((s, r) => s + r.rating, 0) / recent90.length
      : avgRating;

  const ratingDelta = recentAvgRating - avgRating;

  return {
    totalReviews: total,
    recentVelocity: Math.round(recentVelocity * 10) / 10,
    historicVelocity: Math.round(historicVelocity * 10) / 10,
    momentumRatio: Math.round(momentumRatio * 100) / 100,
    avgRating: Math.round(avgRating * 10) / 10,
    recentAvgRating: Math.round(recentAvgRating * 10) / 10,
    ratingDelta: Math.round(ratingDelta * 100) / 100,
  };
}

/** Composite trending score 0–100 */
export function trendingScore(metrics: PopularityMetrics): number {
  const velocityScore = clamp((metrics.momentumRatio / 2) * 30, 0, 30);
  const ratingDirectionScore = clamp(metrics.ratingDelta * 10 + 20, 0, 40);
  const sizeScore = clamp((metrics.totalReviews / 100) * 10, 0, 10);
  const qualityScore = (metrics.recentAvgRating / 5) * 20;

  return Math.round(
    clamp(velocityScore + ratingDirectionScore + sizeScore + qualityScore, 0, 100)
  );
}
