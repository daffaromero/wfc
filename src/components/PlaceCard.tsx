import { Wifi, WifiOff, Plug, Star, MapPin } from "lucide-react";
import { Link } from "react-router";
import type { Place } from "../types/place";
import { Badge } from "@/components/ui/badge";
import {
  cn,
  noiseLevelVariant,
  wifiSpeedVariant,
  wifiSpeedLabel,
  plugsVariant,
  cityLabel,
} from "@/lib/utils";

interface PlaceCardProps {
  place: Place;
}

const PRICE_SYMBOLS = ["", "Rp", "Rp Rp", "Rp Rp Rp", "Rp Rp Rp Rp"];

export function PlaceCard({ place }: PlaceCardProps) {
  const { wfc } = place;
  const coverPhoto = place.photos[0];

  return (
    <Link to={`/place/${place.id}`} className="group block">
      {/* Fills its grid cell directly — no border/radius, grid gap-px creates the lines */}
      <div className="overflow-hidden hover:bg-background/10 transition-colors duration-150 bg-background/6 h-full">
        {/* Cover photo */}
        <div className="relative h-44 overflow-hidden bg-background/10">
          {coverPhoto ? (
            <img
              src={coverPhoto}
              alt={place.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-background/30 text-sm">
              No photo
            </div>
          )}
          {/* City pill */}
          <span
            className={cn(
              "absolute top-0 left-0 text-white text-xs font-bold px-2.5 py-1.5",
              place.city === "jakarta"
                ? "bg-[var(--color-wfc-blue)]"
                : "bg-[var(--color-wfc-green)]"
            )}
          >
            {cityLabel(place.city)}
          </span>
          {/* Price range */}
          <span className="absolute top-0 right-0 bg-black/60 text-white text-xs font-bold px-2.5 py-1.5">
            {PRICE_SYMBOLS[wfc.menu.priceRange]}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 p-4 gap-3">
          {/* Name + area */}
          <div>
            <h3 className="font-bold text-background text-base leading-snug">
              {place.name}
            </h3>
            <p className="text-background/40 text-sm flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              {place.area}
            </p>
          </div>

          {/* Google rating */}
          {place.googleRating && (
            <div className="flex items-center gap-1 text-sm text-background/40">
              <Star className="w-3.5 h-3.5 fill-[var(--color-wfc-amber)] text-[var(--color-wfc-amber)]" />
              <span className="font-medium text-background/80">{place.googleRating.toFixed(1)}</span>
              <span>({place.totalRatings?.toLocaleString()})</span>
            </div>
          )}

          {/* Key WFC badges */}
          <div className="flex flex-wrap gap-1 mt-auto">
            {wfc.wifi.available ? (
              <Badge className={cn("rounded-none text-xs", wifiSpeedVariant(wfc.wifi.speed))}>
                <Wifi className="w-3 h-3" />
                {wifiSpeedLabel(wfc.wifi.speed)}
              </Badge>
            ) : (
              <Badge className="rounded-none text-xs bg-background/10 text-background/40 border-0">
                <WifiOff className="w-3 h-3" />
                No WiFi
              </Badge>
            )}
            {wfc.plugs !== "none" && (
              <Badge className={cn("rounded-none text-xs", plugsVariant(wfc.plugs))}>
                <Plug className="w-3 h-3" />
                {wfc.plugs === "ample" ? "Ample plugs" : "Some plugs"}
              </Badge>
            )}
            <Badge className={cn("rounded-none text-xs", noiseLevelVariant(wfc.noiseLevel))}>
              {wfc.noiseLevel.charAt(0).toUpperCase() + wfc.noiseLevel.slice(1)}
            </Badge>
            {wfc.prayerRoom && (
              <Badge className="rounded-none text-xs bg-[var(--color-wfc-teal)] text-white border-0">
                Prayer room
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
