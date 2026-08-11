import { Globe, AlertCircle, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { StatCard, Card, LoadingSpinner } from "../components/ui";
import { api } from "../lib/api";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import type { Domain, PaginatedResponse } from "../lib/types";

function fmtBalance(amount: any, currency: string = "IDR"): string {
  const num = Number(amount || 0);
  if (isNaN(num)) return `${currency} 0`;
  const actual = num < 1000 && currency === "IDR" ? num * 1000 : num;
  return `${currency} ${Math.round(actual).toLocaleString("id-ID")}`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const isCustomer = user?.role === "customer";

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState({ balance: "0.00", currency: "IDR" });
  useEffect(() => {
    const promises: Promise<any>[] = [
      // All roles: fetch live Resellercamp for dashboard counts to match dashboard reseller.
      api.get<PaginatedResponse<Domain>>("/domains/remote?per_page=5").catch(() => ({ data: [] })),
    ];

    if (!isCustomer) {
      promises.push(api.get<any>("/billing/balance").catch(() => ({ balance: "0.00", currency: "IDR" })));
    }

    Promise.all(promises).then(([d, b]) => {
      setDomains(d.data || []);
      if (b) {
        const bal = typeof b === "object" ? b : { balance: String(b), currency: "IDR" };
        setBalance(bal);
      }
    }).finally(() => setLoading(false));
  }, [isCustomer]);

  if (loading) return <LoadingSpinner />;

  const active = domains.filter((d) => d.status === "active").length;
  const expired = domains.filter((d) => d.status === "expired").length;
  const suspended = domains.filter((d) => d.status === "suspended").length;
  const expiring = domains.filter((d) => d.expiryDate && new Date(d.expiryDate) < new Date(Date.now() + 30 * 86400000) && d.status === "active").length;
  const suspendedDomains = domains.filter((d) => d.status === "suspended");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Welcome back, {user?.name || "User"} 👋
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {isCustomer ? "Manage your domains and registered services." : "Manage your reseller platform and customer accounts."}
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        <StatCard label="Total Domains" value={domains.length} icon={Globe} />
        <StatCard label="Active" value={active} icon={CheckCircle2} />
        <StatCard label="Expiring Soon" value={expiring} icon={Clock} />
        <StatCard label="Expired" value={expired} icon={AlertCircle} />
        <StatCard label="Suspended" value={suspended} icon={AlertTriangle} />
      </div>

      {/* Grid: Reseller Balance (if reseller) / Recent Domains */}
      <div className={`grid grid-cols-1 ${!isCustomer ? "lg:grid-cols-2" : ""} gap-6`}>
        {!isCustomer && (
          <Card>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Reseller Deposit Balance</h2>
            <p className="text-3xl font-black text-gray-900">{fmtBalance(balance.balance, balance.currency)}</p>
          </Card>
        )}

        <Card className={isCustomer ? "col-span-full" : ""}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Domains</h2>
            <Link to="/domains" className="text-xs font-semibold text-gray-900 hover:underline">View All →</Link>
          </div>
          {suspendedDomains.length > 0 && (
            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
              <div className="p-1.5 bg-rose-600 text-white rounded-lg shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-black text-rose-900 uppercase tracking-wider">
                  {suspendedDomains.length} Domain Di-Suspend
                </h3>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  Domain berikut dalam status suspend. Hubungi admin untuk informasi lebih lanjut.
                </p>
                <ul className="mt-2 space-y-1">
                  {suspendedDomains.slice(0, 5).map((d) => (
                    <li key={d.liquidOrderId || d.id} className="text-[11px] text-rose-900 font-mono">
                      • {d.domainName}
                      {d.suspendReason ? <span className="text-rose-700"> — {d.suspendReason}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {domains.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-gray-400">No domains registered yet.</p>
              <Link to="/domains/register" style={{ backgroundColor: settings.primary_color || "#000000" }} className="inline-block mt-3 px-4 py-2 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity">
                Register Your First Domain
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {domains.slice(0, 5).map((d) => (
                <div key={d.liquidOrderId || d.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/domains/${d.liquidOrderId || d.id}`} className="text-sm font-mono font-bold text-gray-900 hover:text-black">
                      {d.domainName}
                    </Link>
                    <p className="text-[11px] text-gray-400 mt-0.5">Expires: {d.expiryDate || "-"}</p>
                    {d.status === "suspended" && d.suspendReason && (
                      <p className="text-[11px] text-rose-700 mt-0.5 truncate" title={d.suspendReason}>
                        Alasan: {d.suspendReason}
                      </p>
                    )}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                    d.status === "active" ? "bg-emerald-100 text-emerald-800"
                    : d.status === "suspended" ? "bg-rose-100 text-rose-700"
                    : "bg-gray-100 text-gray-700"
                  }`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
