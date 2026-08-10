import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import {
  LayoutDashboard, Globe, Users, Receipt, Tag, Settings, Menu, X, LogOut, PlusCircle, User, FileText, ChevronDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { ReactNode } from "react";

const customerNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/domains", label: "My Domains", icon: Globe },
  { href: "/domains/register", label: "Register Domain", icon: PlusCircle },
  { href: "/prices", label: "Price List", icon: Tag },
  { href: "/billing", label: "Invoices", icon: FileText },
];

const resellerNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/domains", label: "Domains", icon: Globe },
  { href: "/domains/register", label: "Register Domain", icon: PlusCircle },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/billing", label: "Billing & Balance", icon: Receipt },
  { href: "/prices", label: "Price List", icon: Tag },
  { href: "/settings", label: "System Settings", icon: Settings },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar_collapsed") === "true");
  const [profileOpen, setProfileOpen] = useState(false);

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
    <div className="min-h-screen bg-[#f0f2f5] flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-200 transform transition-all duration-200 ease-in-out lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:overflow-y-auto lg:shrink-0 lg:z-20 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-20" : "lg:w-64"} w-64`}
      >
        <div className={`h-14 flex items-center justify-between border-b border-gray-100 px-4 ${collapsed ? "lg:px-3 lg:justify-center" : ""}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Globe className="w-4 h-4" />
            </div>
            {(!collapsed || sidebarOpen) && (
              <span className="text-sm font-bold text-gray-900 truncate">
                {settings.brand_name || "Ekstensi.id"}
              </span>
            )}
          </div>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse to icon-only"}
            className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-black hover:bg-gray-100 transition-colors shrink-0"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

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
                className={`w-full flex items-center gap-3 rounded-xl text-sm font-semibold transition-all ${
                  collapsed ? "lg:justify-center lg:px-0 lg:py-3 px-3.5 py-2.5" : "px-3.5 py-2.5"
                } ${
                  active
                    ? "bg-black text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {(!collapsed || sidebarOpen) && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 bg-white border-b border-gray-200 sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button className="lg:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-700" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Expand Sidebar" : "Collapse Sidebar (Icon Only)"}
              className="hidden lg:flex items-center gap-1.5 p-2 hover:bg-gray-100 text-gray-600 hover:text-black rounded-lg transition-colors text-xs font-semibold"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-3 ml-auto relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <span className="hidden sm:inline text-xs font-semibold text-gray-700">{user?.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-900 truncate">{user?.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User className="w-3.5 h-3.5" /> My Profile
                  </Link>
                  <button
                    onClick={() => { setProfileOpen(false); logout(); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
