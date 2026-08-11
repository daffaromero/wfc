/**
 * scripts/lib/geo.ts
 *
 * Coordinate helpers. Kept dependency-free so both the Places API client and
 * the DB-side dedup logic can use it without dragging the other along.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance between two coordinates, in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
