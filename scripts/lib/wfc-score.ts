/**
 * scripts/lib/wfc-score.ts
 *
 * Stage 3: turn aggregated review DimensionScores (plus the amenity flags the
 * Places API states outright) into a single WFC verdict per cafe.
 *
 * Scoring is deliberately *coverage-aware*: a cafe whose reviews only ever
 * mention wifi does not get a 20/100 for staying silent about plugs. Instead
 * the score is normalized over the dimensions we actually have evidence for,
 * and `coverage` reports how much of the rubric that evidence covers. A high
 * score with low coverage is a guess, and the report says so.
 */

import type { DimensionScore, WfcSignal } from "../../src/types/review";
import type { NearbyPoi, PlaceAmenities } from "./places-api";

// ─── Rubric ───────────────────────────────────────────────────────────────────

type Dimension = WfcSignal["dimension"];

interface Rubric {
  /** Weight of this dimension in the 100-point rubric. */
  weight: number;
  /** Fraction of `weight` earned per inferred value (0-1). */
  values: Record<string, number>;
  label: string;
}

const RUBRIC: Partial<Record<Dimension, Rubric>> = {
  wifi_available: {
    weight: 10,
    label: "WiFi present",
    values: { true: 1, false: 0 },
  },
  wifi_speed: {
    weight: 20,
    label: "WiFi speed",
    values: { fast: 1, moderate: 0.6, slow: 0.1 },
  },
  plugs: {
    weight: 20,
    label: "Power outlets",
    values: { ample: 1, limited: 0.5, none: 0 },
  },
  noise: {
    weight: 20,
    label: "Noise",
    values: { quiet: 1, moderate: 0.6, loud: 0.1 },
  },
  seating_capacity: {
    weight: 10,
    label: "Seating",
    values: { large: 1, medium: 0.7, small: 0.3 },
  },
  time_limit: {
    weight: 10,
    label: "Time limit",
    values: { false: 1, true: 0.15 },
  },
  food: {
    weight: 5,
    label: "Food",
    values: { good: 1, available: 0.8, poor: 0.2 },
  },
  parking: {
    weight: 5,
    label: "Parking",
    values: { free: 1, paid: 0.6, none: 0.2 },
  },
};

const RUBRIC_TOTAL = Object.values(RUBRIC).reduce((n, r) => n + r!.weight, 0);

// ─── Public types ─────────────────────────────────────────────────────────────

export type EvidenceSource = "reviews" | "places_api" | "assumed";

export interface DimensionVerdict {
  dimension: Dimension;
  label: string;
  value: string;
  /** 0-1 confidence in `value`. */
  confidence: number;
  mentions: number;
  source: EvidenceSource;
  points: number;
  maxPoints: number;
  evidence: string[];
}

export type PrayerRoomStatus = "onsite" | "nearby" | "absent" | "unknown";

export interface PrayerRoomVerdict {
  status: PrayerRoomStatus;
  /** 0-1 confidence in `status`. */
  confidence: number;
  /** Short qualifier when reviews describe the room, e.g. "small", "basement". */
  note?: string;
  source: EvidenceSource;
  mentions: number;
  evidence: string[];
  nearest?: NearbyPoi;
}

export type WfcVerdictLabel = "great" | "good" | "maybe" | "poor" | "unknown";

export interface WfcVerdict {
  /** 0-100, normalized over the dimensions with evidence. */
  score: number;
  /** 0-1: share of the 100-point rubric backed by evidence. */
  coverage: number;
  label: WfcVerdictLabel;
  dimensions: DimensionVerdict[];
  prayerRoom: PrayerRoomVerdict;
  /** Human-readable notes about what drove or limited the score. */
  reasons: string[];
}

// ─── Amenity flags → dimension evidence ───────────────────────────────────────

/**
 * The Places API states some things as fact. Use them for dimensions the
 * reviews were silent on: stated fact beats no evidence, but review evidence
 * beats stated fact (reviews know "the free lot is always full").
 */
function amenityDimensions(amenities: PlaceAmenities): Array<{
  dimension: Dimension;
  value: string;
  evidence: string;
}> {
  const out: Array<{ dimension: Dimension; value: string; evidence: string }> = [];
  const p = amenities.parkingOptions;

  if (p) {
    const free = p.freeParkingLot || p.freeStreetParking || p.freeGarageParking;
    const paid = p.paidParkingLot || p.paidStreetParking || p.paidGarageParking;
    if (free) out.push({ dimension: "parking", value: "free", evidence: "Places API: free parking" });
    else if (paid) out.push({ dimension: "parking", value: "paid", evidence: "Places API: paid parking" });
  }

  const servesFood =
    amenities.servesLunch ||
    amenities.servesDinner ||
    amenities.servesBreakfast ||
    amenities.servesBrunch;
  if (servesFood) {
    out.push({ dimension: "food", value: "available", evidence: "Places API: serves meals" });
  }

  return out;
}

