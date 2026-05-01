import { Link } from "react-router";
import { Coffee } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold text-stone-900 hover:text-amber-700 transition-colors">
          <Coffee className="w-5 h-5 text-amber-600" />
          <span>WFC Directory</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-stone-500">
          <Link to="/" className="hover:text-stone-900 transition-colors">Browse</Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-stone-900 transition-colors"
          >
            Contribute
          </a>
        </nav>
      </div>
    </header>
  );
}
