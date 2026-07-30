import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, RefreshCw, ArrowRightLeft, Plus, Settings } from "lucide-react";
import { Card, Button, Badge, LoadingSpinner, EmptyState, SearchBar, Pagination, toast } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import type { Domain, PaginatedResponse } from "../lib/types";

export default function DomainsPage() {
  const { user } = useAuth();
  const isCustomer = user?.role === "customer";
  const nav = useNavigate();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchDomains = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    api.get<PaginatedResponse<Domain>>(`/domains?${params}`)
      .then((res) => { setDomains(res.data); setTotal(res.meta.total); })
      .catch((err: any) => { console.error(err); })
      .finally(() => { setLoading(false); });
  };

  useEffect(() => {
    fetchDomains();
  }, [search, page, statusFilter]);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res: any = await api.post("/domains/sync");
      const msg = res?.message || "Berhasil sinkronisasi domain dari Resellercamp";
      toast(`🎉 ${msg}`);
      fetchDomains();
    } catch (err: any) {
      toast(err.message || "Gagal sinkronisasi domain", "error");
    }
    setSyncing(false);
  }

  if (loading && !syncing) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Domains</h1>
        <div className="flex items-center gap-2">
          {!isCustomer && (
            <Button onClick={handleSync} disabled={syncing} variant="outline">
              <RefreshCw className={`w-3.5 h-3.5 mr-1 inline ${syncing ? "animate-spin text-black" : ""}`} />
              {syncing ? "Syncing..." : "Sync dari Resellercamp"}
            </Button>
          )}
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
          {["", "active", "pending", "expired", "suspended"].map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${statusFilter === s ? "bg-black text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              {s || "all"}
            </button>
          ))}
        </div>
      </div>

      {domains.length === 0 ? (
        <EmptyState icon={Search} title="No domains found" description="Register your first domain to get started" action={{ label: "Register Domain", onClick: () => nav("/domains/register") }} />
      ) : (
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
                {domains.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900 font-semibold">{d.domainName}</td>
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
            {domains.map((d) => (
              <Link key={d.id} to={`/domains/${d.liquidOrderId || d.id}`} className="block rounded-xl p-4 shadow-sm border bg-white hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{d.domainName}</p>
                    <p className="text-xs text-gray-500 mt-1">Expires: {d.expiryDate || "-"}</p>
                  </div>
                  <Badge status={d.status} />
                </div>
              </Link>
            ))}
          </div>
          <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-t border-gray-100">
            <span className="text-xs text-gray-500 font-medium">Showing {domains.length} of {total} domains</span>
            <Pagination page={page} totalPages={Math.ceil(total / perPage)} onPage={setPage} />
          </div>
        </Card>
      )}
    </div>
  );
}
