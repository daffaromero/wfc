import { Outlet } from "react-router";
import { Header } from "../components/Header";

export function RootLayout() {
  return (
    <div className="min-h-svh bg-background">
      <Header />
      <Outlet />
      <footer className="mt-16 bg-foreground py-6 text-center text-sm text-background/30">
        Curated<span className="text-[var(--color-wfc-amber)]">.</span> · Jakarta &amp; Yogyakarta · Built with ☕️
      </footer>
    </div>
  );
}
