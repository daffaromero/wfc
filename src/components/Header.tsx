import { Link } from "react-router";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-70 transition-opacity">
          <span className="text-lg font-bold tracking-tight">Curated<span className="text-[var(--color-wfc-amber)]">.</span></span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">Browse</Link>
          <a
            href="https://github.com/daffaromero/wfc"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
