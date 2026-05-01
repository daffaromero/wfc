#!/usr/bin/env bun
/**
 * scripts/db-seed.ts
 *
 * Seeds curated.db from the existing src/data/places.ts file.
 * Run once (or with --reset to wipe + reseed):
 *
 *   bun run db:seed
 *   bun run db:seed --reset
 */

import { db, sqlite } from "../server/db/client";
import { places as placesTable } from "../server/db/schema";
import { places as rawPlaces } from "../src/data/places";
import { eq } from "drizzle-orm";

const isReset = process.argv.includes("--reset");

// Create table if not exists (drizzle-kit push handles migrations, but
// this lets the seed script work standalone without running push first)
sqlite.run(`
  CREATE TABLE IF NOT EXISTS places (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    area TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    lat REAL NOT NULL DEFAULT 0,
    lng REAL NOT NULL DEFAULT 0,
    google_place_id TEXT,
    photos TEXT NOT NULL DEFAULT '[]',
    google_rating REAL,
    total_ratings INTEGER,
    opening_hours TEXT NOT NULL DEFAULT '[]',
    website TEXT,
    instagram TEXT,
    curator_note TEXT,
    wfc_plugs TEXT NOT NULL DEFAULT 'limited',
    wfc_prayer_room INTEGER NOT NULL DEFAULT 0,
    wfc_noise_level TEXT NOT NULL DEFAULT 'moderate',
    wfc_parking TEXT NOT NULL DEFAULT 'none',
    wfc_wifi_available INTEGER NOT NULL DEFAULT 1,
    wfc_wifi_speed TEXT,
    wfc_wifi_password INTEGER NOT NULL DEFAULT 1,
    wfc_seating_types TEXT NOT NULL DEFAULT '[]',
    wfc_seating_capacity TEXT NOT NULL DEFAULT 'medium',
    wfc_time_limit_hours REAL,
    wfc_coffee_specialty INTEGER NOT NULL DEFAULT 0,
    wfc_non_coffee INTEGER NOT NULL DEFAULT 1,
    wfc_food INTEGER NOT NULL DEFAULT 0,
    wfc_menu_highlights TEXT NOT NULL DEFAULT '[]',
    wfc_price_range INTEGER NOT NULL DEFAULT 2,
    tags TEXT NOT NULL DEFAULT '[]',
    last_verified TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (current_timestamp),
    updated_at TEXT NOT NULL DEFAULT (current_timestamp)
  )
`);

if (isReset) {
  console.log("🗑️   Clearing existing places…");
  db.delete(placesTable).run();
}

console.log(`\n📦  Seeding ${rawPlaces.length} places into curated.db…\n`);

let inserted = 0;
let skipped = 0;

for (const place of rawPlaces) {
  // Skip if already exists (upsert-style: skip unless --reset)
  const existing = db
    .select({ id: placesTable.id })
    .from(placesTable)
    .where(eq(placesTable.id, place.id))
    .get();

  if (existing && !isReset) {
    console.log(`   ↩  ${place.name} — already in DB, skipping`);
    skipped++;
    continue;
  }

  db.insert(placesTable)
    .values({
      id: place.id,
      name: place.name,
      city: place.city,
      area: place.area,
      address: place.address,
      lat: place.coordinates.lat,
      lng: place.coordinates.lng,
      googlePlaceId: place.googlePlaceId ?? null,
      photos: JSON.stringify(place.photos),
      googleRating: place.googleRating ?? null,
      totalRatings: place.totalRatings ?? null,
      openingHours: JSON.stringify(place.openingHours),
      website: place.website ?? null,
      instagram: place.instagram ?? null,
      curatorNote: place.curatorNote ?? null,
      wfcPlugs: place.wfc.plugs,
      wfcPrayerRoom: place.wfc.prayerRoom,
      wfcNoiseLevel: place.wfc.noiseLevel,
      wfcParking: place.wfc.parking,
      wfcWifiAvailable: place.wfc.wifi.available,
      wfcWifiSpeed: place.wfc.wifi.speed ?? null,
      wfcWifiPassword: place.wfc.wifi.requiresPassword,
      wfcSeatingTypes: JSON.stringify(place.wfc.seating.types),
      wfcSeatingCapacity: place.wfc.seating.capacity,
      wfcTimeLimitHours: place.wfc.seating.timeLimitHours ?? null,
      wfcCoffeeSpecialty: place.wfc.menu.coffeeSpecialty,
      wfcNonCoffee: place.wfc.menu.nonCoffee,
      wfcFood: place.wfc.menu.food,
      wfcMenuHighlights: JSON.stringify(place.wfc.menu.highlights ?? []),
      wfcPriceRange: place.wfc.menu.priceRange,
      tags: JSON.stringify(place.tags),
      lastVerified: place.lastVerified,
    })
    .onConflictDoUpdate({
      target: placesTable.id,
      set: {
        name: place.name,
        updatedAt: new Date().toISOString(),
      },
    })
    .run();

  console.log(`   ✓  ${place.name} (${place.city})`);
  inserted++;
}

console.log(`\n✅  Done. ${inserted} inserted/updated, ${skipped} skipped.\n`);
