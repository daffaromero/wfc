import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Place, PlaceFilters } from "../types/place";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function priceRangeLabel(range: 1 | 2 | 3 | 4): string {
  return "Rp".repeat(range);
}

export function priceRangeText(range: 1 | 2 | 3 | 4): string {
  const map = {
    1: "Budget (< 30k)",
    2: "Mid-range (30–60k)",
    3: "Upper-mid (60–100k)",
    4: "Premium (> 100k)",
  } as const;
  return map[range];
}

export function wifiSpeedLabel(speed?: "slow" | "moderate" | "fast"): string {
  if (!speed) return "WiFi";
  return { slow: "Slow WiFi", moderate: "OK WiFi", fast: "Fast WiFi" }[speed];
}

export function cityLabel(city: string): string {
  return city === "jakarta" ? "Jakarta" : "Yogyakarta";
}

// ─── Semantic badge variants ──────────────────────────────────────────────
// Returns className strings that map to our WFC semantic palette in index.css

export function noiseLevelVariant(level: "quiet" | "moderate" | "loud"): string {
  return {
    quiet:    "bg-[var(--color-wfc-green)] text-white",
    moderate: "bg-[var(--color-wfc-amber)] text-white",
    loud:     "bg-[var(--color-wfc-red)] text-white",
  }[level];
}

/** @deprecated use noiseLevelVariant */
export function noiseLevelColor(level: "quiet" | "moderate" | "loud"): string {
  return noiseLevelVariant(level);
}

export function wifiSpeedVariant(speed?: "slow" | "moderate" | "fast"): string {
  if (!speed) return "bg-muted text-muted-foreground";
  return {
    slow:     "bg-[var(--color-wfc-red)] text-white",
    moderate: "bg-[var(--color-wfc-amber)] text-white",
    fast:     "bg-[var(--color-wfc-green)] text-white",
  }[speed];
}

/** @deprecated use wifiSpeedVariant */
export function wifiSpeedColor(speed?: "slow" | "moderate" | "fast"): string {
  return wifiSpeedVariant(speed);
}

export function plugsVariant(plugs: "none" | "limited" | "ample"): string {
  return {
    ample:   "bg-[var(--color-wfc-green)] text-white",
    limited: "bg-[var(--color-wfc-amber)] text-white",
    none:    "bg-[var(--color-wfc-red)] text-white",
  }[plugs];
}

// ─── Filter logic (still used by API query builder) ──────────────────────

export function filterPlaces(places: Place[], filters: PlaceFilters): Place[] {
  return places.filter((p) => {
    if (filters.city !== "all" && p.city !== filters.city) return false;
    if (filters.wifiAvailable && !p.wfc.wifi.available) return false;
    if (filters.plugs !== "any" && p.wfc.plugs !== filters.plugs) return false;
    if (filters.prayerRoom === true && !p.wfc.prayerRoom) return false;
    if (filters.noiseLevel !== "any" && p.wfc.noiseLevel !== filters.noiseLevel) return false;
    if (filters.parking === true && p.wfc.parking === "none") return false;
    if (p.wfc.menu.priceRange > filters.maxPriceRange) return false;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.area.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}
