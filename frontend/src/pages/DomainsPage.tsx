import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, RefreshCw, ArrowRightLeft, Plus, Settings, AlertTriangle } from "lucide-react";
import { Card, Button, Badge, LoadingSpinner, EmptyState, SearchBar, Pagination, toast } from "../components/ui";
import { api } from "../lib/api";
import type { Domain, PaginatedResponse } from "../lib/types";

export default function DomainsPage() {
  const nav = useNavigate();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchDomains = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    // All roles: fetch live from Resellercamp (no DB cache) to match dashboard exactly.
    api.get<PaginatedResponse<Domain>>(`/domains/remote?${params}`)
      .then((res) => { setDomains(res.data); setTotal(res.meta.total); })
      .catch((err: any) => {
        console.error(err);
        toast(err?.message || "Gagal memuat domain", "error");
      })
      .finally(() => { setLoading(false); });
  };

  useEffect(() => {
    fetchDomains();
  }, [page]);

  if (loading) return <LoadingSpinner />;

  // /domains/remote has no server-side search; filter client-side for all roles.
  const visibleDomains = domains
    .filter((d) => !search || d.domainName.toLowerCase().includes(search.toLowerCase()))
    .filter((d) => !statusFilter || d.status === statusFilter);

  const suspendedDomains = visibleDomains.filter((d) => d.status === "suspended");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Domains</h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => fetchDomains()} disabled={loading} variant="outline">
            <RefreshCw className={`w-3.5 h-3.5 mr-1 inline ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link to="/domains/register?tab=transfer">
            <Button><ArrowRightLeft className="w-3.5 h-3.5 mr-1 inline" /> Transfer Domain</Button>
          </Link>
          <Link to="/domains/register">
            <Button><Plus className="w-3.5 h-3.5 mr-1 inline" /> Register Domain</Button>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search domains..." />
        <div className="flex gap-1.5 flex-wrap">
          {["", "active", "pending", "expired", "suspended", "cancelled"].map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${statusFilter === s ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s || "all"}
            </button>
          ))}
        </div>
      </div>

      {visibleDomains.length === 0 ? (
        <EmptyState icon={Search} title="No domains found" description="Register your first domain to get started" action={{ label: "Register Domain", onClick: () => nav("/domains/register") }} />
      ) : (
        <>
          {suspendedDomains.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
              <div className="p-2 bg-rose-600 text-white rounded-lg shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-black text-rose-900 uppercase tracking-wider">
                  {suspendedDomains.length} Domain Di-Suspend
                </h3>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  Domain dalam status suspend tidak dapat diakses. Hubungi admin untuk membuka suspend.
                </p>
                <ul className="mt-2 space-y-1">
                  {suspendedDomains.map((d) => (
                    <li key={d.liquidOrderId || d.id} className="text-[11px] text-rose-900">
                      <span className="font-mono font-bold">{d.domainName}</span>
                      {d.suspendedAt && (
                        <span className="text-rose-700"> · sejak {new Date(d.suspendedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
                      )}
                      {d.suspendReason && (
                        <span className="block text-rose-800 mt-0.5">Alasan: {d.suspendReason}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <Card className="p-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Domain</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiry</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleDomains.map((d) => (
                  <tr key={d.liquidOrderId || d.id} className={`hover:bg-gray-50/50 transition-colors ${d.status === "suspended" ? "bg-rose-50/40" : ""}`}>
                    <td className="px-4 py-3 text-sm text-gray-900 font-semibold">
                      {d.domainName}
                      {d.status === "suspended" && d.suspendReason && (
                        <p className="text-[11px] text-rose-700 font-normal mt-0.5 truncate max-w-xs" title={d.suspendReason}>
                          Alasan: {d.suspendReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.expiryDate || "-"}</td>
                    <td className="px-4 py-3"><Badge status={d.status} /></td>
                    <td className="px-4 py-3 text-right">
                    <Link to={`/domains/${d.liquidOrderId || d.id}`}>
                      <Button variant="icon"><Settings className="w-3.5 h-3.5" /></Button>
                    </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="block md:hidden divide-y divide-gray-100 p-4 space-y-4">
            {visibleDomains.map((d) => (
              <Link key={d.liquidOrderId || d.id} to={`/domains/${d.liquidOrderId || d.id}`} className={`block rounded-xl p-4 shadow-sm border bg-white hover:shadow-md transition-shadow ${d.status === "suspended" ? "border-rose-200 bg-rose-50/30" : ""}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">{d.domainName}</p>
                    <p className="text-xs text-gray-500 mt-1">Expires: {d.expiryDate || "-"}</p>
                    {d.status === "suspended" && d.suspendReason && (
                      <p className="text-[11px] text-rose-700 mt-1">Alasan: {d.suspendReason}</p>
                    )}
                  </div>
                  <Badge status={d.status} />
                </div>
              </Link>
            ))}
          </div>
          <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-t border-gray-100">
            <span className="text-xs text-gray-500 font-medium">Showing {visibleDomains.length} of {total} domains · Live from Resellercamp</span>
            <Pagination page={page} totalPages={Math.ceil(total / perPage)} onPage={setPage} />
          </div>
        </Card>
        </>
      )}
    </div>
  );
}
