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

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        totalCount={places.length}
        filteredCount={places.length}
      />

      {/* Grid */}
      {loading ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">Loading cafes…</p>
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-500">
          <p className="text-lg font-medium">Failed to load cafes.</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : places.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">No cafes match your filters.</p>
          <p className="text-sm mt-1 text-muted-foreground">Try loosening the criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {places.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}
    </main>
  );
}
