/**
 * scripts/lib/places-api.ts
 *
 * Thin client for the Google Places API (New). Everything the discovery
 * pipeline needs in one place: paginated text search, place details with
 * reviews + amenities, and nearby search (used to find mosques/musholas
 * around a cafe).
 *
 * All calls go through `request()`, which retries on 429 / 5xx with
 * exponential backoff and counts calls so scripts can report API spend.
 */

import type { RawReview } from "../../src/types/review";
import { haversineMeters } from "./geo";

const BASE = "https://places.googleapis.com/v1";

// ─── Call accounting ──────────────────────────────────────────────────────────

const callCounts: Record<string, number> = {};

export function apiCallCounts(): Record<string, number> {
  return { ...callCounts };
}

export function totalApiCalls(): number {
  return Object.values(callCounts).reduce((a, b) => a + b, 0);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlacePhoto {
  name: string;
  widthPx?: number;
  heightPx?: number;
}

/** Subset of the Places API `Place` resource that the pipeline reads. */
export interface PlaceSummary {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  businessStatus?: string;
  primaryType?: string;
  types?: string[];
  photos?: PlacePhoto[];
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  websiteUri?: string;
  googleMapsUri?: string;
  editorialSummary?: { text?: string };
}

/** Amenity flags the Places API states as fact (no review inference needed). */
export interface PlaceAmenities {
  outdoorSeating?: boolean;
  restroom?: boolean;
  servesCoffee?: boolean;
  servesBreakfast?: boolean;
  servesLunch?: boolean;
  servesDinner?: boolean;
  servesBrunch?: boolean;
  dineIn?: boolean;
  reservable?: boolean;
  goodForGroups?: boolean;
  liveMusic?: boolean;
  parkingOptions?: {
    freeParkingLot?: boolean;
    paidParkingLot?: boolean;
    freeStreetParking?: boolean;
    paidStreetParking?: boolean;
    valetParking?: boolean;
    freeGarageParking?: boolean;
    paidGarageParking?: boolean;
  };
}

export interface PlaceDetails extends PlaceSummary, PlaceAmenities {
  reviews?: Array<{
    name?: string;
    rating?: number;
    text?: { text?: string; languageCode?: string };
    originalText?: { text?: string; languageCode?: string };
    publishTime?: string;
    authorAttribution?: { displayName?: string };
  }>;
}

export interface NearbyPoi {
  id: string;
  name: string;
  meters: number;
  primaryType?: string;
}

// ─── Field masks ──────────────────────────────────────────────────────────────

/** Cheap fields for the discovery sweep: one entry per search result. */
export const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.businessStatus",
  "places.primaryType",
  "places.types",
  "nextPageToken",
].join(",");

/** Full fields for the per-candidate enrichment pass (reviews + amenities). */
export const DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "shortFormattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "priceLevel",
  "businessStatus",
  "primaryType",
  "types",
  "photos",
  "regularOpeningHours",
  "websiteUri",
  "googleMapsUri",
  "editorialSummary",
  "reviews",
  "outdoorSeating",
  "restroom",
  "servesCoffee",
  "servesBreakfast",
  "servesLunch",
  "servesDinner",
  "servesBrunch",
  "dineIn",
  "reservable",
  "goodForGroups",
  "liveMusic",
  "parkingOptions",
].join(",");

// ─── Core request helper ──────────────────────────────────────────────────────

export class PlacesApiError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "PlacesApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Pull the human-readable reason out of a Google error payload. Worth the
 * effort: a mistyped field mask and a bad API key both surface as a 400, and
 * only this message tells them apart.
 */
function googleErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; status?: string } };
    const message = parsed.error?.message;
    if (message) return message;
  } catch {
    // Not JSON; fall through to the raw body.
  }
  return body.slice(0, 300).replace(/\s+/g, " ").trim() || "(empty response body)";
}

interface RequestOptions {
  apiKey: string;
  fieldMask: string;
  /** POST body; omit for GET (place details). */
  body?: unknown;
  /** Label used for call accounting, e.g. "searchText". */
  label: string;
  maxRetries?: number;
}

