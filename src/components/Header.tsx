import { Link } from "react-router";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-foreground border-b border-background/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
          <span className="inline-flex items-center gap-1 text-xl font-black tracking-tight text-background" style={{ fontFamily: 'Geist, sans-serif' }}>Curated<span className="inline-block w-2.5 h-2.5 bg-[var(--color-wfc-green)] flex-shrink-0" /></span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/browse" className="px-3 py-1.5 font-medium text-background/75 hover:text-background hover:bg-background/10 transition-colors">Browse</Link>
          <a
            href="https://github.com/daffaromero/wfc"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 font-medium text-background/75 hover:text-background hover:bg-background/10 transition-colors"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
