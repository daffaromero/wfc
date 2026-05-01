// ─── Raw review from Google Places API ───────────────────────────────────────

export interface RawReview {
  reviewId: string;
  authorName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  /** ISO 8601 datetime string */
  publishedAt: string;
  text: string;
  /** Detected language code, e.g. "id", "en" */
  lang?: string;
}

// ─── Signals extracted from a single review ──────────────────────────────────

export type SignalConfidence = "low" | "medium" | "high";
export type Sentiment = "positive" | "neutral" | "negative";

export interface WfcSignal {
  /** Which WFC attribute this signal is about */
  dimension:
    | "wifi_available"
    | "wifi_speed"
    | "plugs"
    | "noise"
    | "seating_capacity"
    | "time_limit"
    | "prayer_room"
    | "parking"
    | "food"
    | "price"
    | "crowdedness";
  /** The inferred value (matches Place schema where applicable) */
  value: string;
  sentiment: Sentiment;
  confidence: SignalConfidence;
  /** The exact review snippet that produced this signal */
  evidence: string;
  /** "keyword" = regex match, "llm" = model extraction */
  source: "keyword" | "llm";
}

export interface ReviewSignals {
  reviewId: string;
  placeId: string;
  rating: number;
  publishedAt: string;
  overallSentiment: Sentiment;
  signals: WfcSignal[];
}

// ─── Aggregated output across all reviews for a place ────────────────────────

export interface DimensionScore {
  dimension: WfcSignal["dimension"];
  /** Best-guess value */
  inferredValue: string;
  /** 0–1 confidence across all supporting signals */
  confidence: number;
  /** How many reviews mentioned this dimension */
  mentionCount: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  /** Sample evidence snippets */
  topEvidence: string[];
}

export interface TrendWindow {
  label: string; // e.g. "last_30d", "last_90d", "older"
  reviewCount: number;
  avgRating: number;
  topSignals: string[];
}

export interface PopularityMetrics {
  totalReviews: number;
  /** Reviews per month over the past 90 days */
  recentVelocity: number;
  /** Reviews per month over the full history */
  historicVelocity: number;
  /** Positive velocity ratio: recent vs historic (>1 = trending up) */
  momentumRatio: number;
  avgRating: number;
  recentAvgRating: number;
  /** Rating delta: recent - historic (positive = improving) */
  ratingDelta: number;
}

export interface PlaceAnalysis {
  placeId: string;
  analyzedAt: string;
  reviewCount: number;
  dimensionScores: DimensionScore[];
  trends: TrendWindow[];
  popularity: PopularityMetrics;
  /** Suggested updates to the Place's wfc fields, keyed by field path */
  suggestedUpdates: Record<string, unknown>;
}
