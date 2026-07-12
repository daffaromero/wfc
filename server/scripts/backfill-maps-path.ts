/**
 * backfill-maps-path.ts
 *
 * One-time reconciliation. The existing curated rows were originally built
 * from the same Google Maps saved list, then hand-tuned — but they never
 * stored the stable Maps place path. This script matches each row back to its
 * Maps entry and stamps `maps_path` in, so future `sync:maps` runs dedup
 * cleanly instead of creating duplicates.
 *
 * Matching signal (combined score):
 *   - identical curator note (strong; the note came from the list)
 *   - place-name token overlap
 *   - geographic proximity (haversine)
 *
 * Usage:
 *   bun run server/scripts/backfill-maps-path.ts            # report only
 *   bun run server/scripts/backfill-maps-path.ts --apply    # write maps_path
 */

import { db } from "../db/client";
import { places } from "../db/schema";
import { eq } from "drizzle-orm";
import { fetchMapsEntries, type MapsEntry } from "./sync-from-maps";

const APPLY = process.argv.includes("--apply");
const FORCE_UNCERTAIN = process.argv.includes("--force-uncertain");

// ─── Scoring helpers ─────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "coffee", "cafe", "café", "kopi", "and", "the", "roastery", "roasters",
  "eatery", "eats", "kitchen", "resto", "space", "gallery", "co", "jkt",
  "jakarta", "house", "coffeatery", "kaffee",
]);

function tokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface Row {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  curatorNote: string | null;
}

function score(row: Row, entry: MapsEntry): { total: number; dist: number; noteHit: boolean; nameSim: number } {
  const dist = haversineMeters(row.lat, row.lng, entry.lat, entry.lng);

  const noteHit =
    !!row.curatorNote && row.curatorNote.trim().length > 0 &&
    row.curatorNote.trim() === entry.note.trim();

  const nameSim = jaccard(tokens(row.name), tokens(entry.name));

  // Proximity is only a weak tiebreaker: the curated rows' coordinates are
  // unreliable (hand-entered, off by kilometres), so name + note dominate.
  const distScore =
    dist <= 500 ? 10 :
    dist <= 2000 ? 6 :
    dist <= 5000 ? 2 : 0;

  const total = (noteHit ? 50 : 0) + nameSim * 40 + distScore;
  return { total, dist, noteHit, nameSim };
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const entries = await fetchMapsEntries();
  const rows = db
    .select({
      id: places.id,
      name: places.name,
      area: places.area,
      lat: places.lat,
      lng: places.lng,
      curatorNote: places.curatorNote,
      mapsPath: places.mapsPath,
    })
    .from(places)
    .all();

  const pending = rows.filter((r) => !r.mapsPath);
  console.log(`\nEntries in list: ${entries.length}`);
  console.log(`Curated rows needing maps_path: ${pending.length}\n`);

  // Build all candidate pairs above a floor, then greedily assign best-first
  // so each entry is used at most once (the sets are ~1:1).
  const pairs: { row: Row; entry: MapsEntry; s: ReturnType<typeof score> }[] = [];
  for (const row of pending) {
    for (const entry of entries) {
      const s = score(row, entry);
      if (s.total >= 10) pairs.push({ row, entry, s });
    }
  }
  pairs.sort((a, b) => b.s.total - a.s.total);

  // Count how many entries share each normalized name — a >1 cluster (e.g.
  // three "Kopikina") is the only case where we truly need proximity to pick.
  const nameKey = (n: string) => [...tokens(n)].sort().join(" ");
  const clusterSize = new Map<string, number>();
  for (const e of entries) clusterSize.set(nameKey(e.name), (clusterSize.get(nameKey(e.name)) ?? 0) + 1);

  const usedEntries = new Set<string>();
  const assigned = new Map<string, { entry: MapsEntry; s: ReturnType<typeof score>; uncertain: boolean; reason: string }>();

  for (const p of pairs) {
    if (assigned.has(p.row.id)) continue;
    const key = p.entry.mapsPath || `coord:${p.entry.lat.toFixed(5)},${p.entry.lng.toFixed(5)}`;
    if (usedEntries.has(key)) continue;

    // A match is trustworthy when the note matches or the name is a strong,
    // unique hit. Distance is ignored (curated coords are unreliable).
    const cluster = clusterSize.get(nameKey(p.entry.name)) ?? 1;
    let uncertain = false;
    let reason = "";
    if (!p.s.noteHit && p.s.nameSim < 0.5) {
      uncertain = true; reason = `weak name match (${(p.s.nameSim * 100).toFixed(0)}%)`;
    } else if (!p.s.noteHit && cluster > 1) {
      uncertain = true; reason = `same-name cluster (${cluster}), picked nearest ${Math.round(p.s.dist)}m`;
    }

    assigned.set(p.row.id, { entry: p.entry, s: p.s, uncertain, reason });
    usedEntries.add(key);
  }

  const unmatched = pending.filter((r) => !assigned.has(r.id));
  const confident: string[] = [];
  const uncertain: string[] = [];

  for (const row of pending) {
    const a = assigned.get(row.id);
    if (!a) continue;
    const line = `  ${row.id}  →  "${a.entry.name}" [${a.entry.mapsPath || "no-path"}]  ` +
      `(${a.s.noteHit ? "note✓ " : ""}name ${(a.s.nameSim * 100).toFixed(0)}% ${Math.round(a.s.dist)}m)`;
    if (a.uncertain) uncertain.push(`${line}  ⚠ ${a.reason}`);
    else confident.push(line);
  }

  console.log(`✅ Confident matches: ${confident.length}`);
  for (const l of confident) console.log(l);

  if (uncertain.length) {
    console.log(`\n⚠️  Uncertain matches (${uncertain.length}) — review these:`);
    for (const l of uncertain) console.log(l);
  }

  if (unmatched.length) {
    console.log(`\n❌ No match found (${unmatched.length}):`);
    for (const r of unmatched) console.log(`  ${r.id}  "${r.name}" (${r.area})`);
  }

  if (!APPLY) {
    console.log(`\n(report only — re-run with --apply to write maps_path)\n`);
    return;
  }

  // Only write confident matches. Uncertain ones are wrong as often as right
  // (a leftover row gets greedily paired with an unrelated nearby entry), so
  // they must be eyeballed. Use --force-uncertain to write them anyway.
  let written = 0;
  let held = 0;
  for (const [rowId, a] of assigned) {
    if (a.uncertain && !FORCE_UNCERTAIN) { held++; continue; }
    const key = a.entry.mapsPath || `coord:${a.entry.lat.toFixed(5)},${a.entry.lng.toFixed(5)}`;
    db.update(places).set({ mapsPath: key }).where(eq(places.id, rowId)).run();
    written++;
  }
  console.log(`\n✍️  Wrote maps_path to ${written} row(s).`);
  if (held) console.log(`   Held back ${held} uncertain match(es) — review, then --force-uncertain to write.`);
  console.log("");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
