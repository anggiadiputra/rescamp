import { Globe, AlertCircle, Clock, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { StatCard, Card, LoadingSpinner, Button } from "../components/ui";
import { api } from "../lib/api";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import type { Domain, PaginatedResponse } from "../lib/types";

function fmtBalance(amount: any, currency: string = "IDR"): string {
  const num = Number(amount || 0);
  if (isNaN(num)) return `${currency} 0`;
  const actual = num < 10000 && currency === "IDR" ? num * 1000 : num;
  return `${currency} ${Math.round(actual).toLocaleString("id-ID")}`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const isCustomer = user?.role === "customer";

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState({ balance: "0.00", currency: "IDR" });
  const [quickSearch, setQuickSearch] = useState("");

  useEffect(() => {
    const promises: Promise<any>[] = [
      api.get<PaginatedResponse<Domain>>("/domains?per_page=5"),
    ];

    if (!isCustomer) {
      promises.push(api.get<any>("/billing/balance"));
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

  if (loading) return <LoadingSpinner />;

  const active = domains.filter((d) => d.status === "active").length;
  const expired = domains.filter((d) => d.status === "expired").length;
  const expiring = domains.filter((d) => d.expiryDate && new Date(d.expiryDate) < new Date(Date.now() + 30 * 86400000) && d.status === "active").length;

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
        <Link to="/domains/register">
          <Button className="bg-black hover:bg-gray-800 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-lg">
            + Register New Domain
          </Button>
        </Link>
      </div>

      {/* Hero Quick Search for Customers */}
      {isCustomer && (
        <Card className="p-6 bg-black text-white border-0 shadow-md rounded-2xl">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <h2 className="text-base font-bold text-white">Find & Register a New Domain</h2>
            </div>
            <p className="text-xs text-gray-300">Type a keyword or domain name to search real-time customer prices.</p>
            <form onSubmit={handleQuickSearch} className="flex items-center gap-2 pt-1">
              <div className="relative flex-grow">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="e.g. mybrand or mybrand.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 text-white rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white font-mono shadow-inner"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-white hover:bg-gray-100 text-black font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs shrink-0 flex items-center gap-1.5"
              >
                Search <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </Card>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Total Domains" value={domains.length} icon={Globe} />
        <StatCard label="Active" value={active} icon={CheckCircle2} />
        <StatCard label="Expiring Soon" value={expiring} icon={Clock} />
        <StatCard label="Expired" value={expired} icon={AlertCircle} />
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
                <div key={d.id} className="py-3 flex items-center justify-between">
                  <div>
                    <Link to={`/domains/${d.id}`} className="text-sm font-mono font-bold text-gray-900 hover:text-black">
                      {d.domainName}
                    </Link>
                    <p className="text-[11px] text-gray-400 mt-0.5">Expires: {d.expiryDate || "-"}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    d.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"
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
