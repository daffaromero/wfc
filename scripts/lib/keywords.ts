/**
 * scripts/lib/keywords.ts
 *
 * Bilingual (Indonesian + English) keyword patterns for extracting WFC signals
 * from cafe reviews. Each rule maps a regex + context to a WfcSignal dimension
 * and an inferred value.
 *
 * Indonesian notes:
 *  - "wifi / wi-fi / inet / internet" → connectivity
 *  - "colokan / stop kontak / colok / charger" → plugs
 *  - "rame / ramai / berisik / ribut" → loud
 *  - "sepi / tenang / kondusif / nyaman buat kerja" → quiet
 *  - "mushola / musola / sholat / salat / sajadah" → prayer room
 *  - "parkir / lahan parkir" → parking
 *  - "makan / makanan / menu / food" → food
 *  - "mahal / murah / worth / harga" → price signals
 */

import type { WfcSignal, Sentiment } from "../../src/types/review";

export interface KeywordRule {
  dimension: WfcSignal["dimension"];
  value: string;
  sentiment: Sentiment;
  /** Applied to lowercased review text */
  pattern: RegExp;
  /** Additional pattern that must NOT match (negation) */
  negate?: RegExp;
}

// ─── WiFi ─────────────────────────────────────────────────────────────────────

const WIFI_RULES: KeywordRule[] = [
  // Available + fast
  {
    dimension: "wifi_speed",
    value: "fast",
    sentiment: "positive",
    pattern: /\b(wifi|wi-fi|internet|inet|jaringan)\b.{0,30}(kenceng|kencang|cepet|cepat|ngebut|lancar|fast|speedy|good|great|stable|stabil)\b/i,
  },
  {
    dimension: "wifi_speed",
    value: "fast",
    sentiment: "positive",
    pattern: /\b(kenceng|kencang|cepet|cepat|ngebut|lancar|fast|speedy|good wifi|great wifi|stable wifi)\b.{0,30}(wifi|wi-fi|internet|inet)\b/i,
  },
  // Slow
  {
    dimension: "wifi_speed",
    value: "slow",
    sentiment: "negative",
    pattern: /\b(wifi|wi-fi|internet|inet)\b.{0,30}(lemot|lelet|lambat|slow|bad|poor|weak|unstable|mati|nggak ada|tidak ada|ga ada)\b/i,
  },
  {
    dimension: "wifi_speed",
    value: "slow",
    sentiment: "negative",
    pattern: /\b(lemot|lelet|lambat|slow wifi|bad wifi|poor wifi|no wifi|no internet)\b.{0,30}(wifi|wi-fi|internet|inet)\b/i,
  },
  // Moderate
  {
    dimension: "wifi_speed",
    value: "moderate",
    sentiment: "neutral",
    pattern: /\b(wifi|wi-fi|internet|inet)\b.{0,30}(lumayan|cukup|ok|okay|biasa|average|decent|moderate)\b/i,
  },
  // Not available
  {
    dimension: "wifi_available",
    value: "false",
    sentiment: "negative",
    pattern: /\b(tidak ada|ga ada|gak ada|nggak ada|no|tidak punya)\b.{0,15}(wifi|wi-fi|internet|inet)\b/i,
  },
];

// ─── Plugs / Power outlets ────────────────────────────────────────────────────

const PLUGS_RULES: KeywordRule[] = [
  // Ample
  {
    dimension: "plugs",
    value: "ample",
    sentiment: "positive",
    pattern: /\b(banyak|plenty|lots of|ample|sufficient|cukup)\b.{0,20}(colokan|stop.?kontak|outlet|colok|charger|listrik)\b/i,
  },
  {
    dimension: "plugs",
    value: "ample",
    sentiment: "positive",
    pattern: /\b(colokan|stop.?kontak|outlet|colok)\b.{0,20}(banyak|plenty|lots|ample|tersedia)\b/i,
  },
  // Limited
  {
    dimension: "plugs",
    value: "limited",
    sentiment: "negative",
    pattern: /\b(colokan|stop.?kontak|outlet|colok)\b.{0,30}(limited|dikit|sedikit|susah|kurang|rebutan|jarang|scarce|few)\b/i,
  },
  {
    dimension: "plugs",
    value: "limited",
    sentiment: "negative",
    pattern: /\b(susah|sulit|rebutan|cari.cari)\b.{0,20}(colokan|stop.?kontak|outlet|colok)\b/i,
  },
  {
    dimension: "plugs",
    value: "limited",
    sentiment: "negative",
    pattern: /\bcolokan\b.{0,10}\blimited\b/i,
  },
  // None
  {
    dimension: "plugs",
    value: "none",
    sentiment: "negative",
    pattern: /\b(tidak ada|ga ada|gak ada|nggak ada|no|tidak punya)\b.{0,15}(colokan|stop.?kontak|outlet|colok|listrik)\b/i,
  },
];

// ─── Noise level ──────────────────────────────────────────────────────────────

