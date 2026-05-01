import { useState, useEffect, useRef } from "react";
import type { Place, PlaceFilters } from "../types/place";

function buildParams(filters: PlaceFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.city !== "all") p.set("city", filters.city);
  if (filters.wifiAvailable) p.set("wifi", "true");
  if (filters.plugs !== "any") p.set("plugs", filters.plugs);
  if (filters.noiseLevel !== "any") p.set("noise", filters.noiseLevel);
  if (filters.prayerRoom !== null) p.set("prayer_room", String(filters.prayerRoom));
  if (filters.parking !== null) p.set("parking", String(filters.parking));
  if (filters.maxPriceRange < 4) p.set("max_price", String(filters.maxPriceRange));
  if (filters.query.trim()) p.set("q", filters.query.trim());
  return p;
}

export interface UsePlacesResult {
  places: Place[];
  loading: boolean;
  error: string | null;
}

export function usePlaces(filters: PlaceFilters): UsePlacesResult {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetch(`/api/places?${buildParams(filters)}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`API error ${r.status}`);
        return r.json() as Promise<Place[]>;
      })
      .then((data) => {
        setPlaces(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [
    filters.city,
    filters.wifiAvailable,
    filters.plugs,
    filters.noiseLevel,
    filters.prayerRoom,
    filters.parking,
    filters.maxPriceRange,
    filters.query,
  ]);

  return { places, loading, error };
}
