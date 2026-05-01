import { Outlet } from "react-router";
import { Header } from "../components/Header";

export function RootLayout() {
  return (
    <div className="min-h-svh bg-stone-50">
      <Header />
      <Outlet />
      <footer className="mt-16 border-t border-stone-200 py-6 text-center text-sm text-stone-400">
        Curated. · Jakarta &amp; Yogyakarta · Built with ☕
      </footer>
    </div>
  );
}
