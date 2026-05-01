import { Link } from "react-router";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-background border-b-2 border-foreground/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-70 transition-opacity">
          <span className="text-xl font-black tracking-tight">Curated<span className="text-[var(--color-wfc-amber)]">.</span></span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/browse" className="px-3 py-1.5 rounded font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Browse</Link>
          <a
            href="https://github.com/daffaromero/wfc"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
