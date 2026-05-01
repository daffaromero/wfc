import { Wifi, WifiOff, Plug, Star, MapPin } from "lucide-react";
import { Link } from "react-router";
import type { Place } from "../types/place";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
      <Card className="overflow-hidden border border-border hover:border-foreground/40 hover:shadow-lg transition-all duration-150 p-0 gap-0 rounded-lg">
        {/* Cover photo */}
        <div className="relative h-44 overflow-hidden bg-muted">
          {coverPhoto ? (
            <img
              src={coverPhoto}
              alt={place.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              No photo
            </div>
          )}
          {/* City pill — colored by city */}
          <span
            className={cn(
              "absolute top-3 left-3 text-white text-xs font-bold px-2 py-0.5 rounded",
              place.city === "jakarta"
                ? "bg-[var(--color-wfc-blue)]"
                : "bg-[var(--color-wfc-green)]"
            )}
          >
            {cityLabel(place.city)}
          </span>
          {/* Price range */}
          <span className="absolute top-3 right-3 bg-white/95 text-foreground text-xs font-bold px-2 py-0.5 rounded">
            {PRICE_SYMBOLS[wfc.menu.priceRange]}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 p-4 gap-3">
          {/* Name + area */}
          <div>
            <h3 className="font-bold text-foreground text-base leading-snug">
              {place.name}
            </h3>
            <p className="text-muted-foreground text-sm flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              {place.area}
            </p>
          </div>

          {/* Google rating */}
          {place.googleRating && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="w-3.5 h-3.5 fill-[var(--color-wfc-amber)] text-[var(--color-wfc-amber)]" />
              <span className="font-medium text-foreground">{place.googleRating.toFixed(1)}</span>
              <span>({place.totalRatings?.toLocaleString()})</span>
            </div>
          )}

          {/* Key WFC badges */}
          <div className="flex flex-wrap gap-1.5 mt-auto">
            {/* WiFi */}
            {wfc.wifi.available ? (
              <Badge className={cn("rounded", wifiSpeedVariant(wfc.wifi.speed))}>
                <Wifi className="w-3 h-3" />
                {wifiSpeedLabel(wfc.wifi.speed)}
              </Badge>
            ) : (
              <Badge className="rounded bg-secondary text-muted-foreground">
                <WifiOff className="w-3 h-3" />
                No WiFi
              </Badge>
            )}

            {/* Plugs */}
            {wfc.plugs !== "none" && (
              <Badge className={cn("rounded", plugsVariant(wfc.plugs))}>
                <Plug className="w-3 h-3" />
                {wfc.plugs === "ample" ? "Ample plugs" : "Some plugs"}
              </Badge>
            )}

            {/* Noise */}
            <Badge className={cn("rounded", noiseLevelVariant(wfc.noiseLevel))}>
              {wfc.noiseLevel.charAt(0).toUpperCase() + wfc.noiseLevel.slice(1)}
            </Badge>

            {/* Prayer room */}
            {wfc.prayerRoom && (
              <Badge className="rounded bg-[var(--color-wfc-teal-bg)] text-[var(--color-wfc-teal)]">
                Prayer room
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
