import { Outlet } from "react-router";
import { Header } from "../components/Header";

export function RootLayout() {
  return (
    <div className="min-h-svh bg-background">
      <Header />
      <Outlet />
      <footer className="mt-16 border-t border-border py-6 text-center text-sm text-muted-foreground">
        Curated. · Jakarta &amp; Yogyakarta · Built with ☕️
      </footer>
    </div>
  );
}
