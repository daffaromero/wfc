import { Link } from "react-router";
import { ArrowRight, MapPin, Wifi, Plug, Volume2 } from "lucide-react";

const CITIES = [
  {
    id: "jakarta",
    name: "Jakarta",
    count: 6,
    href: "/browse?city=jakarta",
    bg: "bg-[var(--color-wfc-blue)]",
    hoverBg: "hover:bg-[var(--color-wfc-blue)]",
  },
  {
    id: "yogyakarta",
    name: "Yogyakarta",
    count: 4,
    href: "/browse?city=yogyakarta",
    bg: "bg-[var(--color-wfc-green)]",
    hoverBg: "hover:bg-[var(--color-wfc-green)]",
  },
] as const;

const FEATURES = [
  { icon: <Wifi className="w-4 h-4" />, label: "WiFi speed" },
  { icon: <Plug className="w-4 h-4" />, label: "Power outlets" },
  { icon: <Volume2 className="w-4 h-4" />, label: "Noise level" },
  { icon: <span className="text-sm leading-none">🕌</span>, label: "Prayer rooms" },
];

export function LandingPage() {
  return (
    <div className="min-h-svh flex flex-col bg-foreground text-background overflow-hidden">
      {/* Top bar */}
      <header className="flex-shrink-0 px-6 sm:px-10 h-14 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xl font-black tracking-tight text-background" style={{ fontFamily: 'Geist, sans-serif' }}>
          Curated<span className="inline-block w-2.5 h-2.5 bg-[var(--color-wfc-green)] flex-shrink-0" />
        </span>
        <Link
          to="/browse"
          className="flex items-center gap-1.5 text-sm font-semibold text-background/80 hover:text-background transition-colors"
        >
          Browse all
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 py-12 gap-6">
        <div className="space-y-4">
          <p className="text-background/65 text-xs font-semibold uppercase tracking-[0.2em]">
            Work-friendly cafes · Indonesia
          </p>
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black leading-none tracking-tight text-background">
            The best<br />
            cafes to<br />
            work from.
          </h1>
        </div>

        <p className="text-background/50 text-base sm:text-lg max-w-sm leading-relaxed">
          Every cafe vetted for what actually matters when you're working.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2">
          {FEATURES.map((f) => (
            <span
              key={f.label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-background/10 text-background/40 text-sm font-medium"
            >
              {f.icon}
              {f.label}
            </span>
          ))}
        </div>
      </div>

      {/* City split */}
      <div className="flex-shrink-0 grid grid-cols-2 h-48 sm:h-64">
        {CITIES.map((city) => (
          <Link
            key={city.id}
            to={city.href}
            className={`group ${city.bg} flex flex-col justify-between p-5 sm:p-8 transition-all duration-150 hover:brightness-110`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-white/60 text-xs font-semibold uppercase tracking-wider">
                <MapPin className="w-3 h-3" />
                {city.count} cafes
              </span>
              <ArrowRight className="w-4 h-4 text-white opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150" />
            </div>
            <h2 className="text-white font-black text-3xl sm:text-4xl tracking-tight leading-none">
              {city.name}
            </h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
