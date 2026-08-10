import type { ReactNode } from "react";
import { useSettings } from "../../contexts/SettingsContext";
import { Navbar } from "./Navbar";

export function PublicLayout({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const brand = settings.brand_name || "Ekstensi.id";

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col font-sans antialiased selection:bg-black selection:text-white">
      <Navbar />
      <main className="flex-1 px-4 sm:px-6 py-8">{children}</main>
      <footer className="py-6 text-center text-xs font-semibold text-gray-400 border-t border-gray-200/60 bg-white/50">
        &copy; {new Date().getFullYear()} {brand}. Hak Cipta Dilindungi.
      </footer>
    </div>
  );
}
