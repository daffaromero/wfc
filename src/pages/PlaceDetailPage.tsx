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
import { usePlace } from "@/hooks/usePlace";
import { Badge } from "@/components/ui/badge";
import {
  cn,
  noiseLevelVariant,
  wifiSpeedVariant,
  plugsVariant,
  wifiSpeedLabel,
  cityLabel,
  priceRangeText,
} from "@/lib/utils";

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
      <main className="max-w-6xl mx-auto px-4 py-20 text-center text-muted-foreground">
        <p className="text-xl font-medium">Loading…</p>
      </main>
    );
  }

  if (error || !place) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-20 text-center text-muted-foreground">
        <p className="text-xl font-medium">Place not found.</p>
        <Link to="/browse" className="mt-4 inline-block text-[var(--color-wfc-amber)] hover:underline">
          ← Back to directory
        </Link>
      </main>
    );
  }

  const { wfc } = place;

  return (
    <>
      {/* Dark zone: back link sits on the same dark surface as the header */}
      <div className="bg-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-6">
          <Link
            to="/browse"
            className="inline-flex items-center gap-1.5 text-sm text-background/50 hover:text-background transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to directory
          </Link>
        </div>
        {/* Gradient seam: dark → white */}
        <div className="h-10 bg-gradient-to-b from-foreground to-background" />
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-8 space-y-8">
      {/* Photo gallery */}
      <PhotoGallery photos={place.photos} name={place.name} />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-[var(--color-wfc-amber)] bg-[var(--color-wfc-amber-bg)] border border-[var(--color-wfc-amber)]/30 px-2 py-0.5 rounded-full">
              {cityLabel(place.city)}
            </span>
            {place.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {place.name}
          </h1>
          <p className="text-muted-foreground flex items-center gap-1.5">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            {place.address}
          </p>
        </div>

        {/* Rating */}
        {place.googleRating && (
          <div className="flex-shrink-0 flex flex-col items-center bg-background border border-border rounded-2xl px-5 py-3 gap-0.5">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-[var(--color-wfc-amber)] text-[var(--color-wfc-amber)]" />
              <span className="text-2xl font-bold text-foreground">
                {place.googleRating.toFixed(1)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {place.totalRatings?.toLocaleString()} reviews
            </span>
            <span className="text-xs text-muted-foreground">Google Maps</span>
          </div>
        )}
      </div>

      {/* Links row */}
      <div className="flex flex-wrap gap-3">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + " " + place.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground bg-background border border-border px-3 py-1.5 rounded-lg hover:border-foreground/30 transition-colors"
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
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground bg-background border border-border px-3 py-1.5 rounded-lg hover:border-foreground/30 transition-colors"
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
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground bg-background border border-border px-3 py-1.5 rounded-lg hover:border-foreground/30 transition-colors"
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
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium",
                    wifiSpeedVariant(wfc.wifi.speed)
                  )}
                >
                  {wifiSpeedLabel(wfc.wifi.speed)}
                  {wfc.wifi.requiresPassword ? " (password)" : " (open)"}
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1 text-sm">
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
                  plugsVariant(wfc.plugs)
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
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", noiseLevelVariant(wfc.noiseLevel))}>
                {wfc.noiseLevel.charAt(0).toUpperCase() + wfc.noiseLevel.slice(1)}
              </span>
            }
          />
          <WfcRow
            icon={<span className="text-base">🕌</span>}
            label="Prayer room"
            value={
              <span className={cn("text-sm font-medium", wfc.prayerRoom ? "text-[var(--color-wfc-teal)]" : "text-muted-foreground")}>
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
                  <span className="text-muted-foreground">Not available</span>
                ) : (
                  <span
                    className={cn(
                      "font-medium",
                      wfc.parking === "free"
                        ? "text-[var(--color-wfc-green)]"
                        : "text-[var(--color-wfc-amber)]"
                    )}
                  >
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
                <span className="text-sm text-[var(--color-wfc-amber)] font-medium">
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
                <Badge key={t} className="bg-muted text-foreground">
                  {SEATING_LABELS[t] ?? t}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Capacity:{" "}
              <span className="font-medium text-foreground capitalize">
                {wfc.seating.capacity}
              </span>
              {!wfc.seating.timeLimitHours && (
                <span className="ml-2 text-[var(--color-wfc-green)] text-xs font-medium">
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
                <Badge className="bg-[var(--color-wfc-amber-bg)] text-[var(--color-wfc-amber)] gap-1">
                  <Coffee className="w-3 h-3" />
                  Specialty coffee
                </Badge>
              )}
              {wfc.menu.nonCoffee && (
                <Badge className="bg-muted text-foreground">
                  Non-coffee drinks
                </Badge>
              )}
              {wfc.menu.food && (
                <Badge className="bg-muted text-foreground gap-1">
                  <UtensilsCrossed className="w-3 h-3" />
                  Food available
                </Badge>
              )}
            </div>
            {wfc.menu.highlights && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Highlights
                </p>
                <ul className="space-y-1">
                  {wfc.menu.highlights.map((h) => (
                    <li key={h} className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-[var(--color-wfc-amber)] flex-shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Price range:{" "}
              <span className="font-medium text-foreground">
                {priceRangeText(wfc.menu.priceRange)}
              </span>
            </p>
          </div>
        </Section>

        {/* Opening hours */}
        <Section title="Opening Hours">
          <ul className="space-y-1">
            {place.openingHours.map((h) => (
              <li key={h} className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
                {h}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* Last verified */}
      <p className="text-xs text-muted-foreground pt-2 border-t border-border">
        WFC details last verified:{" "}
        <span className="font-medium">
          {new Date(place.lastVerified).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
        . Spotted something wrong?{" "}
        <a href="https://github.com/daffaromero/wfc" target="_blank" rel="noopener noreferrer" className="text-[var(--color-wfc-amber)] hover:underline">
          Suggest an edit
        </a>
        .
      </p>
    </main>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-background border border-border rounded-lg p-5 space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
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
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
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
