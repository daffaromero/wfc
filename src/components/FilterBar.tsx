import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
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

  return (
    <div className="space-y-3">
      {/* Search + reset row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search cafes, areas, tags…"
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            className="pl-9 rounded-md"
          />
        </div>
        {/* Always rendered to prevent layout shift; hidden when no active filters */}
        <button
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
          aria-hidden={!hasActiveFilters}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2.5 rounded-md border border-border bg-background text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors",
            !hasActiveFilters && "invisible pointer-events-none"
          )}
        >
          <X className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      {/* City tabs */}
      <div className="flex gap-0.5 bg-muted p-0.5 rounded-md w-fit">
        {(["all", "jakarta", "yogyakarta"] as const).map((c) => (
          <button
            key={c}
            onClick={() => set("city", c)}
            className={cn(
              "px-4 py-1.5 rounded text-sm font-medium transition-all",
              filters.city === c
                ? "bg-[var(--color-wfc-blue)] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {c === "all" ? "All" : c === "jakarta" ? "Jakarta" : "Yogyakarta"}
          </button>
        ))}
      </div>

      {/* Filter chips row */}
      <div className="flex flex-wrap gap-2 items-center">
        <SlidersHorizontal className="w-4 h-4 text-muted-foreground flex-shrink-0" />

        {/* WiFi */}
        <FilterChip
          active={filters.wifiAvailable}
          activeColor="green"
          onClick={() => set("wifiAvailable", !filters.wifiAvailable)}
        >
          WiFi available
        </FilterChip>

        {/* Plugs */}
        <select
          value={filters.plugs}
          onChange={(e) => set("plugs", e.target.value as PlaceFilters["plugs"])}
          className={cn(
            "px-3 py-1.5 rounded text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer",
            filters.plugs !== "any"
              ? "bg-[var(--color-wfc-green)] text-white border-transparent"
              : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
          )}
        >
          <option value="any">Any plugs</option>
          <option value="ample">Ample plugs</option>
          <option value="limited">Some plugs</option>
          <option value="none">No plugs</option>
        </select>

        {/* Noise */}
        <select
          value={filters.noiseLevel}
          onChange={(e) => set("noiseLevel", e.target.value as PlaceFilters["noiseLevel"])}
          className={cn(
            "px-3 py-1.5 rounded text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer",
            filters.noiseLevel === "quiet"
              ? "bg-[var(--color-wfc-green)] text-white border-transparent"
              : filters.noiseLevel === "moderate"
              ? "bg-[var(--color-wfc-amber)] text-white border-transparent"
              : filters.noiseLevel === "loud"
              ? "bg-[var(--color-wfc-red)] text-white border-transparent"
              : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
          )}
        >
          <option value="any">Any noise</option>
          <option value="quiet">Quiet</option>
          <option value="moderate">Moderate</option>
          <option value="loud">Loud/Lively</option>
        </select>

        {/* Prayer room */}
        <FilterChip
          active={filters.prayerRoom === true}
          activeColor="teal"
          onClick={() => set("prayerRoom", filters.prayerRoom === true ? null : true)}
        >
          Prayer room
        </FilterChip>

        {/* Parking */}
        <FilterChip
          active={filters.parking === true}
          activeColor="green"
          onClick={() => set("parking", filters.parking === true ? null : true)}
        >
          Has parking
        </FilterChip>

        {/* Price */}
        <select
          value={filters.maxPriceRange}
          onChange={(e) =>
            set("maxPriceRange", Number(e.target.value) as PlaceFilters["maxPriceRange"])
          }
          className={cn(
            "px-3 py-1.5 rounded text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer",
            filters.maxPriceRange !== 4
              ? "bg-[var(--color-wfc-amber)] text-white border-transparent"
              : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
          )}
        >
          <option value={4}>Any price</option>
          {([1, 2, 3] as const).map((v) => (
            <option key={v} value={v}>
              Up to {PRICE_LABELS[v]}
            </option>
          ))}
        </select>
      </div>

      {/* Result count */}
      <p className="text-sm text-muted-foreground">
        {filteredCount === totalCount ? (
          <span>{totalCount} places</span>
        ) : (
          <span>
            <span className="font-medium text-foreground">{filteredCount}</span> of {totalCount} places
          </span>
        )}
      </p>
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
    green: "bg-[var(--color-wfc-green)] text-white border-transparent",
    teal:  "bg-[var(--color-wfc-teal)] text-white border-transparent",
    blue:  "bg-[var(--color-wfc-blue)] text-white border-transparent",
    amber: "bg-[var(--color-wfc-amber)] text-white border-transparent",
    red:   "bg-[var(--color-wfc-red)] text-white border-transparent",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded text-sm border font-medium transition-all",
        active
          ? activeClasses[activeColor]
          : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
