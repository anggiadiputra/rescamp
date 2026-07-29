import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import {
  LayoutDashboard, Globe, Users, Receipt, Tag, Settings, Menu, X, LogOut, PlusCircle, User, FileText,
} from "lucide-react";
import type { ReactNode } from "react";

const customerNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/domains", label: "My Domains", icon: Globe },
  { href: "/domains/register", label: "Register Domain", icon: PlusCircle },
  { href: "/prices", label: "Price List", icon: Tag },
  { href: "/billing", label: "Invoices", icon: FileText },
  { href: "/profile", label: "My Profile", icon: User },
  { href: "/settings", label: "System Settings", icon: Settings },
];

const resellerNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/domains", label: "Domains", icon: Globe },
  { href: "/domains/register", label: "Register Domain", icon: PlusCircle },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/billing", label: "Billing & Balance", icon: Receipt },
  { href: "/prices", label: "Price List", icon: Tag },
  { href: "/profile", label: "My Profile", icon: User },
  { href: "/settings", label: "System Settings", icon: Settings },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isCustomer = user?.role === "customer";
  const currentNavItems = isCustomer ? customerNavItems : resellerNavItems;

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 lg:static lg:z-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-14 flex items-center gap-2 px-5 border-b border-gray-100">
          <Globe className="w-5 h-5 text-gray-900" />
          <span className="text-sm font-bold text-gray-900">{settings.brand_name || "Domain Dashboard"}</span>
        </div>
        <nav className="p-3 space-y-1">
          {currentNavItems.map((item) => {
            const active = location.pathname === item.href || (item.href === "/domains" && location.pathname.startsWith("/domains/") && location.pathname !== "/domains/register");
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  active ? "bg-black text-white shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 bg-white border-b border-gray-200 sticky top-0 z-10 flex items-center justify-between px-5">
          <button className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-xs text-gray-600 font-medium">{user?.name}</span>
            <button onClick={logout} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
