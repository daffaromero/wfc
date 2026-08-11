/**
 * sync-from-maps.ts
 *
 * Syncs places from the public Google Maps "WFC + Mushola" saved list
 * into the local SQLite DB.  Only *adds* new places; never overwrites
 * existing rows (so hand-tuned WFC attributes are preserved).
 *
 * Dedup key is the Google Maps place path (maps_path column) — the stable
 * per-place identity. Existing rows get theirs backfilled once via
 * backfill-maps-path.ts; after that, re-running this sync is idempotent.
 *
 * Exposes syncFromMaps() and fetchMapsEntries() for programmatic use
 * (API route, server boot, backfill) plus a CLI wrapper for the npm scripts:
 *
 *   bun run sync:maps
 *   bun run sync:maps --dry-run   # preview without writing
 *   bun run sync:maps --reset     # wipe DB rows and re-import all
 */

import { db } from "../db/client";
import { places } from "../db/schema";
import { findExistingPlace } from "../../scripts/lib/place-dedup";

// ─── Config ──────────────────────────────────────────────────────────────────

// Public Google Maps saved lists to sync from. The list ID is the URL segment
// after `!2s`: https://www.google.com/maps/@.../data=!4m3!11m2!2s<LIST_ID>!3e3
// Add more IDs (comma-separated) via MAPS_LIST_IDS.
const DEFAULT_LIST_IDS = [
  "riqCL0RJEs8EGAkdA9PAMsfb-sgLTw", // WFC + Mushola (Jakarta)
  "VZj35OZN511h7qBzEWYV-w",         // Jogja
];

const LIST_IDS = (
  process.env.MAPS_LIST_IDS ?? process.env.MAPS_LIST_ID ?? DEFAULT_LIST_IDS.join(",")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const listPageUrl = (listId: string) =>
  `https://www.google.com/maps/placelists/list/${listId}`;

// ─── Types ─────────────────────────────────────────────────────────────────

/** A normalized entry parsed from the Maps saved list. */
export interface MapsEntry {
  name: string;
  lat: number;
  lng: number;
  mapsPath: string;   // e.g. "/g/11c3k6fp7p" ("" if Google omitted it)
  note: string;       // curator note attached in the list
  area: string;
  address: string;
}

export interface SyncOptions {
  dryRun?: boolean;
  reset?: boolean;
}

export interface SyncSummary {
  found: number;
  added: number;
  skipped: number;
  errors: number;
  addedNames: string[];
}

// ─── Fetch list from Google Maps internal API ─────────────────────────────────

async function fetchListApiUrl(listId: string): Promise<string> {
  // Fetch the Maps page to grab the fresh entitylist/getlist preload URL.
  // The pb parameter contains a session token that changes per request.
  const res = await fetch(listPageUrl(listId), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const html = await res.text();

  // Extract the preload href: /maps/preview/entitylist/getlist?...
  const match = html.match(
    /href="(\/maps\/preview\/entitylist\/getlist[^"]+)"/
  );
  if (!match) throw new Error("Could not find entitylist/getlist link in page HTML.");

  return "https://www.google.com" + match[1].replace(/&amp;/g, "&");
}

// The Maps response is deeply-nested, positional, untyped JSON. We treat it as
// unknown[] and narrow by position at the parse boundary.
async function fetchRawPlaces(listId: string): Promise<unknown[]> {
  const apiUrl = await fetchListApiUrl(listId);
  const res = await fetch(apiUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Referer: "https://www.google.com/maps/",
    },
  });
  const text = await res.text();
  // Google prefixes JSON responses with )]}'\n to prevent XSSI
  const data = JSON.parse(text.replace(/^\)\]\}'\n/, "")) as unknown;
  const top = (data as unknown[])?.[0] as unknown[] | undefined;
  return (top?.[8] as unknown[]) ?? [];
}

