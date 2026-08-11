#!/usr/bin/env bun
/**
 * scripts/discover-cafes.ts
 *
 * Reads Google Maps for cafes, then interrogates each one for WFC-ability and
 * for a prayer room (mushola), and writes the survivors into curated.db.
 *
 * Pipeline:
 *   1. DISCOVER      Text search across an area grid per city, paginated past
 *                    Google's 20-result page cap. Cheap fields only.
 *   2. FILTER        Drop closed places, low-rated places, thin-review places,
 *                    and anything already in the DB (scripts/lib/place-dedup).
 *   3. INTERROGATE   Per survivor: full details (reviews + amenity flags), then
 *                    the existing signal pipeline (keyword + optional LLM) to
 *                    extract WiFi / plugs / noise / seating / time-limit /
 *                    prayer-room evidence. Also probes for a mosque or mushola
 *                    within --prayer-radius when reviews are silent.
 *   4. SCORE         Coverage-aware 0-100 WFC score + prayer-room verdict
 *                    (scripts/lib/wfc-score.ts).
 *   5. WRITE         Insert new rows into curated.db (never overwrites existing
 *                    hand-curated rows) and emit a JSON + markdown report.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=xxx [OPENAI_API_KEY=yyy] bun run scripts/discover-cafes.ts
 *
 * Flags:
 *   --city <jakarta|yogyakarta>  Only sweep one city (default: both)
 *   --area <name,name>           Only sweep named areas (see AREAS below)
 *   --pages <n>                  Search pages per query, 20 results each (default 2, max 3)
 *   --limit <n>                  Max candidates to interrogate (default 40)
 *   --min-rating <n>             Min Google rating to interrogate (default 4)
 *   --min-reviews <n>            Min review count to interrogate (default 25)
 *   --min-score <n>              Min WFC score to write to the DB (default 55)
 *   --prayer-radius <m>          Nearby mosque/mushola radius in metres (default 250)
 *   --confidence <0-1>           Min aggregated confidence per dimension (default 0.5)
 *   --no-llm                     Keyword-only signal extraction (free)
 *   --no-prayer-probe            Skip the nearby mosque/mushola search
 *   --dry-run                    Interrogate and report, write nothing
 *   --output <path>              Report path prefix (default reports/discovery-<date>)
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname, isAbsolute, join } from "path";
import { db } from "../server/db/client";
import { places as placesTable } from "../server/db/schema";
import { makeReadableId } from "../server/scripts/sync-from-maps";
import { batchExtractSignals } from "./lib/signal-extractor";
import { aggregateSignals } from "./lib/aggregator";
import { computePopularity, trendingScore } from "./lib/trend-analyzer";
import { findExistingPlace } from "./lib/place-dedup";
import { scoreWfc, verdictToColumns } from "./lib/wfc-score";
import {
  apiCallCounts,
  findNearestPrayerSpace,
  mapPriceLevel,
  photoUrl,
  placeDetails,
  textSearchAll,
  toRawReviews,
  totalApiCalls,
} from "./lib/places-api";
import type { PlaceDetails, PlaceSummary } from "./lib/places-api";
import type { WfcVerdict } from "./lib/wfc-score";

// ─── Area grid ────────────────────────────────────────────────────────────────

interface Area {
  name: string;
  city: "jakarta" | "yogyakarta";
  lat: number;
  lng: number;
  /** Search radius in metres. Tighter in dense areas to reduce overlap. */
  radius: number;
}

