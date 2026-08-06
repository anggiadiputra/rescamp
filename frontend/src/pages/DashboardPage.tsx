import { Globe, AlertCircle, Clock, CheckCircle2, AlertTriangle, Search } from "lucide-react";
import { StatCard, Card, LoadingSpinner, toast } from "../components/ui";
import { api } from "../lib/api";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import type { Domain, PaginatedResponse } from "../lib/types";

function fmtBalance(amount: any, currency: string = "IDR"): string {
  const num = Number(amount || 0);
  if (isNaN(num)) return `${currency} 0`;
  const actual = num < 1000 && currency === "IDR" ? num * 1000 : num;
  return `${currency} ${Math.round(actual).toLocaleString("id-ID")}`;
}

function fmtPrice(amount: any): string {
  if (amount == null || amount === "") return "";
  const num = Number(amount);
  if (isNaN(num)) return "";
  const actual = num < 1000 ? num * 1000 : num;
  return `Rp ${Math.round(actual).toLocaleString("id-ID")}`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const isCustomer = user?.role === "customer";

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState({ balance: "0.00", currency: "IDR" });
  const [quickSearch, setQuickSearch] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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

  function handleQuickSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    nav(`/domains/register?search=${encodeURIComponent(quickSearch.trim())}`);
  }

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const trimmed = quickSearch.trim();
    const baseKeyword = trimmed.includes(".") ? trimmed.split(".")[0] : trimmed;
    if (baseKeyword.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSuggestLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<any>(
          `/domains/bulk-availability?keyword=${encodeURIComponent(baseKeyword)}`,
          { signal: ctrl.signal }
        );
        const list = (Array.isArray(res) ? res : res?.data || []).slice(0, 5);
        setSuggestions(list);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setSuggestions([]);
          toast.error("Gagal memuat saran domain");
        }
      } finally {
        if (!ctrl.signal.aborted) setSuggestLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [quickSearch]);

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

      {/* Hero Quick Search for Customers */}
      {isCustomer && (
        <Card className="p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
          <form onSubmit={handleQuickSearch} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <div className="relative flex-grow">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="e.g. mybrand or mybrand.com"
                  className="w-full pl-10 pr-4 h-11 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black font-mono shadow-xs"
                />
              </div>
              <button
                type="submit"
                disabled={!quickSearch.trim()}
                className="h-11 px-5 bg-black hover:bg-gray-800 active:bg-gray-900 text-white font-bold text-sm rounded-xl transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>Search</span>
              </button>
            </div>

            {/* Inline suggestions */}
            {quickSearch.trim().length >= 2 && (
              <div className="pt-1">
                {suggestLoading && (
                  <div className="flex flex-wrap gap-2" aria-busy="true">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-8 w-32 bg-gray-100 rounded-full animate-pulse"
                      />
                    ))}
                  </div>
                )}

                {!suggestLoading && suggestions.length === 0 && (
                  <p className="text-xs text-gray-500">
                    Tidak ada hasil untuk "{quickSearch.trim()}".
                  </p>
                )}

                {!suggestLoading && suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s: any) => {
                      const avail = s.available !== false;
                      const label = s.domain || s.tld;
                      return (
                        <button
                          key={s.domain}
                          type="button"
                          onClick={() => nav(`/domains/register?search=${encodeURIComponent(s.domain)}`)}
                          className={`group inline-flex items-center gap-2 px-3 h-8 rounded-full border text-xs font-semibold transition-colors ${
                            avail
                              ? "border-gray-200 hover:border-black hover:bg-gray-50 text-gray-900"
                              : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                          }`}
                          disabled={!avail}
                          title={avail ? `Daftarkan ${s.domain}` : `${s.domain} tidak tersedia`}
                        >
                          <span className="font-mono">{label}</span>
                          <span className={avail ? "text-gray-500" : "text-gray-400"}>
                            {avail ? (s.price ? fmtPrice(s.price) : "Lihat harga") : "Unavailable"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </form>
        </Card>
      )}

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
              <Link to="/domains/register" className="inline-block mt-3 px-4 py-2 bg-black text-white rounded-lg text-xs font-semibold hover:bg-gray-800">
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
