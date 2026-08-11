import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import {
  LayoutDashboard, Globe, Users, Receipt, Tag, Settings, PlusCircle, FileText, PanelLeftOpen, PanelLeftClose,
} from "lucide-react";
import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

const customerNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/domains", label: "Domain Saya", icon: Globe },
  { href: "/domains/register", label: "Register Domain", icon: PlusCircle },
  { href: "/prices", label: "Daftar Harga", icon: Tag },
  { href: "/billing", label: "Tagihan", icon: FileText },
];

const resellerNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/domains", label: "Domains", icon: Globe },
  { href: "/domains/register", label: "Register Domain", icon: PlusCircle },
  { href: "/customers", label: "Pelanggan", icon: Users },
  { href: "/billing", label: "Billing & Saldo", icon: Receipt },
  { href: "/prices", label: "Daftar Harga", icon: Tag },
  { href: "/settings", label: "Pengaturan Sistem", icon: Settings },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar_collapsed") === "true");

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  const isCustomer = user?.role === "customer";
  const currentNavItems = isCustomer ? customerNavItems : resellerNavItems;

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col font-sans antialiased selection:bg-black selection:text-white">
      {/* Global Top Navbar */}
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex w-full">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          style={{ backgroundColor: settings.sidebar_color || "#ffffff" }}
          className={`fixed inset-y-0 left-0 z-50 border-r border-gray-200/80 transform transition-all duration-200 ease-in-out lg:translate-x-0 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:self-start lg:shrink-0 flex flex-col justify-between ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } ${collapsed ? "lg:w-20" : "lg:w-64"} w-64`}
        >
          <div className="flex-1 overflow-y-auto">
            {!collapsed && (
              <div className="px-4 pt-4 pb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 hidden lg:block select-none">
                Menu Utama
              </div>
            )}

            <nav className="p-3 space-y-1">
              {currentNavItems.map((item) => {
                const active =
                  location.pathname === item.href ||
                  (item.href === "/domains" &&
                    location.pathname.startsWith("/domains/") &&
                    location.pathname !== "/domains/register");
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    title={collapsed ? item.label : undefined}
                    style={active ? { backgroundColor: settings.primary_color || "#000000", color: "#ffffff" } : undefined}
                    className={`w-full flex items-center gap-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      collapsed ? "lg:justify-center lg:px-0 lg:py-3 px-3.5 py-2.5" : "px-3.5 py-2.5"
                    } ${
                      active
                        ? "shadow-xs"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {(!collapsed || sidebarOpen) && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer Collapse Button (Option 1) */}
          <div className="p-3 border-t border-gray-100 hidden lg:block shrink-0">
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Buka Sidebar" : "Kecilkan Sidebar"}
              className={`w-full flex items-center rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all cursor-pointer ${
                collapsed ? "justify-center py-2.5" : "justify-between px-3 py-2.5"
              }`}
            >
              {!collapsed ? (
                <>
                  <span className="flex items-center gap-2 text-xs font-bold text-gray-600">
                    <PanelLeftClose className="w-4 h-4 text-gray-400" />
                    <span>Sembunyikan Sidebar</span>
                  </span>
                </>
              ) : (
                <PanelLeftOpen className="w-4 h-4 text-gray-600" />
              )}
            </button>
          </div>
        </aside>

        {/* Main content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