const AREAS: Area[] = [
  // ── Jakarta ──
  { name: "SCBD",           city: "jakarta", lat: -6.2255, lng: 106.8087, radius: 1500 },
  { name: "Senopati",       city: "jakarta", lat: -6.2372, lng: 106.8090, radius: 1500 },
  { name: "Kemang",         city: "jakarta", lat: -6.2607, lng: 106.8140, radius: 2000 },
  { name: "Tebet",          city: "jakarta", lat: -6.2354, lng: 106.8484, radius: 2000 },
  { name: "Menteng",        city: "jakarta", lat: -6.1960, lng: 106.8320, radius: 2000 },
  { name: "Kuningan",       city: "jakarta", lat: -6.2297, lng: 106.8296, radius: 1500 },
  { name: "Cilandak",       city: "jakarta", lat: -6.2860, lng: 106.7990, radius: 2500 },
  { name: "Pondok Indah",   city: "jakarta", lat: -6.2660, lng: 106.7830, radius: 2000 },
  { name: "Kelapa Gading",  city: "jakarta", lat: -6.1620, lng: 106.9060, radius: 2500 },
  { name: "PIK",            city: "jakarta", lat: -6.1080, lng: 106.7400, radius: 2500 },
  { name: "Bintaro",        city: "jakarta", lat: -6.2760, lng: 106.7150, radius: 2500 },
  { name: "BSD",            city: "jakarta", lat: -6.3020, lng: 106.6520, radius: 3000 },

  // ── Yogyakarta ──
  { name: "Kotabaru",       city: "yogyakarta", lat: -7.7830, lng: 110.3730, radius: 1500 },
  { name: "Prawirotaman",   city: "yogyakarta", lat: -7.8180, lng: 110.3670, radius: 1500 },
  { name: "Seturan",        city: "yogyakarta", lat: -7.7700, lng: 110.4030, radius: 2000 },
  { name: "Kaliurang",      city: "yogyakarta", lat: -7.7530, lng: 110.3790, radius: 2000 },
  { name: "Malioboro",      city: "yogyakarta", lat: -7.7930, lng: 110.3660, radius: 1500 },
  { name: "Condongcatur",   city: "yogyakarta", lat: -7.7550, lng: 110.4000, radius: 2000 },
];

/** Query variants. Different phrasings surface genuinely different results. */
const QUERIES = [
  "cafe wifi kerja laptop",
  "coffee shop work friendly",
  "cafe cozy nugas",
];

/** Places types that count as a cafe for our purposes. */
const CAFE_TYPES = new Set([
  "cafe",
  "coffee_shop",
  "bakery",
  "tea_house",
  "breakfast_restaurant",
  "brunch_restaurant",
]);

// ─── CLI ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function flag(name: string): boolean {
  return argv.includes(`--${name}`);
}

function value(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  return v && !v.startsWith("--") ? v : undefined;
}

function numArg(name: string, fallback: number): number {
  const raw = value(name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (Number.isNaN(n)) {
    console.error(`❌  --${name} expects a number, got "${raw}".`);
    process.exit(1);
  }
  return n;
}

const opts = {
  city: value("city") as "jakarta" | "yogyakarta" | undefined,
  areas: value("area")?.split(",").map((s) => s.trim().toLowerCase()),
  pages: Math.min(3, Math.max(1, numArg("pages", 2))),
  limit: numArg("limit", 40),
  minRating: numArg("min-rating", 4),
  minReviews: numArg("min-reviews", 25),
  minScore: numArg("min-score", 55),
  prayerRadius: numArg("prayer-radius", 250),
  confidence: numArg("confidence", 0.5),
  noLlm: flag("no-llm"),
  noPrayerProbe: flag("no-prayer-probe"),
  dryRun: flag("dry-run"),
  output: value("output"),
};

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!GOOGLE_KEY) {
  console.error("❌  GOOGLE_PLACES_API_KEY is required.");
  process.exit(1);
}

const OPENAI_KEY = opts.noLlm ? undefined : process.env.OPENAI_API_KEY;
if (!OPENAI_KEY && !opts.noLlm) {
  console.warn("⚠️  OPENAI_API_KEY not set, falling back to keyword-only extraction.\n");
}

if (opts.city && !["jakarta", "yogyakarta"].includes(opts.city)) {
  console.error(`❌  --city expects jakarta or yogyakarta, got "${opts.city}".`);
  process.exit(1);
}

const targetAreas = AREAS.filter((a) => {
  if (opts.city && a.city !== opts.city) return false;
  if (opts.areas && !opts.areas.includes(a.name.toLowerCase())) return false;
  return true;
});

if (targetAreas.length === 0) {
  console.error("❌  No areas matched. Known areas: " + AREAS.map((a) => a.name).join(", "));
  process.exit(1);
}

// ─── Report shape ─────────────────────────────────────────────────────────────