/** Confidence assigned to a Places API amenity flag. */
const AMENITY_CONFIDENCE = 0.7;

// ─── Prayer room ──────────────────────────────────────────────────────────────

/** Review values that describe an on-site room rather than its absence. */
const ONSITE_VALUES = new Set(["true", "small", "basement", "staff_only"]);
const NOTE_VALUES = new Set(["small", "basement", "staff_only"]);

export interface PrayerRoomInput {
  /** The aggregated `prayer_room` score, if reviews mentioned one. */
  score?: DimensionScore;
  /** Closest mosque/mushola found via nearby search, if that probe ran. */
  nearest?: NearbyPoi | null;
  /** Distance under which a separate mosque counts as "nearby". */
  nearbyRadiusMeters: number;
}

export function judgePrayerRoom(input: PrayerRoomInput): PrayerRoomVerdict {
  const { score, nearest, nearbyRadiusMeters } = input;

  if (score) {
    const value = score.inferredValue;

    if (ONSITE_VALUES.has(value)) {
      return {
        status: "onsite",
        confidence: score.confidence,
        note: NOTE_VALUES.has(value) ? value : undefined,
        source: "reviews",
        mentions: score.mentionCount,
        evidence: score.topEvidence,
        nearest: nearest ?? undefined,
      };
    }

    if (value === "nearby_mosque") {
      return {
        status: "nearby",
        confidence: score.confidence,
        source: "reviews",
        mentions: score.mentionCount,
        evidence: score.topEvidence,
        nearest: nearest ?? undefined,
      };
    }

    if (value === "false") {
      return {
        status: "absent",
        confidence: score.confidence,
        source: "reviews",
        mentions: score.mentionCount,
        evidence: score.topEvidence,
        nearest: nearest ?? undefined,
      };
    }
  }

  // No review evidence: fall back to proximity. A mosque 80m away is a real
  // answer to "can I pray here", but it is not an on-site mushola.
  if (nearest && nearest.meters <= nearbyRadiusMeters) {
    return {
      status: "nearby",
      // Closer is more useful; taper confidence with distance.
      confidence: Math.max(0.4, 0.8 - nearest.meters / (nearbyRadiusMeters * 2)),
      source: "places_api",
      mentions: 0,
      evidence: [`${nearest.name}, ${nearest.meters}m away`],
      nearest,
    };
  }

  return {
    status: "unknown",
    confidence: 0,
    source: "assumed",
    mentions: 0,
    evidence: [],
    nearest: nearest ?? undefined,
  };
}

// ─── Verdict ──────────────────────────────────────────────────────────────────

function labelFor(score: number, coverage: number): WfcVerdictLabel {
  // Too little evidence to call it either way.
  if (coverage < 0.35) return "unknown";
  if (score >= 80) return "great";
  if (score >= 62) return "good";
  if (score >= 42) return "maybe";
  return "poor";
}

export interface ScoreOptions {
  /** Minimum aggregated confidence for a review dimension to count. */
  minConfidence?: number;
  amenities?: PlaceAmenities;
  /**
   * Prayer-room inputs. `score` is optional: when omitted, the `prayer_room`
   * entry is taken from `dimensionScores`.
   */
  prayerRoom: PrayerRoomInput;
}

