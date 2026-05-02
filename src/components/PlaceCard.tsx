import { Wifi, WifiOff, Plug, Star, MapPin, Moon, VolumeX, Volume1, Volume2 } from "lucide-react";
import { Link } from "react-router";
import type { Place } from "../types/place";
import {
  cn,
  wifiSpeedLabel,
  wifiSpeedColor,
  noiseLevelColor,
  plugsColor,
  cityLabel,
} from "@/lib/utils";

interface PlaceCardProps {
  place: Place;
}

const PRICE_LABELS = ["", "< Rp 50K", "Rp 50–100K", "Rp 100–200K", "> Rp 200K"];

export function PlaceCard({ place }: PlaceCardProps) {
  const { wfc } = place;
  const coverPhoto = place.photos[0];

  type StatCol = { color: string; icon?: React.ReactNode; label: string };
  const cols: StatCol[] = [];

  cols.push({
    color: wifiSpeedColor(wfc.wifi.available ? wfc.wifi.speed : undefined),
    icon: wfc.wifi.available ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />,
    label: wfc.wifi.available ? wifiSpeedLabel(wfc.wifi.speed) : "No WiFi",
  });

  if (wfc.plugs !== "none") {
    cols.push({
      color: plugsColor(wfc.plugs),
      icon: <Plug className="w-3 h-3" />,
      label: "Plugs",
    });
  }

  if (wfc.prayerRoom) {
    cols.push({ color: "var(--color-wfc-teal)", icon: <Moon className="w-3 h-3" />, label: "Musalla" });
  }

  const noiseIcon = wfc.noiseLevel === "quiet"
    ? <VolumeX className="w-3 h-3" />
    : wfc.noiseLevel === "moderate"
    ? <Volume1 className="w-3 h-3" />
    : <Volume2 className="w-3 h-3" />;

  cols.push({
    color: noiseLevelColor(wfc.noiseLevel),
    icon: noiseIcon,
    label: wfc.noiseLevel.charAt(0).toUpperCase() + wfc.noiseLevel.slice(1),
  });

  return (
    <Link to={`/place/${place.id}`} className="group block">
      <div className="flex flex-col border border-white/10" style={{ backgroundColor: "oklch(0.10 0 0)" }}>

        {/* ── Photo: fixed height ── */}
        <div className="relative h-36 overflow-hidden bg-white/5 flex-shrink-0">
          {coverPhoto ? (
            <img
              src={coverPhoto}
              alt={place.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
              No photo
            </div>
          )}
          {/* City — bottom-left of photo */}
          <span className={cn(
            "absolute bottom-0 left-0 px-2.5 py-1.5 text-white text-xs font-semibold",
            place.city === "jakarta"
              ? "bg-[var(--color-wfc-blue)]"
              : "bg-[var(--color-wfc-green)]"
          )}>
            {cityLabel(place.city)}
          </span>
          {/* Price — bottom-right of photo */}
          <span className="absolute bottom-0 right-0 px-2.5 py-1.5 text-white text-xs font-semibold bg-[var(--color-wfc-amber)]">
            {PRICE_LABELS[wfc.menu.priceRange]}
          </span>
        </div>

        {/* ── Body ── */}
        <div className="px-3 pt-2.5 pb-0">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-medium text-white text-base leading-snug">
              {place.name}
            </h3>
            {place.googleRating && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-white text-xs">{place.googleRating.toFixed(1)}</span>
                <Star className="w-3 h-3 fill-[var(--color-wfc-amber)] text-[var(--color-wfc-amber)]" />
              </div>
            )}
          </div>
          <p className="text-white text-sm flex items-center gap-1 mt-1 opacity-75">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            {place.area}
          </p>
        </div>

        {/* ── Stats strip ── */}
        <div className="flex gap-[3px] px-3 pt-3 pb-3">
          {cols.map((col, i) => (
            <div key={i} className="flex-1 flex flex-col gap-1.5">
              <div className="h-1.5" style={{ backgroundColor: col.color }} />
              <div className="flex items-center gap-1 text-white text-xs">
                {col.icon}
                <span>{col.label}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </Link>
  );
}