interface CandidateReport {
  name: string;
  googlePlaceId: string;
  city: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
  googleRating?: number;
  totalRatings?: number;
  mapsUrl?: string;
  reviewsAnalyzed: number;
  wfcScore: number;
  coverage: number;
  verdict: string;
  trendingScore: number;
  prayerRoom: WfcVerdict["prayerRoom"];
  dimensions: WfcVerdict["dimensions"];
  reasons: string[];
  /** What happened at write time. */
  action: "inserted" | "would-insert" | "below-threshold" | "duplicate" | "error";
  actionDetail?: string;
}

// ─── Stage 1: discover ────────────────────────────────────────────────────────

console.log(`\n🗺️   Discovering cafes across ${targetAreas.length} area(s)`);
console.log(`     Queries: ${QUERIES.length} × ${opts.pages} page(s) per area`);
console.log(`     LLM pass: ${OPENAI_KEY ? "✓ gpt-4o-mini" : "✗ keyword-only"}`);
console.log(`     Prayer probe: ${opts.noPrayerProbe ? "✗ off" : `✓ ${opts.prayerRadius}m`}`);
if (opts.dryRun) console.log("     (dry run, no DB writes)");
console.log("");

/** Discovered places keyed by Google place id, with the area they came from. */
const discovered = new Map<string, { place: PlaceSummary; area: Area }>();
const searchFailures: string[] = [];

for (const area of targetAreas) {
  let areaCount = 0;

  for (const query of QUERIES) {
    try {
      const results = await textSearchAll({
        apiKey: GOOGLE_KEY,
        query: `${query} ${area.name}`,
        lat: area.lat,
        lng: area.lng,
        radius: area.radius,
        maxPages: opts.pages,
        includedType: "cafe",
      });

      for (const place of results) {
        if (!place.id || discovered.has(place.id)) continue;
        discovered.set(place.id, { place, area });
        areaCount++;
      }
    } catch (err) {
      const message = (err as Error).message;
      searchFailures.push(`${area.name} / "${query}": ${message}`);
      console.warn(`   ⚠️  ${area.name} / "${query}" failed: ${message}`);
    }
  }

  console.log(`   ${area.name.padEnd(15)} +${areaCount} new`);
}

// Every search failing means the key, quota, or field mask is wrong, not that
// Jakarta has no cafes. Say so instead of writing an empty report.
if (discovered.size === 0 && searchFailures.length > 0) {
  console.error(`\n❌  All ${searchFailures.length} search(es) failed. First error:`);
  console.error(`    ${searchFailures[0]}`);
  console.error(`\n    Check GOOGLE_PLACES_API_KEY, and that the Places API (New) is`);
  console.error(`    enabled for the project with billing active.\n`);
  process.exit(1);
}

console.log(`\n   ${discovered.size} distinct cafes discovered.`);

// ─── Stage 2: filter ──────────────────────────────────────────────────────────

const existingRows = db
  .select({
    id: placesTable.id,
    name: placesTable.name,
    lat: placesTable.lat,
    lng: placesTable.lng,
    googlePlaceId: placesTable.googlePlaceId,
    mapsPath: placesTable.mapsPath,
  })
  .from(placesTable)
  .all();

const reject = { closed: 0, notCafe: 0, lowRating: 0, thinReviews: 0, alreadyHave: 0 };
const shortlist: Array<{ place: PlaceSummary; area: Area }> = [];

for (const entry of discovered.values()) {
  const p = entry.place;

  if (p.businessStatus && p.businessStatus !== "OPERATIONAL") {
    reject.closed++;
    continue;
  }
  if (!p.location) {
    reject.notCafe++;
    continue;
  }

  const types = new Set([p.primaryType, ...(p.types ?? [])].filter(Boolean) as string[]);
  if (![...types].some((t) => CAFE_TYPES.has(t))) {
    reject.notCafe++;
    continue;
  }
  if ((p.rating ?? 0) < opts.minRating) {
    reject.lowRating++;
    continue;
  }
  if ((p.userRatingCount ?? 0) < opts.minReviews) {
    reject.thinReviews++;
    continue;
  }

  const existing = findExistingPlace(existingRows, {
    name: p.displayName?.text ?? "",
    lat: p.location.latitude,
    lng: p.location.longitude,
    googlePlaceId: p.id,
  });
  if (existing) {
    reject.alreadyHave++;
    continue;
  }

  shortlist.push(entry);
}

