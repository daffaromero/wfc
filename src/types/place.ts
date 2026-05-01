export type City = "jakarta" | "yogyakarta";
export type NoiseLevel = "quiet" | "moderate" | "loud";
export type PlugAvailability = "none" | "limited" | "ample";
export type WifiSpeed = "slow" | "moderate" | "fast";
export type ParkingType = "none" | "paid" | "free";
export type SeatingType = "solo" | "communal" | "sofa" | "bar" | "outdoor";

export interface WfcFeatures {
  seating: {
    types: SeatingType[];
    capacity: "small" | "medium" | "large";
    /** Maximum hours you can stay; undefined = no limit */
    timeLimitHours?: number;
  };
  wifi: {
    available: boolean;
    speed?: WifiSpeed;
    requiresPassword: boolean;
  };
  plugs: PlugAvailability;
  prayerRoom: boolean;
  noiseLevel: NoiseLevel;
  parking: ParkingType;
  menu: {
    coffeeSpecialty: boolean;
    nonCoffee: boolean;
    food: boolean;
    highlights?: string[];
    /** 1 = budget (< 30k IDR), 2 = mid (30–60k), 3 = upper (60–100k), 4 = premium (> 100k) */
    priceRange: 1 | 2 | 3 | 4;
  };
}

export interface Place {
  id: string;
  name: string;
  city: City;
  /** Neighbourhood / district, e.g. "Kemang", "Malioboro area" */
  area: string;
  address: string;
  coordinates: { lat: number; lng: number };
  googlePlaceId?: string;
  photos: string[];
  googleRating?: number;
  totalRatings?: number;
  /** Human-readable lines, e.g. ["Mon–Fri: 08:00–22:00"] */
  openingHours: string[];
  website?: string;
  instagram?: string;
  wfc: WfcFeatures;
  tags: string[];
  /** ISO date when WFC info was last verified */
  lastVerified: string;
}

export interface PlaceFilters {
  city: City | "all";
  wifiAvailable: boolean;
  plugs: PlugAvailability | "any";
  prayerRoom: boolean | null;
  noiseLevel: NoiseLevel | "any";
  parking: boolean | null;
  maxPriceRange: 1 | 2 | 3 | 4;
  query: string;
}