const NOISE_RULES: KeywordRule[] = [
  {
    dimension: "noise",
    value: "quiet",
    sentiment: "positive",
    pattern: /\b(sepi|tenang|kondusif|hening|senyap|quiet|peaceful|calm|tranquil|nyaman buat (kerja|wfc|nugas))\b/i,
  },
  {
    dimension: "noise",
    value: "moderate",
    sentiment: "neutral",
    pattern: /\b(lumayan (ramai|sepi)|cukup (tenang|rame)|not too (loud|quiet)|moderate noise|suasana (oke|ok|nyaman))\b/i,
  },
  {
    dimension: "noise",
    value: "loud",
    sentiment: "negative",
    pattern: /\b(rame|ramai|berisik|ribut|bising|gaduh|noisy|loud|crowded|hectic)\b/i,
    // Don't flag "rame tapi approved" as negative for WFC — curator already filtered
    negate: /rame.{0,20}(tapi|but|tetap|still).{0,20}(approved|oke|ok|bagus)/i,
  },
  {
    dimension: "crowdedness",
    value: "crowded",
    sentiment: "negative",
    pattern: /\b(penuh|full|antri|waiting|queue|susah dapat (tempat|meja|kursi)|full house)\b/i,
  },
];

// ─── Seating ──────────────────────────────────────────────────────────────────

const SEATING_RULES: KeywordRule[] = [
  {
    dimension: "seating_capacity",
    value: "large",
    sentiment: "positive",
    pattern: /\b(luas|spacious|gedung (besar|gede)|tempat (luas|besar|gede|lebar)|banyak (meja|kursi|tempat|seat)|lots of (seats|tables|space))\b/i,
  },
  {
    dimension: "seating_capacity",
    value: "small",
    sentiment: "neutral",
    pattern: /\b(kecil|sempit|cozy|intimate|few (seats|tables)|limited (seating|seats)|tempat (kecil|sempit|terbatas))\b/i,
  },
  {
    dimension: "time_limit",
    value: "true",
    sentiment: "negative",
    pattern: /\b(batas waktu|time.?limit|dibatasi|ada (batasan|batas) (waktu|jam)|hanya \d+ jam|only \d+ hour|max \d+ hour)\b/i,
  },
];

// ─── Prayer room ──────────────────────────────────────────────────────────────

const PRAYER_RULES: KeywordRule[] = [
  {
    dimension: "prayer_room",
    value: "true",
    sentiment: "positive",
    pattern: /\b(mushola|musola|musholla|prayer.?room|sholat|salat|sajadah|tempat (ibadah|sholat|salat))\b/i,
  },
  {
    dimension: "prayer_room",
    value: "small",
    sentiment: "neutral",
    pattern: /\b(mushola|musola).{0,30}(kecil|sempit|xs|mini|1 orang|satu orang|muat \d+ orang)\b/i,
  },
  {
    dimension: "prayer_room",
    value: "basement",
    sentiment: "neutral",
    pattern: /\b(mushola|musola).{0,30}(basement|bawah|lantai (b|bawah|1))\b/i,
  },
];

// ─── Parking ──────────────────────────────────────────────────────────────────

const PARKING_RULES: KeywordRule[] = [
  {
    dimension: "parking",
    value: "free",
    sentiment: "positive",
    pattern: /\b(parkir (gratis|free|mudah|luas|lapang|gampang|oke)|free parking|lahan parkir (luas|banyak|ada))\b/i,
  },
  {
    dimension: "parking",
    value: "paid",
    sentiment: "neutral",
    pattern: /\b(parkir (berbayar|bayar|valet|mahal)|paid parking|parkir (susah|sempit|terbatas|dikit))\b/i,
  },
  {
    dimension: "parking",
    value: "none",
    sentiment: "negative",
    pattern: /\b(tidak ada parkir|ga ada parkir|no parking|parkir (nggak ada|ga ada|tidak ada))\b/i,
  },
];

// ─── Food ─────────────────────────────────────────────────────────────────────

const FOOD_RULES: KeywordRule[] = [
  {
    dimension: "food",
    value: "good",
    sentiment: "positive",
    pattern: /\b(makanan (enak|lezat|good|great|recommended|oke)|food (good|great|tasty|nice|recommended)|menu (enak|good|banyak|variatif)|makan (enak|kenyang))\b/i,
  },
  {
    dimension: "food",
    value: "poor",
    sentiment: "negative",
    pattern: /\b(makanan (kurang|biasa|hambar|ga enak|tidak enak)|food (bad|mediocre|average|disappointing|bland))\b/i,
  },
  {
    dimension: "food",
    value: "available",
    sentiment: "neutral",
    pattern: /\b(ada (makanan|food)|serve (food|meal)|menyajikan (makanan|menu))\b/i,
  },
];

// ─── Price ────────────────────────────────────────────────────────────────────

const PRICE_RULES: KeywordRule[] = [
  {
    dimension: "price",
    value: "budget",
    sentiment: "positive",
    pattern: /\b(murah|terjangkau|budget.?friendly|harga (terjangkau|murah|oke|ramah)|affordable|cheap|worth|value for money)\b/i,
  },
  {
    dimension: "price",
    value: "expensive",
    sentiment: "negative",
    pattern: /\b(mahal|pricey|overpriced|harga (mahal|tinggi|lumayan mahal)|kantong (bolong|tipis))\b/i,
  },
];

// ─── All rules ────────────────────────────────────────────────────────────────

export const ALL_RULES: KeywordRule[] = [
  ...WIFI_RULES,
  ...PLUGS_RULES,
  ...NOISE_RULES,
  ...SEATING_RULES,
  ...PRAYER_RULES,
  ...PARKING_RULES,
  ...FOOD_RULES,
  ...PRICE_RULES,
];