// Interrogation is the expensive stage, so spend it on the most promising
// candidates first: rating weighted by how many people rated.
shortlist.sort((a, b) => {
  const score = (p: PlaceSummary) => (p.rating ?? 0) * Math.log10((p.userRatingCount ?? 1) + 10);
  return score(b.place) - score(a.place);
});

const truncated = Math.max(0, shortlist.length - opts.limit);
const candidates = shortlist.slice(0, opts.limit);

console.log(`   Filtered out: ${reject.closed} closed, ${reject.notCafe} non-cafe, ` +
  `${reject.lowRating} rating < ${opts.minRating}, ${reject.thinReviews} reviews < ${opts.minReviews}, ` +
  `${reject.alreadyHave} already in DB.`);
console.log(`   Interrogating ${candidates.length} candidate(s).`);
if (truncated > 0) {
  console.log(`   ⚠️  ${truncated} candidate(s) dropped by --limit ${opts.limit}. Raise it to cover them.`);
}
console.log("");

// ─── Stage 3+4: interrogate and score ─────────────────────────────────────────

const reports: CandidateReport[] = [];
const taken = new Set(existingRows.map((r) => r.id));

for (const [i, { place, area }] of candidates.entries()) {
  const name = place.displayName?.text ?? "(unnamed)";
  const position = `[${i + 1}/${candidates.length}]`;
  console.log(`${position} 📍 ${name} (${area.name})`);

  let details: PlaceDetails;
  try {
    details = await placeDetails(GOOGLE_KEY, place.id);
  } catch (err) {
    console.warn(`         ⚠️  details fetch failed: ${(err as Error).message}`);
    continue;
  }

  const lat = details.location?.latitude ?? place.location!.latitude;
  const lng = details.location?.longitude ?? place.location!.longitude;

  // Reviews → signals. Google returns at most 5 reviews per place, so this is
  // a thin but recent sample; coverage in the report reflects that.
  const rawReviews = toRawReviews(details).filter((r) => r.text.trim().length > 10);
  const reviewSignals = await batchExtractSignals(rawReviews, place.id, OPENAI_KEY, 5);
  const dimensionScores = aggregateSignals(reviewSignals);

  // Prayer room: reviews first, nearby mosque/mushola as fallback.
  const prayerScore = dimensionScores.find((s) => s.dimension === "prayer_room");
  const needsProbe = !opts.noPrayerProbe && !prayerScore;
  const nearest = needsProbe
    ? await findNearestPrayerSpace(GOOGLE_KEY, lat, lng, opts.prayerRadius)
    : null;

  const verdict = scoreWfc(dimensionScores, {
    minConfidence: opts.confidence,
    amenities: details,
    prayerRoom: { score: prayerScore, nearest, nearbyRadiusMeters: opts.prayerRadius },
  });

  const popularity = computePopularity(reviewSignals);

  const report: CandidateReport = {
    name,
    googlePlaceId: place.id,
    city: area.city,
    area: area.name,
    address: details.shortFormattedAddress ?? details.formattedAddress ?? "",
    lat,
    lng,
    googleRating: details.rating,
    totalRatings: details.userRatingCount,
    mapsUrl: details.googleMapsUri,
    reviewsAnalyzed: rawReviews.length,
    wfcScore: verdict.score,
    coverage: verdict.coverage,
    verdict: verdict.label,
    trendingScore: trendingScore(popularity),
    prayerRoom: verdict.prayerRoom,
    dimensions: verdict.dimensions,
    reasons: verdict.reasons,
    action: "below-threshold",
  };

  const prayerLabel =
    verdict.prayerRoom.status === "onsite"
      ? `mushola on site${verdict.prayerRoom.note ? ` (${verdict.prayerRoom.note})` : ""}`
      : verdict.prayerRoom.status === "nearby"
        ? `mushola nearby (${verdict.prayerRoom.nearest?.meters ?? "?"}m)`
        : verdict.prayerRoom.status === "absent"
          ? "no mushola"
          : "mushola unknown";

  console.log(
    `         WFC ${String(verdict.score).padStart(3)}/100 (${verdict.label}, ` +
    `${Math.round(verdict.coverage * 100)}% coverage, ${rawReviews.length} reviews) · ${prayerLabel}`
  );

  // ─── Stage 5: write ───
  if (verdict.score < opts.minScore || verdict.label === "unknown") {
    report.actionDetail =
      verdict.label === "unknown"
        ? `evidence too thin (coverage ${Math.round(verdict.coverage * 100)}%)`
        : `score ${verdict.score} < --min-score ${opts.minScore}`;
    reports.push(report);
    continue;
  }

  const id = makeReadableId(name, area.name, taken);
  const columns = verdictToColumns(verdict);
  const nearbyNote =
    verdict.prayerRoom.status === "nearby" && verdict.prayerRoom.nearest
      ? ` Prayer: ${verdict.prayerRoom.nearest.name} ${verdict.prayerRoom.nearest.meters}m away.`
      : "";

  const row = {
    id,
    name,
    city: area.city,
    area: area.name,
    address: details.shortFormattedAddress ?? details.formattedAddress ?? "",
    lat,
    lng,
    googlePlaceId: place.id,
    // Left null on purpose: the Places API has no Maps `/g/…` path. The
    // name+proximity fallback in place-dedup is what keeps sync:maps from
    // re-adding this row later.
    mapsPath: null,
    photos: JSON.stringify(
      (details.photos ?? []).slice(0, 3).map((p) => photoUrl(GOOGLE_KEY, p.name))
    ),
    googleRating: details.rating ?? null,
    totalRatings: details.userRatingCount ?? null,
    openingHours: JSON.stringify(details.regularOpeningHours?.weekdayDescriptions ?? []),
    website: details.websiteUri ?? details.googleMapsUri ?? null,
    curatorNote:
      `Auto-discovered ${new Date().toISOString().slice(0, 10)}: WFC ${verdict.score}/100 ` +
      `(${verdict.label}, ${Math.round(verdict.coverage * 100)}% coverage). ` +
      `${verdict.reasons.join("; ")}.${nearbyNote} Unverified: visit to confirm.`,
    wfcPlugs: columns.wfcPlugs,
    wfcPrayerRoom: columns.wfcPrayerRoom,
    wfcNoiseLevel: columns.wfcNoiseLevel,
    wfcParking: columns.wfcParking,
    wfcWifiAvailable: columns.wfcWifiAvailable,
    wfcWifiSpeed: columns.wfcWifiSpeed,
    wfcWifiPassword: true,
    wfcSeatingTypes: JSON.stringify(details.outdoorSeating ? ["solo", "outdoor"] : ["solo"]),
    wfcSeatingCapacity: columns.wfcSeatingCapacity,
    wfcTimeLimitHours: columns.wfcTimeLimitHours,
    wfcCoffeeSpecialty: details.servesCoffee ?? true,
    wfcNonCoffee: true,
    wfcFood: columns.wfcFood,
    wfcMenuHighlights: "[]",
    wfcPriceRange: mapPriceLevel(details.priceLevel),
    tags: JSON.stringify(["auto-discovered", "unverified"]),
    lastVerified: "",
  };

  if (opts.dryRun) {
    report.action = "would-insert";
    report.actionDetail = `id: ${id}`;
  } else {
    try {
      db.insert(placesTable).values(row).run();
      report.action = "inserted";
      report.actionDetail = `id: ${id}`;
      console.log(`         ✅ inserted as "${id}"`);
    } catch (err) {
      report.action = "error";
      report.actionDetail = (err as Error).message;
      console.warn(`         ⚠️  insert failed: ${(err as Error).message}`);
    }
  }

  // Register the row so later candidates dedup and get unique ids against it.
  taken.add(id);
  existingRows.push({
    id,
    name,
    lat,
    lng,
    googlePlaceId: place.id,
    mapsPath: null,
  });

  reports.push(report);
}

