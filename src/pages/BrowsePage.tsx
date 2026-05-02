import { useState } from "react";
import { useSearchParams } from "react-router";
import { usePlaces } from "../hooks/usePlaces";
import { PlaceCard } from "../components/PlaceCard";
import { FilterBar } from "../components/FilterBar";
import type { PlaceFilters } from "../types/place";

const DEFAULT_FILTERS: PlaceFilters = {
  city: "all",
  wifiAvailable: false,
  plugs: "any",
  prayerRoom: null,
  noiseLevel: "any",
  parking: null,
  maxPriceRange: 4,
  query: "",
};

const CITY_META: Record<PlaceFilters["city"], { name: string; color: string }> = {
  all:        { name: "All cities",  color: "var(--background)" },
  jakarta:    { name: "Jakarta",     color: "var(--color-wfc-blue)" },
  yogyakarta: { name: "Yogyakarta",  color: "var(--color-wfc-green)" },
};

export function BrowsePage() {
  const [searchParams] = useSearchParams();
  const paramCity = searchParams.get("city") ?? "all";
  const initialCity = (["all", "jakarta", "yogyakarta"] as string[]).includes(paramCity)
    ? (paramCity as PlaceFilters["city"])
    : "all";

  const [filters, setFilters] = useState<PlaceFilters>({
    ...DEFAULT_FILTERS,
    city: initialCity,
  });
  const { places, loading, error } = usePlaces(filters);

  const meta = CITY_META[filters.city];

  return (
    <div className="bg-foreground min-h-screen">
      {/* City identity band */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-6">
        <p className="text-background/60 text-xs font-semibold uppercase tracking-[0.2em] mb-2">
          Work-friendly cafes · Indonesia
        </p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1
            className="text-6xl sm:text-7xl font-black tracking-tight leading-none"
            style={{ color: meta.color }}
          >
            {meta.name}
          </h1>
          {!loading && (
            <span className="text-background/70 font-medium text-lg mb-1 tabular-nums">
              {places.length} {places.length === 1 ? "cafe" : "cafes"}
            </span>
          )}
        </div>
      </div>
      {/* Hard rule between headline and content */}
      <div className="border-t border-background/15" />

      {/* Content — stays on dark canvas */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-12 space-y-4">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          totalCount={places.length}
          filteredCount={places.length}
        />

        {loading ? (
          <div className="text-center py-20">
            <p className="text-lg font-medium text-background/80">Loading cafes…</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-lg font-medium text-[var(--color-wfc-red)]">Failed to load cafes.</p>
            <p className="text-sm mt-1 text-background/70">{error}</p>
          </div>
        ) : places.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg font-medium text-background/80">No cafes match your filters.</p>
            <p className="text-sm mt-1 text-background/60">Try loosening the criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {places.map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
