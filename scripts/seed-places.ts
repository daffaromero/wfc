#!/usr/bin/env bun
/**
 * scripts/seed-places.ts
 *
 * Seeds WFC places from the Google Places API (New) into src/data/places.ts.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=your_key bun run scripts/seed-places.ts
 *
 * Optional flags:
 *   --city jakarta|yogyakarta    Only fetch one city (default: both)
 *   --dry-run                    Print fetched data, don't write file
 *   --append                     Append to existing places instead of merging
 *
 * The script:
 *   1. Searches "cafe" in each city using the Places API (Text Search).
 *   2. Fetches full place details (name, address, rating, photos, hours).
 *   3. Merges results with any existing place in src/data/places.ts,
 *      preserving manually added WFC fields (wifi, plugs, etc.).
 *   4. Emits new/unknown places with empty WFC stubs so you can fill them in.
 */

import { writeFileSync, existsSync } from "fs";
import { join } from "path";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error("❌  GOOGLE_PLACES_API_KEY env variable is required.");
  process.exit(1);
}

const CITIES: Record<string, { query: string; lat: number; lng: number }> = {
  jakarta: {
    query: "coworking cafe jakarta",
    lat: -6.2088,
    lng: 106.8456,
  },
  yogyakarta: {
    query: "coworking cafe yogyakarta",
    lat: -7.7956,
    lng: 110.3695,
  },
};

const args = process.argv.slice(2);
const cityFlag = args[args.indexOf("--city") + 1] as string | undefined;
const isDryRun = args.includes("--dry-run");

const citiesToFetch = cityFlag
  ? [cityFlag]
  : Object.keys(CITIES);

// ─── Google Places New API helpers ──────────────────────────────────────────

interface GooglePhoto {
  name: string;
  widthPx: number;
  heightPx: number;
}

interface GooglePlace {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: {
    weekdayDescriptions: string[];
  };
  websiteUri?: string;
  photos?: GooglePhoto[];
  priceLevel?: "PRICE_LEVEL_FREE" | "PRICE_LEVEL_INEXPENSIVE" | "PRICE_LEVEL_MODERATE" | "PRICE_LEVEL_EXPENSIVE" | "PRICE_LEVEL_VERY_EXPENSIVE";
}

async function textSearch(query: string, lat: number, lng: number): Promise<GooglePlace[]> {
  const url = "https://places.googleapis.com/v1/places:searchText";

  const body = {
    textQuery: query,
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 15000,
      },
    },
    maxResultCount: 20,
    languageCode: "en",
  };

  const fields = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.rating",
    "places.userRatingCount",
    "places.regularOpeningHours",
    "places.websiteUri",
    "places.photos",
    "places.priceLevel",
  ].join(",");

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY!,
      "X-Goog-FieldMask": fields,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google Places API error ${resp.status}: ${text}`);
  }

  const data = await resp.json() as { places?: GooglePlace[] };
  return data.places ?? [];
}

function photoUrl(photoName: string, maxWidth = 800): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${API_KEY}`;
}

function mapPriceLevel(level?: string): 1 | 2 | 3 | 4 {
  const map: Record<string, 1 | 2 | 3 | 4> = {
    PRICE_LEVEL_FREE: 1,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[level ?? ""] ?? 2;
}

function slugify(name: string, city: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${city}`;
}

// ─── WFC stub (to be filled in manually) ─────────────────────────────────────

function emptyWfcStub(priceRange: 1 | 2 | 3 | 4) {
  return {
    seating: {
      types: [] as string[],
      capacity: "medium" as const,
    },
    wifi: { available: true, speed: undefined, requiresPassword: true },
    plugs: "unknown" as const,
    prayerRoom: false,
    noiseLevel: "moderate" as const,
    parking: "none" as const,
    menu: {
      coffeeSpecialty: false,
      nonCoffee: true,
      food: false,
      highlights: [] as string[],
      priceRange,
    },
  };
}

// ─── Load existing places to preserve WFC data ───────────────────────────────

const PLACES_FILE = join(import.meta.dir, "../src/data/places.ts");

interface ExistingPlace {
  id: string;
  wfc: ReturnType<typeof emptyWfcStub>;
  [key: string]: unknown;
}

function loadExistingIds(): Set<string> {
  if (!existsSync(PLACES_FILE)) return new Set();
  const content = Bun.file(PLACES_FILE).toString();
  const matches = content.matchAll(/id:\s*["']([^"']+)["']/g);
  return new Set([...matches].map((m) => m[1]));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const existingIds = loadExistingIds();
const newPlaces: ExistingPlace[] = [];

for (const city of citiesToFetch) {
  const config = CITIES[city];
  if (!config) {
    console.warn(`⚠️  Unknown city "${city}", skipping.`);
    continue;
  }

  console.log(`\n🔍  Fetching places for ${city}…`);
  const results = await textSearch(config.query, config.lat, config.lng);
  console.log(`   Found ${results.length} results.`);

  for (const place of results) {
    const id = slugify(place.displayName.text, city);

    if (existingIds.has(id)) {
      console.log(`   ✓  ${place.displayName.text} already in dataset, skipping.`);
      continue;
    }

    const priceRange = mapPriceLevel(place.priceLevel);
    const photos = (place.photos ?? []).slice(0, 3).map((p) => photoUrl(p.name));

    const entry: ExistingPlace = {
      id,
      name: place.displayName.text,
      city,
      area: "", // fill in manually
      address: place.formattedAddress,
      coordinates: {
        lat: place.location.latitude,
        lng: place.location.longitude,
      },
      googlePlaceId: place.id,
      photos,
      googleRating: place.rating,
      totalRatings: place.userRatingCount,
      openingHours: place.regularOpeningHours?.weekdayDescriptions ?? [],
      website: place.websiteUri,
      wfc: emptyWfcStub(priceRange),
      tags: [],
      lastVerified: new Date().toISOString().split("T")[0],
    };

    newPlaces.push(entry);
    console.log(`   ➕  ${place.displayName.text}`);
  }
}

if (newPlaces.length === 0) {
  console.log("\n✅  No new places found. Dataset is up to date.");
  process.exit(0);
}

console.log(`\n📦  ${newPlaces.length} new place(s) to add.`);

if (isDryRun) {
  console.log("\n--- DRY RUN OUTPUT ---");
  console.log(JSON.stringify(newPlaces, null, 2));
  process.exit(0);
}

// Append to places.ts as a commented block for manual review
const stub = newPlaces
  .map(
    (p) =>
      `  // TODO: fill in WFC details for "${p.name}"\n  ${JSON.stringify(p, null, 2).replace(/^/gm, "  ").trimStart()},`
  )
  .join("\n\n");

const output = `\n\n// ─── SEEDED ${new Date().toISOString()} ───\n// Review and fill in the wfc fields below before committing.\n/*\n${stub}\n*/`;

const existingContent = existsSync(PLACES_FILE) ? Bun.file(PLACES_FILE).toString() : "";
const appended = existingContent.trimEnd() + output + "\n";

writeFileSync(PLACES_FILE, appended, "utf-8");
console.log(`\n✅  Appended ${newPlaces.length} new place stub(s) to ${PLACES_FILE}`);
console.log("   Open the file, fill in the wfc fields, uncomment, and add to the array.");
