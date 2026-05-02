import { Outlet } from "react-router";
import { Header } from "../components/Header";

export function RootLayout() {
  return (
    <div className="min-h-svh bg-foreground">
      <Header />
      <Outlet />
      <footer className="border-t border-background/10 py-4 text-center text-sm text-background/60">
        Curated<span className="text-[var(--color-wfc-amber)]">.</span> · Jakarta &amp; Yogyakarta · Built with ☕️
      </footer>
    </div>
  );
}
