import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const places = sqliteTable("places", {
  // ─── Identity ────────────────────────────────────────────────────────────
  id:            text("id").primaryKey(),
  name:          text("name").notNull(),
  city:          text("city").notNull(),          // "jakarta" | "yogyakarta"
  area:          text("area").notNull().default(""),
  address:       text("address").notNull().default(""),
  lat:           real("lat").notNull().default(0),
  lng:           real("lng").notNull().default(0),
  googlePlaceId: text("google_place_id"),
  photos:        text("photos").notNull().default("[]"),        // JSON string[]
  googleRating:  real("google_rating"),
  totalRatings:  integer("total_ratings"),
  openingHours:  text("opening_hours").notNull().default("[]"), // JSON string[]
  website:       text("website"),
  instagram:     text("instagram"),
  curatorNote:   text("curator_note"),

  // ─── WFC features (flat for SQL filtering) ───────────────────────────────
  wfcPlugs:              text("wfc_plugs").notNull().default("limited"),
  wfcPrayerRoom:         integer("wfc_prayer_room", { mode: "boolean" }).notNull().default(false),
  wfcNoiseLevel:         text("wfc_noise_level").notNull().default("moderate"),
  wfcParking:            text("wfc_parking").notNull().default("none"),
  wfcWifiAvailable:      integer("wfc_wifi_available", { mode: "boolean" }).notNull().default(true),
  wfcWifiSpeed:          text("wfc_wifi_speed"),                // null if unknown
  wfcWifiPassword:       integer("wfc_wifi_password", { mode: "boolean" }).notNull().default(true),
  wfcSeatingTypes:       text("wfc_seating_types").notNull().default("[]"),  // JSON string[]
  wfcSeatingCapacity:    text("wfc_seating_capacity").notNull().default("medium"),
  wfcTimeLimitHours:     real("wfc_time_limit_hours"),          // null = no limit
  wfcCoffeeSpecialty:    integer("wfc_coffee_specialty", { mode: "boolean" }).notNull().default(false),
  wfcNonCoffee:          integer("wfc_non_coffee", { mode: "boolean" }).notNull().default(true),
  wfcFood:               integer("wfc_food", { mode: "boolean" }).notNull().default(false),
  wfcMenuHighlights:     text("wfc_menu_highlights").notNull().default("[]"), // JSON string[]
  wfcPriceRange:         integer("wfc_price_range").notNull().default(2),     // 1–4

  // ─── Meta ─────────────────────────────────────────────────────────────────
  tags:          text("tags").notNull().default("[]"),           // JSON string[]
  lastVerified:  text("last_verified").notNull().default(""),
  createdAt:     text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt:     text("updated_at").notNull().default(sql`(current_timestamp)`),
});

export type PlaceRow = typeof places.$inferSelect;
export type PlaceInsert = typeof places.$inferInsert;