export function scoreWfc(
  dimensionScores: DimensionScore[],
  opts: ScoreOptions
): WfcVerdict {
  const { minConfidence = 0.5, amenities = {}, prayerRoom } = opts;

  const byDimension = new Map(dimensionScores.map((s) => [s.dimension, s]));
  const amenityEvidence = amenityDimensions(amenities);
  const verdicts: DimensionVerdict[] = [];
  const reasons: string[] = [];

  for (const [dim, rubric] of Object.entries(RUBRIC) as Array<[Dimension, Rubric]>) {
    const score = byDimension.get(dim);
    let value: string | undefined;
    let confidence = 0;
    let mentions = 0;
    let source: EvidenceSource = "reviews";
    let evidence: string[] = [];

    if (score && score.confidence >= minConfidence && rubric.values[score.inferredValue] !== undefined) {
      value = score.inferredValue;
      confidence = score.confidence;
      mentions = score.mentionCount;
      evidence = score.topEvidence;
    } else {
      const amenity = amenityEvidence.find((a) => a.dimension === dim);
      if (amenity && rubric.values[amenity.value] !== undefined) {
        value = amenity.value;
        confidence = AMENITY_CONFIDENCE;
        source = "places_api";
        evidence = [amenity.evidence];
      }
    }

    // Silence is not evidence: an unmentioned dimension is left out entirely
    // rather than defaulted, so it lowers coverage instead of moving the score.
    if (value === undefined) continue;

    const fraction = rubric.values[value] ?? 0;
    verdicts.push({
      dimension: dim,
      label: rubric.label,
      value,
      confidence: Number(confidence.toFixed(2)),
      mentions,
      source,
      points: Number((rubric.weight * fraction).toFixed(1)),
      maxPoints: rubric.weight,
      evidence,
    });
  }

  const earned = verdicts.reduce((n, v) => n + v.points, 0);
  const available = verdicts.reduce((n, v) => n + v.maxPoints, 0);

  const score = available > 0 ? Math.round((earned / available) * 100) : 0;
  const coverage = Number((available / RUBRIC_TOTAL).toFixed(2));
  const label = labelFor(score, coverage);

  // Explain the score: strongest and weakest evidenced dimensions, plus the
  // gaps, so a low-coverage verdict is never mistaken for a confident one.
  const ranked = [...verdicts].sort(
    (a, b) => b.points / b.maxPoints - a.points / a.maxPoints
  );

  if (ranked.length > 0) {
    const best = ranked[0];
    reasons.push(`${best.label}: ${best.value} (${best.mentions || "api"} evidence)`);
    const worst = ranked[ranked.length - 1];
    if (worst.dimension !== best.dimension && worst.points / worst.maxPoints < 0.5) {
      reasons.push(`weak point, ${worst.label}: ${worst.value}`);
    }
  }

  const missing = (Object.entries(RUBRIC) as Array<[Dimension, Rubric]>)
    .filter(([dim]) => !verdicts.some((v) => v.dimension === dim))
    .map(([, r]) => r.label);
  if (missing.length > 0) {
    reasons.push(`no evidence for: ${missing.join(", ")}`);
  }
  if (label === "unknown") {
    reasons.push(`coverage ${Math.round(coverage * 100)}%, too thin to rank; verify in person`);
  }

  return {
    score,
    coverage,
    label,
    dimensions: verdicts,
    prayerRoom: judgePrayerRoom({
      ...prayerRoom,
      score: prayerRoom.score ?? byDimension.get("prayer_room"),
    }),
    reasons,
  };
}

// ─── Verdict → DB columns ─────────────────────────────────────────────────────

export interface WfcColumnValues {
  wfcPlugs: string;
  wfcPrayerRoom: boolean;
  wfcNoiseLevel: string;
  wfcParking: string;
  wfcWifiAvailable: boolean;
  wfcWifiSpeed: string | null;
  wfcSeatingCapacity: string;
  wfcTimeLimitHours: number | null;
  wfcFood: boolean;
}

/**
 * Map a verdict onto the flat `places` columns. Only review/API-backed values
 * are used; assumed defaults fall back to the same neutral values that
 * sync-from-maps writes, so nothing is asserted that wasn't observed.
 */
export function verdictToColumns(verdict: WfcVerdict): WfcColumnValues {
  const pick = (dim: Dimension): DimensionVerdict | undefined =>
    verdict.dimensions.find((v) => v.dimension === dim);

  const wifiAvailable = pick("wifi_available");
  const wifiSpeed = pick("wifi_speed");
  const plugs = pick("plugs");
  const noise = pick("noise");
  const seating = pick("seating_capacity");
  const parking = pick("parking");
  const food = pick("food");

  return {
    wfcPlugs: plugs?.value ?? "limited",
    // Only an on-site room sets the boolean the UI filters on. "nearby" is a
    // different fact and belongs in the curator note, not this column.
    wfcPrayerRoom: verdict.prayerRoom.status === "onsite",
    wfcNoiseLevel: noise?.value ?? "moderate",
    wfcParking: parking?.value ?? "none",
    wfcWifiAvailable: wifiAvailable ? wifiAvailable.value === "true" : true,
    wfcWifiSpeed: wifiSpeed?.value ?? null,
    wfcSeatingCapacity: seating?.value ?? "medium",
    wfcTimeLimitHours: null,
    wfcFood: food ? food.value !== "poor" : false,
  };
}
