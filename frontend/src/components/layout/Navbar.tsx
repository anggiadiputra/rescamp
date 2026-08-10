import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { api } from "../../lib/api";
import {
  Globe, LogIn, UserPlus, LogOut, User, Menu, ChevronDown, Wallet, X, Eye, EyeOff,
} from "lucide-react";
import { Button } from "../ui";

export function Navbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  const nav = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const [guestMenuOpen, setGuestMenuOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [showBalance, setShowBalance] = useState(() => {
    return localStorage.getItem("show_balance") !== "false";
  });

  const brand = settings.brand_name || "Ekstensi.id";

  useEffect(() => {
    if (user && user.role === "reseller") {
      api.get<any>("/billing/balance")
        .then((res) => {
          const raw = typeof res?.balance === "number" ? res.balance : (typeof res === "number" ? res : null);
          setBalance(typeof raw === "number" ? raw : null);
        })
        .catch(() => setBalance(null));
    } else {
      setBalance(null);
    }
  }, [user, location.pathname]);

  // Reset mobile guest menu on route change
  useEffect(() => {
    setGuestMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-gray-200/80 sticky top-0 z-30 flex flex-col transition-all">
      <div className={`${user ? "px-4 sm:px-6 md:px-8 w-full" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full"} h-16 flex items-center justify-between gap-4`}>
        {/* Left Side: Brand & Mobile Sidebar Toggle */}
        <div className="flex items-center gap-3">
          {user && onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Toggle navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200">
              <Globe className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black text-gray-900 tracking-tight leading-none group-hover:text-black transition-colors">
                {brand}
              </span>
              {user && user.role === "reseller" && (
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-tight mt-0.5">
                  Reseller Portal
                </span>
              )}
            </div>
          </Link>
        </div>

        {/* Center / Desktop Links (Public Guest Mode) */}
        {!user && (
          <nav className="hidden md:flex items-center gap-6">
            <a href="/#why-us" className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-black transition-colors">
              Mengapa Kami
            </a>
            <a href="/#features" className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-black transition-colors">
              Fitur Utama
            </a>
            <Link to="/prices" className={`text-xs font-bold uppercase tracking-wider transition-colors ${location.pathname === "/prices" ? "text-black border-b-2 border-black py-1" : "text-gray-500 hover:text-black"}`}>
              Daftar Harga
            </Link>
          </nav>
        )}

        {/* Right Side Actions */}
        <div className="flex items-center gap-2.5">
          {!user ? (
            <>
              {/* Desktop Auth Buttons */}
              <div className="hidden md:flex items-center gap-2">
                <Link to="/login">
                  <Button
                    variant={location.pathname === "/login" ? "secondary" : "ghost"}
                    size="md"
                    className={location.pathname === "/login" ? "bg-gray-100 font-bold text-black" : ""}
                  >
                    <LogIn className="w-4 h-4 mr-1.5 inline" />
                    Masuk
                  </Button>
                </Link>
                <Link to="/register">
                  <Button
                    variant="primary"
                    size="md"
                    className={location.pathname === "/register" ? "bg-black text-white ring-2 ring-black/20" : ""}
                  >
                    <UserPlus className="w-4 h-4 mr-1.5 inline" />
                    Daftar
                  </Button>
                </Link>
              </div>

              {/* Mobile Guest Toggle Button (Far Right) */}
              <button
                onClick={() => setGuestMenuOpen(!guestMenuOpen)}
                className="md:hidden p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Toggle mobile menu"
              >
                {guestMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              {/* Balance Badge (Reseller Only) */}
              {user?.role === "reseller" && typeof balance === "number" && (
                <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-gray-50 border border-gray-200/80 text-sm font-extrabold text-gray-900 shadow-2xs">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Wallet className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-mono text-sm tracking-tight">
                    {showBalance ? `Rp ${balance.toLocaleString("id-ID")}` : "Rp ••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBalance((prev) => {
                        const next = !prev;
                        localStorage.setItem("show_balance", String(next));
                        return next;
                      });
                    }}
                    title={showBalance ? "Sembunyikan Saldo" : "Tampilkan Saldo"}
                    className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-200/70 rounded-lg transition-colors cursor-pointer ml-0.5"
                  >
                    {showBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-black text-white font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                    {(user.name || user.email || "U").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="hidden md:flex flex-col text-left leading-tight">
                    <span className="text-sm font-bold text-gray-900 truncate max-w-[160px]">{user.name || user.email}</span>
                    {user.role === "reseller" && (
                      <span className="text-xs font-semibold text-gray-500 capitalize">Reseller</span>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 hidden md:block transition-transform duration-150 ${profileOpen ? "rotate-180" : ""}`} />
                </button>

                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-900 truncate">{user.name || "Pengguna"}</p>
                        <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                      </div>
                      <Link
                        to="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <User className="w-4 h-4 text-gray-400" /> Profil Akun
                      </Link>
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          logout();
                          nav("/login");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" /> Keluar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guest Mobile Drawer Dropdown */}
      {!user && guestMenuOpen && (
        <div className="md:hidden border-t border-gray-200/80 bg-white/95 backdrop-blur-md px-4 py-3 space-y-3 shadow-md animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="space-y-1 pb-2 border-b border-gray-100">
            <a
              href="/#why-us"
              onClick={() => setGuestMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 hover:text-black transition-colors"
            >
              Mengapa Kami
            </a>
            <a
              href="/#features"
              onClick={() => setGuestMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 hover:text-black transition-colors"
            >
              Fitur Utama
            </a>
            <Link
              to="/prices"
              onClick={() => setGuestMenuOpen(false)}
              className={`block px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                location.pathname === "/prices" ? "bg-gray-100 text-black font-black" : "text-gray-600 hover:bg-gray-50 hover:text-black"
              }`}
            >
              Daftar Harga
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Link to="/login" onClick={() => setGuestMenuOpen(false)} className="w-full">
              <Button
                variant={location.pathname === "/login" ? "secondary" : "ghost"}
                size="md"
                className={`w-full justify-center ${location.pathname === "/login" ? "bg-gray-100 font-extrabold text-black" : ""}`}
              >
                <LogIn className="w-4 h-4 mr-1.5 inline" />
                Masuk
              </Button>
            </Link>
            <Link to="/register" onClick={() => setGuestMenuOpen(false)} className="w-full">
              <Button
                variant="primary"
                size="md"
                className="w-full justify-center"
              >
                <UserPlus className="w-4 h-4 mr-1.5 inline" />
                Daftar
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
