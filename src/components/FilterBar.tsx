import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface FilterBarProps {
  filters: PlaceFilters;
  onChange: (f: PlaceFilters) => void;
  totalCount: number;
  filteredCount: number;
}

const PRICE_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Rp",
  2: "Rp Rp",
  3: "Rp Rp Rp",
  4: "Rp Rp Rp Rp",
};

export function FilterBar({ filters, onChange, totalCount, filteredCount }: FilterBarProps) {
  const hasActiveFilters =
    filters.city !== "all" ||
    filters.wifiAvailable ||
    filters.plugs !== "any" ||
    filters.prayerRoom !== null ||
    filters.noiseLevel !== "any" ||
    filters.parking !== null ||
    filters.maxPriceRange !== 4 ||
    filters.query !== "";

  function set<K extends keyof PlaceFilters>(key: K, value: PlaceFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  // Dark-canvas variants
  const inactiveChip = "border border-background/20 text-background/75 hover:text-background hover:border-background/50 transition-colors";

  return (
    <div className="space-y-0">
      {/* Search row */}
      <div className="flex gap-2 pb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-background/60 pointer-events-none" />
          <input
            type="text"
            placeholder="Search cafes, areas, tags…"
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background/8 border border-background/20 text-background placeholder:text-background/60 text-sm focus:outline-none focus:border-background/50 transition-colors"
          />
        </div>
        <button
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
          aria-hidden={!hasActiveFilters}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
            inactiveChip,
            !hasActiveFilters && "invisible pointer-events-none"
          )}
        >
          <X className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      {/* City tabs + filter chips — single scrollable row */}
      <div className="flex border-t border-b border-background/15 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
        {/* City tabs */}
        {(["all", "jakarta", "yogyakarta"] as const).map((c) => (
          <button
            key={c}
            onClick={() => set("city", c)}
            className={cn(
              "flex-shrink-0 px-4 py-2 text-sm font-semibold transition-all border-r border-background/15",
              filters.city === c
                ? c === "jakarta"
                  ? "bg-[var(--color-wfc-blue)] text-white"
                  : c === "yogyakarta"
                  ? "bg-[var(--color-wfc-green)] text-white"
                  : "bg-background/20 text-background"
                : "text-background/65 hover:text-background hover:bg-background/8"
            )}
          >
            {c === "all" ? "All" : c === "jakarta" ? "Jakarta" : "Yogyakarta"}
          </button>
        ))}

        {/* Divider between city and filter chips */}
        <span className="w-px bg-background/25 flex-shrink-0" />

        {/* Filter chips — inline with city tabs */}
        <FilterChip active={filters.wifiAvailable} activeColor="green"
          onClick={() => set("wifiAvailable", !filters.wifiAvailable)}>
          WiFi
        </FilterChip>

        <select
          value={filters.plugs}
          onChange={(e) => set("plugs", e.target.value as PlaceFilters["plugs"])}
          className={cn("flex-shrink-0 px-3 py-2 text-sm border-r font-medium bg-foreground cursor-pointer focus:outline-none",
            filters.plugs !== "any"
              ? "bg-[var(--color-wfc-green)] text-white border-transparent"
              : "border-background/20 text-background/75 hover:text-background")}
        >
          <option value="any">Plugs ▾</option>
          <option value="ample">Ample plugs</option>
          <option value="limited">Some plugs</option>
          <option value="none">No plugs</option>
        </select>

        <select
          value={filters.noiseLevel}
          onChange={(e) => set("noiseLevel", e.target.value as PlaceFilters["noiseLevel"])}
          className={cn("flex-shrink-0 px-3 py-2 text-sm border-r font-medium bg-foreground cursor-pointer focus:outline-none",
            filters.noiseLevel === "quiet" ? "bg-[var(--color-wfc-green)] text-white border-transparent"
            : filters.noiseLevel === "moderate" ? "bg-[var(--color-wfc-amber)] text-white border-transparent"
            : filters.noiseLevel === "loud" ? "bg-[var(--color-wfc-red)] text-white border-transparent"
            : "border-background/20 text-background/75 hover:text-background")}
        >
          <option value="any">Noise ▾</option>
          <option value="quiet">Quiet</option>
          <option value="moderate">Moderate</option>
          <option value="loud">Loud</option>
        </select>

        <FilterChip active={filters.prayerRoom === true} activeColor="teal"
          onClick={() => set("prayerRoom", filters.prayerRoom === true ? null : true)}>
          Prayer
        </FilterChip>

        <FilterChip active={filters.parking === true} activeColor="green"
          onClick={() => set("parking", filters.parking === true ? null : true)}>
          Parking
        </FilterChip>

        <select
          value={filters.maxPriceRange}
          onChange={(e) => set("maxPriceRange", Number(e.target.value) as PlaceFilters["maxPriceRange"])}
          className={cn("flex-shrink-0 px-3 py-2 text-sm font-medium bg-foreground cursor-pointer focus:outline-none",
            filters.maxPriceRange !== 4
              ? "bg-[var(--color-wfc-amber)] text-white border-transparent"
              : "border-l border-background/20 text-background/75 hover:text-background")}
        >
          <option value={4}>Price ▾</option>
          {([1, 2, 3] as const).map((v) => (
            <option key={v} value={v}>Up to {PRICE_LABELS[v]}</option>
          ))}
        </select>
      </div>

      {/* Result count */}
      <p className="text-xs text-background/65 font-medium py-2">
        {filteredCount === totalCount ? (
          <span>{totalCount} places</span>
        ) : (
          <span><span className="text-background">{filteredCount}</span> of {totalCount} places</span>
        )}
      </p>

      {/* Hard rule before grid */}
      <div className="border-t border-background/15" />
    </div>
  );
}

function FilterChip({
  active,
  activeColor = "blue",
  onClick,
  children,
}: {
  active: boolean;
  activeColor?: "green" | "teal" | "blue" | "amber" | "red";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeClasses: Record<string, string> = {
    green: "bg-[var(--color-wfc-green)] text-white",
    teal:  "bg-[var(--color-wfc-teal)] text-white",
    blue:  "bg-[var(--color-wfc-blue)] text-white",
    amber: "bg-[var(--color-wfc-amber)] text-white",
    red:   "bg-[var(--color-wfc-red)] text-white",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-shrink-0 px-3 py-2 text-sm font-semibold border-r border-background/15 transition-all",
        active
          ? activeClasses[activeColor]
          : "text-background/65 hover:text-background hover:bg-background/8"
      )}
    >
      {children}
    </button>
  );
}
