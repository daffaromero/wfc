#!/usr/bin/env bun
/**
 * Generates src/data/places.ts from the scraped WFC + Mushola list.
 * Run: bun run scripts/generate-stubs.ts
 */

import { writeFileSync } from "fs";
import { join } from "path";

interface RawEntry {
  name: string;
  price: string;
  note: string;
}

const RAW: RawEntry[] = [
  { name: "Wood & Brew Café", price: "Rp 50–75 rb", note: "Approved 👍" },
  { name: "OSH Jakarta", price: "Rp 25–50 rb", note: "Approved meskipun colokannya agak Limited Edition™️" },
  { name: "Kopikina Tebet", price: "", note: "ACC APPROVED ACK OK GAS 👍👍" },
  { name: "Kedai Kopi Kani - Tebet", price: "Rp 25–50 rb", note: "Mushola ukuran XS muat 1 orang wkwk…" },
  { name: "Toko Kopi Klasik", price: "Rp 25–50 rb", note: "Not bad lah patut dicoba" },
  { name: "Kopi Lima Detik Tebet", price: "Rp 25–50 rb", note: "Approved, bisa kalo budget agak mepet 👍" },
  { name: "Merial Coffee House", price: "Rp 50–75 rb", note: "Hampir approved, ok lah" },
  { name: "Etera Tebet", price: "Rp 50–75 rb", note: "Approveddd worth the price 👍" },
  { name: "Sleepless Owls", price: "Rp 50–75 rb", note: "Approved 👍" },
  { name: "Agreya Coffee Menteng", price: "", note: "Satu area dengan Masjid Sunda Kelapa, jadi harus jalan ke masjidnya. Approved 👍" },
  { name: "Kopikalyan Menteng", price: "Rp 50–75 rb", note: "Approveddd love banget 👍👍👍" },
  { name: "Kopitagram Centang Biru - Kuningan", price: "", note: "Rame banget, tapi tetap approved 👍" },
  { name: "Kopikina Kemang", price: "", note: "Approved 👍" },
  { name: "First Crack Coffee", price: "", note: "Mushola karyawan di basement :)" },
  { name: "TERU", price: "", note: "Approved 👍" },
  { name: "Anomali Coffee", price: "Rp 50–75 rb", note: "Approved 👍" },
  { name: "Senyata Senopati", price: "", note: "" },
  { name: "Kafe Gamat Bendungan Hilir", price: "Rp 50–75 rb", note: "" },
  { name: "7 Speed Coffee - Panglima Polim", price: "Rp 50–75 rb", note: "" },
  { name: "BRUNO Cafe in the Park", price: "", note: "" },
  { name: "South Kitchen Setiabudi", price: "Rp 50–75 rb", note: "Mushola kecil (1 orang)" },
  { name: "Loúi Coffee", price: "Rp 25–50 rb", note: "" },
  { name: "Cleave Coffee & Roastery", price: "", note: "Dekat Masjid Tangkuban Perahu" },
  { name: "Gould Coffee & Eatery Setiabudi", price: "", note: "" },
  { name: "Common Grounds Coffee Roaster Menteng", price: "", note: "" },
  { name: "Jurnal Risa Coffee Atrium", price: "Rp 50–75 rb", note: "" },
  { name: "Dandia Coffee & Eats", price: "Rp 50–75 rb", note: "" },
  { name: "HAKON ETHNIC", price: "Rp 50–75 rb", note: "" },
  { name: "ORKA Coffee - Tebet", price: "", note: "" },
  { name: "Jora (Tebet)", price: "Rp 50–75 rb", note: "" },
  { name: "Relung Kopi", price: "Rp 25–50 rb", note: "" },
  { name: "Titik Temu Cafe - SCBD", price: "", note: "" },
  { name: "Anomali Coffee - Cipete", price: "", note: "" },
  { name: "humble baker", price: "", note: "" },
  { name: "LEGE Coffee & Toastie, Tebet", price: "", note: "" },
  { name: "Baca Di Tebet Perpustakaan dan Ruang Temu", price: "", note: "" },
  { name: "Sehela Kopi", price: "", note: "" },
  { name: "Fern Coffee House", price: "Rp 25–50 rb", note: "" },
  { name: "Ruma Coffeatery Bangka", price: "", note: "" },
  { name: "Ruma Coffeatery", price: "", note: "Kepleset nyampe ke Masjid Darrut Tauhid" },
  { name: "Roots & Grow", price: "Rp 50–75 rb", note: "" },
  { name: "Second Floor Coffee Dharmawangsa", price: "", note: "" },
  { name: "Anomali Coffee Menteng", price: "", note: "" },
  { name: "Wangsa Kemang", price: "", note: "" },
  { name: "Coffee & Thyme Tebet", price: "Rp 50–75 rb", note: "" },
  { name: "Malar Coffee", price: "Rp 25–50 rb", note: "" },
  { name: "Ruma Coffeeatery Blok M", price: "", note: "" },
  { name: "SINOÜ", price: "Rp 25–50 rb", note: "" },
  { name: "Agreya Coffee - Duren Sawit", price: "", note: "" },
  { name: "Monarki Coffee | Coffee Shop Jakarta Pusat", price: "", note: "" },
  { name: "Bagi Kopi Kemang Utara", price: "Rp 25–50 rb", note: "" },
  { name: "3Point Cafe & Resto", price: "", note: "" },
  { name: "Work Coffee Jakarta", price: "Rp 50–75 rb", note: "" },
  { name: "Sudut Timur Tebet", price: "Rp 50–75 rb", note: "" },
  { name: "Midori Coffee Menteng", price: "", note: "Mushola beda lantai" },
  { name: "Sagaleh", price: "", note: "" },
  { name: "Rumah Sagaleh Wijaya", price: "Rp 25–50 rb", note: "" },
  { name: "Merame", price: "", note: "" },
  { name: "Narabe Coffee & Gallery", price: "Rp 50–75 rb", note: "" },
  { name: "Kopikalyan Archive", price: "Rp 50–75 rb", note: "" },
  { name: "Kopikalyan Wijaya - Cafe Melawai", price: "Rp 50–75 rb", note: "" },
  { name: "Atsara Coffee & Eatery", price: "", note: "" },
  { name: "Toodz House - Cipete", price: "Rp 75–100 rb", note: "" },
  { name: "Six Ounces Coffee Panglima Polim", price: "", note: "" },
  { name: "Dua Coffee @Cipete", price: "", note: "" },
  { name: "Dua Coffee @Tebet", price: "", note: "" },
  { name: "Dipuri.jkt", price: "", note: "" },
  { name: "Kopikina Cikini", price: "", note: "" },
  { name: "Blue Doors Menteng", price: "Rp 50–75 rb", note: "" },
  { name: "9 GRAMS", price: "", note: "" },
  { name: "Diskusi Kopi & Ruang Berbagi Kawi", price: "Rp 25–50 rb", note: "" },
  { name: "Mom & Pop", price: "Rp 50–75 rb", note: "" },
  { name: "Daisugi Coffee Ideas & Lounge", price: "", note: "" },
  { name: "Workroom Coffee", price: "", note: "" },
  { name: "Sinilagi - Panglima Polim", price: "", note: "" },
  { name: "BERKALA COFFEE AMPERA", price: "", note: "" },
  { name: "Kofuse Coffee & Dine", price: "", note: "" },
  { name: "Simetri Coffee Roasters", price: "", note: "" },
  { name: "Payu Coffee & Eatery", price: "Rp 50–75 rb", note: "" },
  { name: "The Post - Coffee and Eatery", price: "", note: "" },
  { name: "Mewatu Coffee & Gallery", price: "", note: "" },
  { name: "Cecemuwe Cafe and Space - Senayan", price: "", note: "Mushola di basement. Tempat pet-friendly, so be cautious." },
  { name: "Fore Donut - Panglima Polim", price: "", note: "" },
  { name: "Westloop - Coffee & Kitchen", price: "", note: "" },
  { name: "Kopi Kenangan - Setiabudi Jakarta Selatan", price: "", note: "" },
  { name: "Kopi Aloo Melawai", price: "", note: "Mushola di basement" },
  { name: "Tanatap Coffee Ampera", price: "", note: "" },
  { name: "Kopitagram Centang Biru - Ampera", price: "", note: "" },
  { name: "Omnikopi", price: "", note: "" },
  { name: "Other Half", price: "", note: "Mushola di basement" },
  { name: "Smiljan Southspare", price: "", note: "" },
  { name: "Lamoenan Cafe", price: "", note: "" },
  { name: "Coffee Eight", price: "", note: "" },
  { name: "Walking Drums", price: "", note: "" },
  { name: "KINA", price: "", note: "" },
  { name: "Smoking Barrels Atelier - Cilandak", price: "", note: "" },
  { name: "NAOU CAFE", price: "Rp 50–75 rb", note: "" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function priceRange(price: string): 1 | 2 | 3 | 4 {
  if (price.includes("25–50")) return 1;
  if (price.includes("50–75")) return 2;
  if (price.includes("75–100")) return 3;
  if (price.includes("100")) return 4;
  return 2; // unknown → default mid
}

// Jakarta areas to detect from place name
const AREA_PATTERNS: [RegExp, string][] = [
  [/tebet/i, "Tebet"],
  [/menteng/i, "Menteng"],
  [/kemang utara/i, "Kemang Utara"],
  [/kemang/i, "Kemang"],
  [/kuningan/i, "Kuningan"],
  [/senopati/i, "Senopati"],
  [/setiabudi/i, "Setiabudi"],
  [/scbd/i, "SCBD"],
  [/blok.?m/i, "Blok M"],
  [/cipete/i, "Cipete"],
  [/duren.sawit/i, "Duren Sawit"],
  [/ampera/i, "Ampera"],
  [/dharmawangsa/i, "Dharmawangsa"],
  [/wijaya|melawai/i, "Melawai / Wijaya"],
  [/cilandak/i, "Cilandak"],
  [/panglima.polim/i, "Panglima Polim"],
  [/cikini/i, "Cikini"],
  [/bendungan.hilir/i, "Bendungan Hilir"],
  [/bangka/i, "Bangka"],
  [/jakarta.pusat/i, "Jakarta Pusat"],
  [/senayan/i, "Senayan"],
  [/kawi/i, "Kawi"],
  [/atrium/i, "Atrium Senen"],
];

function extractArea(name: string): string {
  for (const [re, area] of AREA_PATTERNS) {
    if (re.test(name)) return area;
  }
  return "";
}

// Note → WFC field hints
function noiseFromNote(note: string): "quiet" | "moderate" | "loud" {
  if (/rame banget/i.test(note)) return "loud";
  return "moderate";
}

// Notes that indicate nearby mosque (no in-building mushola)
function nearbyMosqueOnly(note: string): boolean {
  return /dekat masjid|ke masjid|jalan ke masjid|area dengan masjid/i.test(note);
}

// ─── Generate ────────────────────────────────────────────────────────────────

const idSet = new Set<string>();

function makeId(name: string): string {
  let id = slugify(name);
  if (idSet.has(id)) id = id + "-2";
  idSet.add(id);
  return id;
}

const places = RAW.map((r) => {
  const id = makeId(r.name);
  const area = extractArea(r.name);
  const pr = priceRange(r.price);
  const noInBuilding = nearbyMosqueOnly(r.note);

  const plugs = /limited edition|colokan.*limit/i.test(r.note) ? "limited" : "limited";
  const noise = noiseFromNote(r.note);

  const tags: string[] = ["mushola"];
  if (noInBuilding) tags.push("nearby-mosque");
  if (/pet.friendly/i.test(r.note)) tags.push("pet-friendly");
  if (/basement/i.test(r.note)) tags.push("mushola-basement");
  if (/beda lantai/i.test(r.note)) tags.push("mushola-diff-floor");
  if (/karyawan/i.test(r.note)) tags.push("mushola-staff");
  if (/xs|kecil|1 orang/i.test(r.note)) tags.push("mushola-small");
  if (/budget|mepet/i.test(r.note)) tags.push("budget-friendly");

  return {
    id,
    name: r.name,
    city: "jakarta",
    area,
    address: "",
    coordinates: { lat: -6.2088, lng: 106.8456 },
    photos: [] as string[],
    openingHours: [] as string[],
    wfc: {
      seating: {
        types: [] as string[],
        capacity: "medium",
      },
      wifi: { available: true, speed: undefined, requiresPassword: true },
      plugs,
      prayerRoom: true,
      noiseLevel: noise,
      parking: "none",
      menu: {
        coffeeSpecialty: true,
        nonCoffee: true,
        food: false,
        priceRange: pr,
      },
    },
    tags,
    lastVerified: "2026-05-01",
    ...(r.note ? { curatorNote: r.note } : {}),
  };
});

// ─── Emit TypeScript ─────────────────────────────────────────────────────────

const out = `import type { Place } from "../types/place";

// 97 places from the curated "WFC + Mushola" Google Maps list (Jakarta edition).
// Addresses, coordinates, photos, and detailed WFC fields are stubs —
// run \`bun run seed\` with a Google Places API key to enrich them.
export const places: Place[] = ${JSON.stringify(places, null, 2)
  .replace(/"city": "jakarta"/g, 'city: "jakarta"')
  // pretty-print as TS (JSON is valid TS, just keep it)
};
`;

const dest = join(import.meta.dir, "../src/data/places.ts");
writeFileSync(dest, out, "utf-8");
console.log(`✅  Wrote ${places.length} place stubs to ${dest}`);
