import { useState } from "react";
import { Link } from "react-router";
import { RefreshCw } from "lucide-react";

type SyncState = "idle" | "syncing" | "done" | "error";

export function Header() {
  const [state, setState] = useState<SyncState>("idle");
  const [added, setAdded] = useState(0);

  async function handleSync() {
    if (state === "syncing") return;
    setState("syncing");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok) throw new Error(`Sync failed (${res.status})`);
      const summary = (await res.json()) as { added: number };
      setAdded(summary.added);
      setState("done");
      // Refresh the list so newly-added places show up.
      if (summary.added > 0) {
        setTimeout(() => window.location.reload(), 900);
      } else {
        setTimeout(() => setState("idle"), 2000);
      }
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const label =
    state === "syncing" ? "Syncing…"
    : state === "done"  ? (added > 0 ? `+${added} added` : "Up to date")
    : state === "error" ? "Sync failed"
    : "Sync";

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
          <button
            type="button"
            onClick={handleSync}
            disabled={state === "syncing"}
            title="Pull new places from the Google Maps saved list"
            className="ml-1 inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-foreground bg-[var(--color-wfc-green)] hover:opacity-80 transition-opacity disabled:opacity-60 disabled:cursor-wait"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${state === "syncing" ? "animate-spin" : ""}`} />
            {label}
          </button>
        </nav>
      </div>
    </header>
  );
}