// ─── Report ───────────────────────────────────────────────────────────────────

const ranked = [...reports].sort((a, b) => b.wfcScore - a.wfcScore);

console.log("\n\n📊  Results");
console.log("─".repeat(78));
console.log("   WFC  COV  MUSHOLA         CAFE");
for (const r of ranked) {
  const mushola =
    r.prayerRoom.status === "onsite"
      ? "on site"
      : r.prayerRoom.status === "nearby"
        ? `${r.prayerRoom.nearest?.meters ?? "?"}m away`
        : r.prayerRoom.status;
  console.log(
    `   ${String(r.wfcScore).padStart(3)}  ${String(Math.round(r.coverage * 100)).padStart(3)}%  ` +
    `${mushola.padEnd(15)} ${r.name.slice(0, 34).padEnd(35)} ${r.area}`
  );
}

const inserted = reports.filter((r) => r.action === "inserted").length;
const wouldInsert = reports.filter((r) => r.action === "would-insert").length;
const withMushola = reports.filter((r) => r.prayerRoom.status === "onsite").length;
const nearMushola = reports.filter((r) => r.prayerRoom.status === "nearby").length;

console.log("─".repeat(78));
console.log(`   Discovered:      ${discovered.size}`);
console.log(`   Interrogated:    ${candidates.length}`);
console.log(`   Mushola on site: ${withMushola}   nearby: ${nearMushola}`);
console.log(`   ${opts.dryRun ? "Would insert" : "Inserted"}:    ${opts.dryRun ? wouldInsert : inserted}`);
console.log(`   API calls:       ${totalApiCalls()} ${JSON.stringify(apiCallCounts())}`);
console.log("─".repeat(78));

