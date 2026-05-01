import { Hono } from "hono";
import { and, eq, like, lte } from "drizzle-orm";
import { db } from "../db/client";
import { places as placesTable } from "../db/schema";
import type { PlaceRow } from "../db/schema";
import type {
  Place,
  City,
  NoiseLevel,
  PlugAvailability,
  WifiSpeed,
  ParkingType,
  SeatingType,
} from "../../src/types/place";

export const placesRouter = new Hono();

// ─── Row → Place type mapper ───────────────────────────────────────────────

function rowToPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    city: row.city as City,
    area: row.area,
    address: row.address,
    coordinates: { lat: row.lat, lng: row.lng },
    googlePlaceId: row.googlePlaceId ?? undefined,
    photos: JSON.parse(row.photos) as string[],
    googleRating: row.googleRating ?? undefined,
    totalRatings: row.totalRatings ?? undefined,
    openingHours: JSON.parse(row.openingHours) as string[],
    website: row.website ?? undefined,
    instagram: row.instagram ?? undefined,
    curatorNote: row.curatorNote ?? undefined,
    wfc: {
      seating: {
        types: JSON.parse(row.wfcSeatingTypes) as SeatingType[],
        capacity: row.wfcSeatingCapacity as "small" | "medium" | "large",
        timeLimitHours: row.wfcTimeLimitHours ?? undefined,
      },
      wifi: {
        available: row.wfcWifiAvailable,
        speed: (row.wfcWifiSpeed as WifiSpeed) ?? undefined,
        requiresPassword: row.wfcWifiPassword,
      },
      plugs: row.wfcPlugs as PlugAvailability,
      prayerRoom: row.wfcPrayerRoom,
      noiseLevel: row.wfcNoiseLevel as NoiseLevel,
      parking: row.wfcParking as ParkingType,
      menu: {
        coffeeSpecialty: row.wfcCoffeeSpecialty,
        nonCoffee: row.wfcNonCoffee,
        food: row.wfcFood,
        highlights: JSON.parse(row.wfcMenuHighlights) as string[],
        priceRange: row.wfcPriceRange as 1 | 2 | 3 | 4,
      },
    },
    tags: JSON.parse(row.tags) as string[],
    lastVerified: row.lastVerified,
  };
}

// ─── GET /api/places ───────────────────────────────────────────────────────

placesRouter.get("/", async (c) => {
  const { city, wifi, plugs, noise, prayer_room, parking, max_price, q } =
    c.req.query();

  const conditions = [];

  if (city && city !== "all") {
    conditions.push(eq(placesTable.city, city));
  }
  if (wifi === "true") {
    conditions.push(eq(placesTable.wfcWifiAvailable, true));
  }
  if (plugs && plugs !== "any") {
    conditions.push(eq(placesTable.wfcPlugs, plugs));
  }
  if (noise && noise !== "any") {
    conditions.push(eq(placesTable.wfcNoiseLevel, noise));
  }
  if (prayer_room === "true") {
    conditions.push(eq(placesTable.wfcPrayerRoom, true));
  }
  if (parking === "true") {
    // any parking type other than "none"
    conditions.push(eq(placesTable.wfcParking, "free"));
  }
  if (max_price) {
    conditions.push(lte(placesTable.wfcPriceRange, parseInt(max_price, 10)));
  }
  if (q) {
    conditions.push(like(placesTable.name, `%${q}%`));
  }

  const rows = await db
    .select()
    .from(placesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return c.json(rows.map(rowToPlace));
});

// ─── GET /api/places/:id ───────────────────────────────────────────────────

placesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await db
    .select()
    .from(placesTable)
    .where(eq(placesTable.id, id))
    .get();

  if (!row) {
    return c.json({ error: "Place not found" }, 404);
  }

  return c.json(rowToPlace(row));
});