async function request<T>(path: string, opts: RequestOptions): Promise<T> {
  const { apiKey, fieldMask, body, label, maxRetries = 3 } = opts;
  callCounts[label] = (callCounts[label] ?? 0) + 1;

  let lastError: PlacesApiError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await Bun.sleep(500 * 2 ** (attempt - 1));

    const resp = await fetch(`${BASE}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (resp.ok) return (await resp.json()) as T;

    const text = await resp.text();
    lastError = new PlacesApiError(
      `Places API ${label} failed with ${resp.status}: ${googleErrorMessage(text)}`,
      resp.status,
      text
    );

    // Only 429 and 5xx are worth retrying; 4xx means the request is wrong.
    const retryable = resp.status === 429 || resp.status >= 500;
    if (!retryable) throw lastError;
  }

  throw lastError!;
}

// ─── Text search (paginated) ──────────────────────────────────────────────────

export interface TextSearchOptions {
  apiKey: string;
  query: string;
  lat: number;
  lng: number;
  /** Search radius in metres (locationRestriction circle). */
  radius: number;
  /** How many pages of 20 to pull. Google caps text search at 3 pages / 60. */
  maxPages?: number;
  languageCode?: string;
  regionCode?: string;
  /** Restrict to a single Places type, e.g. "cafe". */
  includedType?: string;
}

/**
 * Text search with `nextPageToken` pagination. Google's page tokens need a
 * short settle time before they resolve, hence the sleep between pages.
 */
export async function textSearchAll(opts: TextSearchOptions): Promise<PlaceSummary[]> {
  const {
    apiKey,
    query,
    lat,
    lng,
    radius,
    maxPages = 2,
    languageCode = "en",
    regionCode = "ID",
    includedType,
  } = opts;

  const results: PlaceSummary[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const body: Record<string, unknown> = {
      textQuery: query,
      pageSize: 20,
      languageCode,
      regionCode,
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius },
      },
    };
    if (includedType) body.includedType = includedType;
    if (pageToken) body.pageToken = pageToken;

    const data = await request<{ places?: PlaceSummary[]; nextPageToken?: string }>(
      "/places:searchText",
      { apiKey, fieldMask: SEARCH_FIELDS, body, label: "searchText" }
    );

    results.push(...(data.places ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;

    await Bun.sleep(400);
  }

  return results;
}

// ─── Place details ────────────────────────────────────────────────────────────

export async function placeDetails(
  apiKey: string,
  placeId: string,
  languageCode = "en"
): Promise<PlaceDetails> {
  return request<PlaceDetails>(
    `/places/${encodeURIComponent(placeId)}?languageCode=${languageCode}`,
    { apiKey, fieldMask: DETAIL_FIELDS, label: "placeDetails" }
  );
}

/** Normalize Places API reviews into the pipeline's RawReview shape. */
export function toRawReviews(details: PlaceDetails): RawReview[] {
  return (details.reviews ?? []).map((r, i) => {
    // Prefer originalText: Google's translated `text` loses Indonesian
    // phrasing that the keyword rules match on.
    const original = r.originalText?.text?.trim();
    const translated = r.text?.text?.trim();
    const text = original || translated || "";
    const lang = original ? r.originalText?.languageCode : r.text?.languageCode;

    return {
      reviewId: r.name ?? `${details.id}-${i}`,
      authorName: r.authorAttribution?.displayName ?? "Anonymous",
      rating: Math.min(5, Math.max(1, Math.round(r.rating ?? 3))) as 1 | 2 | 3 | 4 | 5,
      publishedAt: r.publishTime ?? new Date().toISOString(),
      text,
      lang,
    };
  });
}

// ─── Nearby search ────────────────────────────────────────────────────────────

export interface NearbySearchOptions {
  apiKey: string;
  lat: number;
  lng: number;
  radius: number;
  includedTypes: string[];
  maxResultCount?: number;
}

/** Nearby search ranked by distance, with distances computed client-side. */
export async function searchNearby(opts: NearbySearchOptions): Promise<NearbyPoi[]> {
  const { apiKey, lat, lng, radius, includedTypes, maxResultCount = 5 } = opts;

  const data = await request<{ places?: PlaceSummary[] }>("/places:searchNearby", {
    apiKey,
    fieldMask: "places.id,places.displayName,places.location,places.primaryType",
    label: "searchNearby",
    body: {
      includedTypes,
      maxResultCount,
      rankPreference: "DISTANCE",
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius },
      },
    },
  });

  return (data.places ?? [])
    .filter((p) => p.location)
    .map((p) => ({
      id: p.id,
      name: p.displayName?.text ?? "(unnamed)",
      primaryType: p.primaryType,
      meters: Math.round(
        haversineMeters(
          { lat, lng },
          { lat: p.location!.latitude, lng: p.location!.longitude }
        )
      ),
    }))
    .sort((a, b) => a.meters - b.meters);
}

/**
 * Find the closest place of worship around a cafe.
 *
 * Two probes, because Indonesian musholas are usually *not* tagged with the
 * "mosque" Places type:
 *   1. nearby search for type=mosque
 *   2. text search for "mushola" inside the same circle
 */
export async function findNearestPrayerSpace(
  apiKey: string,
  lat: number,
  lng: number,
  radius: number
): Promise<NearbyPoi | null> {
  const found: NearbyPoi[] = [];

  try {
    found.push(
      ...(await searchNearby({ apiKey, lat, lng, radius, includedTypes: ["mosque"] }))
    );
  } catch (err) {
    console.warn(`   ⚠️  mosque nearby-search failed: ${(err as Error).message}`);
  }

  try {
    const textHits = await textSearchAll({
      apiKey,
      query: "mushola",
      lat,
      lng,
      radius,
      maxPages: 1,
      languageCode: "id",
    });
    for (const p of textHits) {
      if (!p.location) continue;
      found.push({
        id: p.id,
        name: p.displayName?.text ?? "(unnamed)",
        primaryType: p.primaryType,
        meters: Math.round(
          haversineMeters(
            { lat, lng },
            { lat: p.location.latitude, lng: p.location.longitude }
          )
        ),
      });
    }
  } catch (err) {
    console.warn(`   ⚠️  mushola text-search failed: ${(err as Error).message}`);
  }

  if (found.length === 0) return null;
  return found.sort((a, b) => a.meters - b.meters)[0];
}

// ─── Misc mappers ─────────────────────────────────────────────────────────────

export function photoUrl(apiKey: string, photoName: string, maxWidth = 800): string {
  return `${BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;
}

export function mapPriceLevel(level?: string): 1 | 2 | 3 | 4 {
  const map: Record<string, 1 | 2 | 3 | 4> = {
    PRICE_LEVEL_FREE: 1,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[level ?? ""] ?? 2;
}