const prefix = opts.output ?? `reports/discovery-${new Date().toISOString().slice(0, 10)}`;
const resolvePrefix = (ext: string) =>
  isAbsolute(prefix) ? `${prefix}${ext}` : join(process.cwd(), `${prefix}${ext}`);
const jsonPath = resolvePrefix(".json");
const mdPath = resolvePrefix(".md");
mkdirSync(dirname(jsonPath), { recursive: true });

writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      options: opts,
      areas: targetAreas.map((a) => a.name),
      discovered: discovered.size,
      rejected: reject,
      truncatedByLimit: truncated,
      apiCalls: apiCallCounts(),
      candidates: ranked,
    },
    null,
    2
  ),
  "utf-8"
);

// Markdown: a shortlist you can read on a phone before heading out.
const md: string[] = [
  `# Cafe discovery, ${new Date().toISOString().slice(0, 10)}`,
  "",
  `Areas: ${targetAreas.map((a) => a.name).join(", ")}`,
  `Discovered ${discovered.size} cafes, interrogated ${candidates.length}, ` +
    `${opts.dryRun ? "would insert" : "inserted"} ${opts.dryRun ? wouldInsert : inserted}.`,
  "",
  "Scores are inferred from at most 5 Google reviews per cafe. `Cov` is how much of the",
  "rubric had actual evidence behind it: a high score at low coverage is a guess.",
  "",
  "| WFC | Cov | Mushola | Cafe | Area | Rating | Notes |",
  "|---:|---:|---|---|---|---:|---|",
];

for (const r of ranked) {
  const mushola =
    r.prayerRoom.status === "onsite"
      ? `on site${r.prayerRoom.note ? ` (${r.prayerRoom.note})` : ""}`
      : r.prayerRoom.status === "nearby"
        ? `${r.prayerRoom.nearest?.meters ?? "?"}m away`
        : r.prayerRoom.status;
  const link = r.mapsUrl ? `[${r.name}](${r.mapsUrl})` : r.name;
  md.push(
    `| ${r.wfcScore} | ${Math.round(r.coverage * 100)}% | ${mushola} | ${link} | ${r.area} | ` +
    `${r.googleRating ?? "?"} (${r.totalRatings ?? 0}) | ${r.reasons.join("; ")} |`
  );
}

md.push("", "## Evidence", "");
for (const r of ranked) {
  md.push(`### ${r.name}: ${r.wfcScore}/100 (${r.verdict})`, "");
  for (const d of r.dimensions) {
    const ev = d.evidence.length > 0 ? `: "${d.evidence[0]}"` : "";
    md.push(`- **${d.label}**: ${d.value} (${d.source}, ${d.confidence} conf)${ev}`);
  }
  if (r.prayerRoom.evidence.length > 0) {
    md.push(`- **Prayer room**: ${r.prayerRoom.status}: "${r.prayerRoom.evidence[0]}"`);
  }
  md.push("");
}

writeFileSync(mdPath, md.join("\n"), "utf-8");

console.log(`\n💾  ${jsonPath}`);
console.log(`💾  ${mdPath}\n`);

if (!opts.dryRun && inserted > 0) {
  console.log(`⚠️  ${inserted} row(s) written with tags ["auto-discovered","unverified"] and`);
  console.log(`    lastVerified="": the WFC values are review inferences, not visits.\n`);
}
