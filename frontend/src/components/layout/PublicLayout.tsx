import { Link } from "react-router-dom";
import { Globe } from "lucide-react";
import type { ReactNode } from "react";
import { useSettings } from "../../contexts/SettingsContext";

export function PublicLayout({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const brand = settings.brand_name || "Ekstensi.id";

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 h-16 flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            <span className="text-sm font-bold text-gray-900">{brand}</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-gray-500 hover:text-black">Login</Link>
            <Link to="/register" className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors">Register</Link>
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 sm:px-6">{children}</main>
      <footer className="py-6 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} {brand}
      </footer>
    </div>
  );
}
