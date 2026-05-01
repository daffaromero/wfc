import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Place, PlaceFilters } from "../types/place";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
  if (!speed) return "Unknown";
  return { slow: "Slow", moderate: "Moderate", fast: "Fast" }[speed];
}

export function noiseLevelColor(level: "quiet" | "moderate" | "loud"): string {
  return {
    quiet: "bg-emerald-100 text-emerald-800",
    moderate: "bg-amber-100 text-amber-800",
    loud: "bg-red-100 text-red-800",
  }[level];
}

export function wifiSpeedColor(speed?: "slow" | "moderate" | "fast"): string {
  if (!speed) return "bg-stone-100 text-stone-600";
  return {
    slow: "bg-red-100 text-red-700",
    moderate: "bg-amber-100 text-amber-800",
    fast: "bg-emerald-100 text-emerald-800",
  }[speed];
}

export function filterPlaces(places: Place[], filters: PlaceFilters): Place[] {
  return places.filter((p) => {
    if (filters.city !== "all" && p.city !== filters.city) return false;
    if (filters.wifiAvailable && !p.wfc.wifi.available) return false;
    if (filters.plugs !== "any" && p.wfc.plugs !== filters.plugs) return false;
    if (filters.prayerRoom === true && !p.wfc.prayerRoom) return false;
    if (filters.noiseLevel !== "any" && p.wfc.noiseLevel !== filters.noiseLevel)
      return false;
    if (filters.parking === true && p.wfc.parking === "none") return false;
    if (p.wfc.menu.priceRange > filters.maxPriceRange) return false;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const haystack = [p.name, p.area, p.address, ...p.tags].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function cityLabel(city: Place["city"]): string {
  return city === "jakarta" ? "Jakarta" : "Yogyakarta";
}
