import { useParams, Link } from "react-router";
import {
  ArrowLeft,
  Wifi,
  WifiOff,
  Plug,
  MapPin,
  Clock,
  Star,
  Car,
  Volume2,
  VolumeX,
  ExternalLink,
  Coffee,
  UtensilsCrossed,
  CalendarClock,
} from "lucide-react";
import { usePlace } from "../hooks/usePlace";
import { Badge } from "../components/Badge";
import {
  cn,
  noiseLevelColor,
  wifiSpeedColor,
  wifiSpeedLabel,
  cityLabel,
  priceRangeText,
} from "../lib/utils";

const SEATING_LABELS: Record<string, string> = {
  solo: "Solo desks",
  communal: "Communal tables",
  sofa: "Sofa seating",
  bar: "Bar seating",
  outdoor: "Outdoor seating",
};

export function PlaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { place, loading, error } = usePlace(id);

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-20 text-center text-stone-400">
        <p className="text-xl font-medium">Loading…</p>
      </main>
    );
  }

  if (error || !place) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-20 text-center text-stone-500">
        <p className="text-xl font-medium">Place not found.</p>
        <Link to="/" className="mt-4 inline-block text-amber-600 hover:underline">
          ← Back to directory
        </Link>
      </main>
    );
  }

  const { wfc } = place;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Back */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to directory
      </Link>

      {/* Photo gallery */}
      <PhotoGallery photos={place.photos} name={place.name} />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {cityLabel(place.city)}
            </span>
            {place.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
            {place.name}
          </h1>
          <p className="text-stone-500 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            {place.address}
          </p>
        </div>

        {/* Rating */}
        {place.googleRating && (
          <div className="flex-shrink-0 flex flex-col items-center bg-white border border-stone-200 rounded-2xl px-5 py-3 gap-0.5">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-2xl font-bold text-stone-900">
                {place.googleRating.toFixed(1)}
              </span>
            </div>
            <span className="text-xs text-stone-400">
              {place.totalRatings?.toLocaleString()} reviews
            </span>
            <span className="text-xs text-stone-400">Google Maps</span>
          </div>
        )}
      </div>

      {/* Links row */}
      <div className="flex flex-wrap gap-3">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + " " + place.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-stone-600 bg-white border border-stone-200 px-3 py-1.5 rounded-lg hover:border-stone-300 transition-colors"
        >
          <MapPin className="w-3.5 h-3.5" />
          Open in Google Maps
          <ExternalLink className="w-3 h-3 opacity-50" />
        </a>
        {place.website && (
          <a
            href={place.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-stone-600 bg-white border border-stone-200 px-3 py-1.5 rounded-lg hover:border-stone-300 transition-colors"
          >
            Website
            <ExternalLink className="w-3 h-3 opacity-50" />
          </a>
        )}
        {place.instagram && (
          <a
            href={`https://instagram.com/${place.instagram.replace("@", "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-stone-600 bg-white border border-stone-200 px-3 py-1.5 rounded-lg hover:border-stone-300 transition-colors"
          >
            <span className="text-xs">📸</span>
            {place.instagram}
          </a>
        )}
      </div>

      {/* Two column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* WFC Features */}
        <Section title="Cafe Details">
          <WfcRow
            icon={<Wifi className="w-4 h-4" />}
            label="WiFi"
            value={
              wfc.wifi.available ? (
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", wifiSpeedColor(wfc.wifi.speed))}>
                  {wifiSpeedLabel(wfc.wifi.speed)}
                  {wfc.wifi.requiresPassword ? " (password)" : " (open)"}
                </span>
              ) : (
                <span className="text-stone-400 flex items-center gap-1">
                  <WifiOff className="w-3.5 h-3.5" /> Not available
                </span>
              )
            }
          />
          <WfcRow
            icon={<Plug className="w-4 h-4" />}
            label="Power plugs"
            value={
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium",
                  wfc.plugs === "ample"
                    ? "bg-emerald-100 text-emerald-800"
                    : wfc.plugs === "limited"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-stone-100 text-stone-500"
                )}
              >
                {wfc.plugs.charAt(0).toUpperCase() + wfc.plugs.slice(1)}
              </span>
            }
          />
          <WfcRow
            icon={
              wfc.noiseLevel === "quiet" ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )
            }
            label="Noise level"
            value={
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", noiseLevelColor(wfc.noiseLevel))}>
                {wfc.noiseLevel.charAt(0).toUpperCase() + wfc.noiseLevel.slice(1)}
              </span>
            }
          />
          <WfcRow
            icon={<span className="text-base">🕌</span>}
            label="Prayer room"
            value={
              <span className={cn("text-sm font-medium", wfc.prayerRoom ? "text-teal-700" : "text-stone-400")}>
                {wfc.prayerRoom ? "Available" : "Not available"}
              </span>
            }
          />
          <WfcRow
            icon={<Car className="w-4 h-4" />}
            label="Parking"
            value={
              <span className="text-sm capitalize">
                {wfc.parking === "none" ? (
                  <span className="text-stone-400">Not available</span>
                ) : (
                  <span className={wfc.parking === "free" ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"}>
                    {wfc.parking === "free" ? "Free" : "Paid"}
                  </span>
                )}
              </span>
            }
          />
          {wfc.seating.timeLimitHours && (
            <WfcRow
              icon={<CalendarClock className="w-4 h-4" />}
              label="Time limit"
              value={
                <span className="text-sm text-amber-700 font-medium">
                  {wfc.seating.timeLimitHours}h max stay
                </span>
              }
            />
          )}
        </Section>

        {/* Seating */}
        <Section title="Seating">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {wfc.seating.types.map((t) => (
                <Badge key={t} className="bg-stone-100 text-stone-700">
                  {SEATING_LABELS[t] ?? t}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-stone-500 mt-2">
              Capacity:{" "}
              <span className="font-medium text-stone-700 capitalize">
                {wfc.seating.capacity}
              </span>
              {!wfc.seating.timeLimitHours && (
                <span className="ml-2 text-emerald-600 text-xs font-medium">
                  No time limit
                </span>
              )}
            </p>
          </div>
        </Section>

        {/* Menu */}
        <Section title="Menu">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {wfc.menu.coffeeSpecialty && (
                <Badge className="bg-amber-100 text-amber-800">
                  <Coffee className="w-3 h-3" />
                  Specialty coffee
                </Badge>
              )}
              {wfc.menu.nonCoffee && (
                <Badge className="bg-stone-100 text-stone-700">
                  Non-coffee drinks
                </Badge>
              )}
              {wfc.menu.food && (
                <Badge className="bg-stone-100 text-stone-700">
                  <UtensilsCrossed className="w-3 h-3" />
                  Food available
                </Badge>
              )}
            </div>
            {wfc.menu.highlights && (
              <div>
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">
                  Highlights
                </p>
                <ul className="space-y-1">
                  {wfc.menu.highlights.map((h) => (
                    <li key={h} className="text-sm text-stone-600 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm text-stone-500">
              Price range:{" "}
              <span className="font-medium text-stone-700">
                {priceRangeText(wfc.menu.priceRange)}
              </span>
            </p>
          </div>
        </Section>

        {/* Opening hours */}
        <Section title="Opening Hours">
          <ul className="space-y-1">
            {place.openingHours.map((h) => (
              <li key={h} className="text-sm text-stone-600 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                {h}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* Last verified */}
      <p className="text-xs text-stone-400 pt-2 border-t border-stone-100">
        WFC details last verified:{" "}
        <span className="font-medium">
          {new Date(place.lastVerified).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
        . Spotted something wrong?{" "}
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">
          Suggest an edit
        </a>
        .
      </p>
    </main>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </div>
  );
}

function WfcRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-stone-100 last:border-0">
      <div className="flex items-center gap-2 text-stone-500 text-sm">
        {icon}
        {label}
      </div>
      <div>{value}</div>
    </div>
  );
}

function PhotoGallery({ photos, name }: { photos: string[]; name: string }) {
  if (!photos.length) return null;

  if (photos.length === 1) {
    return (
      <div className="rounded-2xl overflow-hidden h-64 sm:h-80">
        <img src={photos[0]} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 h-64 sm:h-80">
      <div className="col-span-2 row-span-2 rounded-2xl overflow-hidden">
        <img src={photos[0]} alt={name} className="w-full h-full object-cover" />
      </div>
      {photos.slice(1, 3).map((src, i) => (
        <div key={i} className="rounded-xl overflow-hidden">
          <img src={src} alt={`${name} photo ${i + 2}`} className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  );
}