/** Fetch + normalize every configured saved list into MapsEntry[]. */
export async function fetchMapsEntries(): Promise<MapsEntry[]> {
  const entries: MapsEntry[] = [];

  for (const listId of LIST_IDS) {
    const raw = await fetchRawPlaces(listId);
    for (const row of raw) {
      const r = row as unknown[];
      const name = r[2] as string;
      const info = r[1] as unknown[] | undefined;
      if (!name || !info) continue;

      const geo = info[5] as unknown[] | undefined;
      const lat = geo?.[2] as number;
      const lng = geo?.[3] as number;
      if (!lat || !lng) continue;

      const fullAddr = (info[2] as string) || "";
      entries.push({
        name,
        lat,
        lng,
        mapsPath: (info[7] as string) || "",
        note: (r[3] as string) || "",
        area: parseArea(fullAddr),
        // Strip place name from front of address for a cleaner street address
        address: fullAddr.replace(/^[^,]+,\s*/, ""),
      });
    }
  }

  return entries;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // strip diacritics
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Guess area from address like:
 *   "Kopikina, Jl. Tebet Timur Dalam Raya No.43, RT.1/RW.8, East Tebet, Tebet, South Jakarta City, Jakarta 12820"
 * Returns "Tebet"
 */
function parseArea(address: string): string {
  const parts = address.split(", ").map((s) => s.trim());
  // Drop the first part (usually the place name) and the last two (city, postcode)
  const middle = parts.slice(1, -2);
  // Prefer the shortest part that doesn't look like a street address
  const clean = middle.filter(
    (p) => !p.match(/^(Jl\.|RT\.|RW\.|No\.|Kec\.|Kel\.|Kota|Daerah)/i)
  );
  return clean[clean.length - 2] || clean[clean.length - 1] || middle[0] || "Jakarta";
}

/**
 * Determine city from latitude.
 * Jakarta: roughly -5.9 to -6.4
 * Yogyakarta: roughly -7.7 to -7.9
 */
function cityFromLat(lat: number): "jakarta" | "yogyakarta" {
  return lat < -7.0 ? "yogyakarta" : "jakarta";
}

/**
 * Infer prayerRoom from curator note.
 * Note: this is a best-effort guess; admin panel should be used to verify.
 */
function inferPrayerRoom(note: string): boolean {
  return /mushola|mushalah|masjid|prayer room/i.test(note);
}

/**
 * Human-readable id: slug(name), disambiguated with the area (and then a
 * counter) only when that base is already taken by a *different* place.
 * Mirrors the hand-curated style (e.g. "kopikina-tebet").
 */
export function makeReadableId(name: string, area: string, taken: Set<string>): string {
  const base = slugify(name);
  if (!taken.has(base)) return base;

  const withArea = `${base}-${slugify(area)}`;
  if (!taken.has(withArea)) return withArea;

  let n = 2;
  while (taken.has(`${withArea}-${n}`)) n++;
  return `${withArea}-${n}`;
}

// ─── Core sync ─────────────────────────────────────────────────────────────

export async function syncFromMaps(opts: SyncOptions = {}): Promise<SyncSummary> {
  const { dryRun = false, reset = false } = opts;

  if (reset && !dryRun) {
    await db.delete(places);
  }

  const entries = await fetchMapsEntries();

  const summary: SyncSummary = {
    found: entries.length,
    added: 0,
    skipped: 0,
    errors: 0,
    addedNames: [],
  };

  // Existing rows, used both to keep generated ids unique and to recognise a
  // place we already have. Rows added by discover-cafes.ts carry a Places API
  // id but no maps path, so the path check alone would re-add them — hence the
  // name+proximity fallback in findExistingPlace.
  const existingRows = db
    .select({
      id: places.id,
      name: places.name,
      lat: places.lat,
      lng: places.lng,
      googlePlaceId: places.googlePlaceId,
      mapsPath: places.mapsPath,
    })
    .from(places)
    .all();

  const taken = new Set(existingRows.map((r) => r.id));
  // Guard against the same place appearing twice within this run (e.g. present
  // in more than one list, or before the insert has landed in dry-run).
  const seen = new Set<string>();

  for (const entry of entries) {
    // Dedup key: the stable maps path. Fall back to a coordinate key when
    // Google omitted the path so we still don't duplicate.
    const dedupKey = entry.mapsPath || `coord:${entry.lat.toFixed(5)},${entry.lng.toFixed(5)}`;

    if (seen.has(dedupKey)) {
      summary.skipped++;
      continue;
    }
    seen.add(dedupKey);

    if (!reset) {
      const existing = findExistingPlace(existingRows, {
        name: entry.name,
        lat: entry.lat,
        lng: entry.lng,
        mapsPath: dedupKey,
      });
      if (existing) {
        summary.skipped++;
        continue;
      }
    }

    const id   = makeReadableId(entry.name, entry.area, taken);
    taken.add(id);
    const city = cityFromLat(entry.lat);

    const row = {
      id,
      name:    entry.name,
      city,
      area:    entry.area,
      address: entry.address,
      lat:     entry.lat,
      lng:     entry.lng,
      googlePlaceId: null,
      mapsPath:      dedupKey,
      photos:       "[]",
      googleRating: null,
      totalRatings: null,
      openingHours: JSON.stringify(["Daily: 08:00–22:00"]),
      curatorNote:  entry.note || null,
      // Link back to Google Maps for the admin panel
      website:      entry.mapsPath ? `https://www.google.com/maps${entry.mapsPath}` : null,
      // WFC defaults — to be refined via admin panel
      wfcPlugs:           "limited" as const,
      wfcPrayerRoom:      inferPrayerRoom(entry.note),
      wfcNoiseLevel:      "moderate" as const,
      wfcParking:         "none" as const,
      wfcWifiAvailable:   true,
      wfcWifiSpeed:       "moderate" as const,
      wfcWifiPassword:    true,
      wfcSeatingTypes:    JSON.stringify(["solo", "communal"]),
      wfcSeatingCapacity: "medium" as const,
      wfcTimeLimitHours:  null,
      wfcCoffeeSpecialty: true,
      wfcNonCoffee:       true,
      wfcFood:            false,
      wfcMenuHighlights:  "[]",
      wfcPriceRange:      2,
      tags:               JSON.stringify([]),
      lastVerified:       new Date().toISOString().split("T")[0],
    };

    if (!dryRun) {
      db.insert(places).values(row).run();
    }

    // Keep the in-memory set current so two near-identical list entries in the
    // same run don't both land.
    existingRows.push({
      id,
      name: entry.name,
      lat: entry.lat,
      lng: entry.lng,
      googlePlaceId: null,
      mapsPath: dedupKey,
    });

    summary.added++;
    summary.addedNames.push(`${entry.name} (${entry.area}, ${city})`);
  }

  return summary;
}

// ─── CLI wrapper ─────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const reset  = process.argv.includes("--reset");

  console.log(`\n🗺️  Syncing from ${LIST_IDS.length} Google Maps list(s): ${LIST_IDS.join(", ")}`);
  if (dryRun) console.log("   (dry run — no DB writes)");
  if (reset && !dryRun) console.log("   --reset: clearing all existing rows…");
  console.log("");

  const s = await syncFromMaps({ dryRun, reset });

  console.log(`   Found ${s.found} places in list\n`);
  for (const n of s.addedNames) {
    console.log(`   ✓ ${dryRun ? "[dry] " : ""}Added: ${n}`);
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`   Added:   ${s.added}`);
  console.log(`   Skipped: ${s.skipped} (already in DB)`);
  if (s.errors) console.log(`   Errors:  ${s.errors}`);
  console.log(`─────────────────────────────────────────\n`);
}

// Only run the CLI when executed directly (not when imported by the server).
if (import.meta.main) {
  main().catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
}
