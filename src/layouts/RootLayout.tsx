import { Outlet } from "react-router";
import { Header } from "../components/Header";

export function RootLayout() {
  return (
    <div className="min-h-svh bg-background">
      <Header />
      <Outlet />
      {/* Gradient seam: white content → dark footer */}
      <div className="h-10 bg-gradient-to-b from-background to-foreground" />
      <footer className="bg-foreground py-6 text-center text-sm text-background/30">
        Curated<span className="text-[var(--color-wfc-amber)]">.</span> · Jakarta &amp; Yogyakarta · Built with ☕️
      </footer>
    </div>
  );
}
