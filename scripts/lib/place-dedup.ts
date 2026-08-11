/**
 * scripts/lib/place-dedup.ts
 *
 * Identity matching for places arriving from different sources.
 *
 * The saved-list sync keys on the Google Maps place path (`/g/…`); the Places
 * API only ever gives us a place id (`ChIJ…`). Those two never compare equal,
 * so a cafe reachable both ways would land twice. This module adds the missing
 * fallback: match on either stable key first, then on name similarity plus
 * physical proximity.
 */

import { haversineMeters } from "./geo";

export interface PlaceIdentity {
  name: string;
  lat: number;
  lng: number;
  googlePlaceId?: string | null;
  mapsPath?: string | null;
}

export interface ExistingPlace extends PlaceIdentity {
  id: string;
}

export interface MatchResult<T extends ExistingPlace> {
  place: T;
  /** Which rule matched. Useful for logging why something was skipped. */
  reason: "google_place_id" | "maps_path" | "name_and_proximity";
  meters?: number;
}

/** Words that carry no identifying weight for a Jakarta/Jogja cafe. */
const NOISE_WORDS = new Set([
  "cafe", "café", "kafe", "coffee", "kopi", "koffie", "roastery", "roasters",
  "roaster", "eatery", "kitchen", "resto", "restaurant", "bar", "house",
  "space", "studio", "co", "and", "the", "by", "at", "de", "di",
  "jakarta", "jkt", "yogyakarta", "jogja", "yogya", "indonesia",
]);

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(name: string): Set<string> {
  return new Set(
    normalizeName(name)
      .split(" ")
      .filter((t) => t.length > 1 && !NOISE_WORDS.has(t))
  );
}

/**
 * Name similarity in [0,1]: Jaccard over significant tokens, with a full match
 * when one name's tokens are a subset of the other's ("Kopikina" vs "Kopikina
 * Tebet"). Falls back to comparing full normalized names when a place's name is
 * nothing but noise words (e.g. "Coffee House").
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = significantTokens(a);
  const tb = significantTokens(b);

  if (ta.size === 0 || tb.size === 0) {
    const na = normalizeName(a);
    const nb = normalizeName(b);
    return na === nb ? 1 : 0;
  }

  const intersection = [...ta].filter((t) => tb.has(t)).length;
  if (intersection === Math.min(ta.size, tb.size)) return 1;

  const union = new Set([...ta, ...tb]).size;
  return intersection / union;
}

export interface DedupOptions {
  /** Max distance for a name match to count as the same place. */
  radiusMeters?: number;
  /** Min name similarity for a proximity match. */
  minNameSimilarity?: number;
}

/**
 * Find the existing row that represents the same physical place, or null.
 *
 * Checked in order of trust: exact Google place id, exact Maps path, then
 * name similarity within `radiusMeters`.
 */
export function findExistingPlace<T extends ExistingPlace>(
  rows: T[],
  candidate: PlaceIdentity,
  opts: DedupOptions = {}
): MatchResult<T> | null {
  const { radiusMeters = 120, minNameSimilarity = 0.6 } = opts;

  if (candidate.googlePlaceId) {
    const hit = rows.find((r) => r.googlePlaceId && r.googlePlaceId === candidate.googlePlaceId);
    if (hit) return { place: hit, reason: "google_place_id" };
  }

  if (candidate.mapsPath) {
    const hit = rows.find((r) => r.mapsPath && r.mapsPath === candidate.mapsPath);
    if (hit) return { place: hit, reason: "maps_path" };
  }

  let best: MatchResult<T> | null = null;

  for (const row of rows) {
    if (!row.lat || !row.lng || !candidate.lat || !candidate.lng) continue;

    const meters = haversineMeters(
      { lat: candidate.lat, lng: candidate.lng },
      { lat: row.lat, lng: row.lng }
    );
    if (meters > radiusMeters) continue;
    if (nameSimilarity(candidate.name, row.name) < minNameSimilarity) continue;

    if (!best || meters < best.meters!) {
      best = { place: row, reason: "name_and_proximity", meters: Math.round(meters) };
    }
  }

  return best;
}
