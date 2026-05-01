import { Wifi, WifiOff, Plug, Star, MapPin } from "lucide-react";
import { Link } from "react-router";
import type { Place } from "../types/place";
import { Badge } from "./Badge";
import {
  cn,
  noiseLevelColor,
  wifiSpeedColor,
  wifiSpeedLabel,
  cityLabel,
} from "../lib/utils";

interface PlaceCardProps {
  place: Place;
}

const PRICE_SYMBOLS = ["", "Rp", "Rp Rp", "Rp Rp Rp", "Rp Rp Rp Rp"];

export function PlaceCard({ place }: PlaceCardProps) {
  const { wfc } = place;
  const coverPhoto = place.photos[0];

  return (
    <Link
      to={`/place/${place.id}`}
      className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-stone-200 hover:border-amber-300 hover:shadow-lg transition-all duration-200"
    >
      {/* Cover photo */}
      <div className="relative h-44 overflow-hidden bg-stone-100">
        {coverPhoto ? (
          <img
            src={coverPhoto}
            alt={place.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400">
            No photo
          </div>
        )}
        {/* City pill */}
        <span className="absolute top-3 left-3 bg-white/90 backdrop-blur text-stone-700 text-xs font-medium px-2 py-1 rounded-full">
          {cityLabel(place.city)}
        </span>
        {/* Price range */}
        <span className="absolute top-3 right-3 bg-white/90 backdrop-blur text-amber-700 text-xs font-semibold px-2 py-1 rounded-full">
          {PRICE_SYMBOLS[wfc.menu.priceRange]}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Name + area */}
        <div>
          <h3 className="font-semibold text-stone-900 text-base leading-snug group-hover:text-amber-700 transition-colors">
            {place.name}
          </h3>
          <p className="text-stone-500 text-sm flex items-center gap-1 mt-0.5">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            {place.area}
          </p>
        </div>

        {/* Google rating */}
        {place.googleRating && (
          <div className="flex items-center gap-1 text-sm text-stone-600">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="font-medium">{place.googleRating.toFixed(1)}</span>
            <span className="text-stone-400">
              ({place.totalRatings?.toLocaleString()})
            </span>
          </div>
        )}

        {/* Key WFC badges */}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {/* WiFi */}
          {wfc.wifi.available ? (
            <Badge className={cn("gap-1", wifiSpeedColor(wfc.wifi.speed))}>
              <Wifi className="w-3 h-3" />
              {wifiSpeedLabel(wfc.wifi.speed)}
            </Badge>
          ) : (
            <Badge className="bg-stone-100 text-stone-500">
              <WifiOff className="w-3 h-3" />
              No WiFi
            </Badge>
          )}

          {/* Plugs */}
          {wfc.plugs !== "none" && (
            <Badge
              className={cn(
                wfc.plugs === "ample"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              )}
            >
              <Plug className="w-3 h-3" />
              {wfc.plugs === "ample" ? "Ample plugs" : "Some plugs"}
            </Badge>
          )}

          {/* Noise */}
          <Badge className={noiseLevelColor(wfc.noiseLevel)}>
            {wfc.noiseLevel.charAt(0).toUpperCase() + wfc.noiseLevel.slice(1)}
          </Badge>

          {/* Prayer room */}
          {wfc.prayerRoom && (
            <Badge className="bg-teal-100 text-teal-800">Prayer room</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
