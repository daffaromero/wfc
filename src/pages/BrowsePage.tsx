import { useState } from "react";
import { places } from "../data/places";
import { filterPlaces } from "../lib/utils";
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
  const [filters, setFilters] = useState<PlaceFilters>(DEFAULT_FILTERS);
  const filtered = filterPlaces(places, filters);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Hero */}
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
          Work From Cafe
          <span className="text-amber-600"> Directory</span>
        </h1>
        <p className="text-stone-500 text-base sm:text-lg max-w-xl">
          Find the best cafes to work from across Jakarta and Yogyakarta — vetted
          for WiFi, plugs, noise, and more.
        </p>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        totalCount={places.length}
        filteredCount={filtered.length}
      />

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <p className="text-lg font-medium">No cafes match your filters.</p>
          <p className="text-sm mt-1">Try loosening the criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}
    </main>
  );
}
