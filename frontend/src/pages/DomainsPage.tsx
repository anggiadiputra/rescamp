import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, RefreshCw, ArrowRightLeft, Plus, AlertTriangle, RotateCw, ChevronRight } from "lucide-react";
import { Card, Button, Badge, TableSkeleton, EmptyState, SearchBar, Pagination } from "../components/ui";
import { api } from "../lib/api";
import type { Domain, PaginatedResponse } from "../lib/types";
import { useSettings } from "../contexts/SettingsContext";
import { useCachedFetch } from "../contexts/DataCacheContext";
import { useAuth } from "../contexts/AuthContext";

const RENEW_SOON_DAYS = 30;

/** Parse the date part of "YYYY-MM-DD[ T]hh:mm:ss" as a local calendar date. */
function parseDateOnly(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const m = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "6 Apr 2027" — unambiguous, unlike 06/04/2027. */
function formatDate(dateStr?: string | null): string {
  const d = parseDateOnly(dateStr);
  return d ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-";
}

function daysUntil(dateStr?: string | null): number | null {
  const d = parseDateOnly(dateStr);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function formatRupiah(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`;
}

/** Renewal price per year for a TLD from /billing/prices (values < 1000 are in thousands). */
function renewPriceFor(prices: Record<string, any> | null | undefined, tld?: string | null): number | null {
  const info = prices?.[String(tld || "").toLowerCase()];
  const raw = Number(info?.price_renew);
  if (!info || !Number.isFinite(raw) || raw <= 0) return null;
  return raw < 1000 ? raw * 1000 : raw;
}

function ExpiryInfo({ domain, compact = false }: { domain: Domain; compact?: boolean }) {
  const days = daysUntil(domain.expiryDate);
  let tone = "text-gray-500";
  let label = "";
  if (days !== null) {
    if (days < 0) { tone = "text-red-600 font-semibold"; label = `Lewat ${Math.abs(days)} hari`; }
    else if (days === 0) { tone = "text-red-600 font-semibold"; label = "Berakhir hari ini"; }
    else if (days <= 7) { tone = "text-red-600 font-semibold"; label = `${days} hari lagi`; }
    else if (days <= RENEW_SOON_DAYS) { tone = "text-amber-600 font-semibold"; label = `${days} hari lagi`; }
    else { label = `${days} hari lagi`; }
  }
  return (
    <div className={compact ? "flex items-baseline gap-1.5 flex-wrap" : ""}>
      <p className={`text-gray-900 ${compact ? "text-xs" : "text-sm"}`}>{formatDate(domain.expiryDate)}</p>
      {label && <p className={`text-xs ${compact ? "" : "mt-0.5"} ${tone}`}>{label}</p>}
    </div>
  );
}

function canRenew(d: Domain): boolean {
  return d.status === "active" || d.status === "expired";
}

function needsRenewal(d: Domain): boolean {
  const days = daysUntil(d.expiryDate);
  return canRenew(d) && days !== null && days <= RENEW_SOON_DAYS;
}

export default function DomainsPage() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, loading, isRefreshing, refetch } = useCachedFetch<PaginatedResponse<Domain>>(
    `domains:user:${user?.id || 0}:page:${page}`,
    () => api.get<PaginatedResponse<Domain>>(`/domains/remote?page=${page}&per_page=${perPage}`),
    [page, user?.id]
  );

  // Public price list — only used to show the renewal price per row.
  const { data: prices } = useCachedFetch<Record<string, any>>(
    "billing:prices",
    () => api.get<Record<string, any>>("/billing/prices"),
    []
  );

  const goRenew = (e: React.MouseEvent, d: Domain) => {
    e.preventDefault();
    e.stopPropagation();
    nav(`/domains/${d.liquidOrderId || d.id}?renew=1`);
  };

  const domains = data?.data || [];
  const total = data?.meta?.total || 0;

  if (loading && !data) return <TableSkeleton rows={5} cols={5} />;

  // /domains/remote has no server-side search; filter client-side for all roles.
  const visibleDomains = domains
    .filter((d) => !search || d.domainName.toLowerCase().includes(search.toLowerCase()))
    .filter((d) => !statusFilter || d.status === statusFilter);

  const suspendedDomains = visibleDomains.filter((d) => d.status === "suspended");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Domains</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kelola domain, masa berlaku, dan perpanjangan.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => refetch()} disabled={isRefreshing} variant="outline">
            <RefreshCw className={`w-3.5 h-3.5 mr-1 inline ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link to="/domains/register?tab=transfer">
            <Button><ArrowRightLeft className="w-3.5 h-3.5 mr-1 inline" /> Transfer</Button>
          </Link>
          <Link to="/domains/register">
            <Button><Plus className="w-3.5 h-3.5 mr-1 inline" /> Register</Button>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search domains..." />
        <div className="flex gap-1.5 flex-wrap">
          {["", "active", "pending", "expired", "suspended", "cancelled"].map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              style={statusFilter === s ? { backgroundColor: settings.primary_color || "#000000", color: "#ffffff" } : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer ${statusFilter === s ? "shadow-2xs text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
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
          <Card className="p-0 overflow-hidden bg-white border border-gray-200 rounded-xl shadow-xs">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-3.5 whitespace-nowrap">Domain</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Status</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Masa Berlaku</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Perpanjangan</th>
                  <th className="px-3 py-3.5 whitespace-nowrap"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white text-sm">
                {visibleDomains.map((d) => {
                  const renewPrice = renewPriceFor(prices, d.tld);
                  return (
                    <tr
                      key={d.liquidOrderId || d.id}
                      onClick={() => nav(`/domains/${d.liquidOrderId || d.id}`)}
                      className={`hover:bg-gray-50/70 transition-colors cursor-pointer group ${
                        d.status === "suspended" ? "bg-rose-50/40" : ""
                      }`}
                    >
                      <td className="px-3 py-3.5 text-sm font-bold text-gray-900 group-hover:text-black">
                        <span className="break-all">{d.domainName}</span>
                        {d.status === "suspended" && d.suspendReason && (
                          <p className="text-[11px] text-rose-700 font-normal mt-0.5 truncate max-w-[14rem]" title={d.suspendReason}>
                            Alasan: {d.suspendReason}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap"><Badge status={d.status} /></td>
                      <td className="px-3 py-3.5 whitespace-nowrap"><ExpiryInfo domain={d} /></td>
                      <td className="px-3 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                        {renewPrice ? <>{formatRupiah(renewPrice)}<span className="text-gray-400">/thn</span></> : "-"}
                      </td>
                      <td className="pl-2 pr-3 py-3.5 text-right whitespace-nowrap w-px">
                        {needsRenewal(d) ? (
                          <Button size="sm" onClick={(e: React.MouseEvent) => goRenew(e, d)}>
                            <RotateCw className="w-3.5 h-3.5 mr-1 inline" /> Perpanjang
                          </Button>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 inline" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="block md:hidden divide-y divide-gray-100 p-4 space-y-4">
            {visibleDomains.map((d) => {
              const renewPrice = renewPriceFor(prices, d.tld);
              return (
                <Link key={d.liquidOrderId || d.id} to={`/domains/${d.liquidOrderId || d.id}`} className={`block rounded-xl p-4 shadow-sm border bg-white hover:shadow-md transition-shadow ${d.status === "suspended" ? "border-rose-200 bg-rose-50/30" : ""}`}>
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-bold text-gray-900 min-w-0 break-all">{d.domainName}</p>
                    <Badge status={d.status} />
                  </div>
                  <div className="mt-2">
                    <ExpiryInfo domain={d} compact />
                  </div>
                  {d.status === "suspended" && d.suspendReason && (
                    <p className="text-[11px] text-rose-700 mt-1">Alasan: {d.suspendReason}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500">
                      {renewPrice ? <>Perpanjang {formatRupiah(renewPrice)}/thn</> : "\u00a0"}
                    </p>
                    {needsRenewal(d) && (
                      <Button size="sm" onClick={(e: React.MouseEvent) => goRenew(e, d)}>
                        <RotateCw className="w-3.5 h-3.5 mr-1 inline" /> Perpanjang
                      </Button>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-t border-gray-100">
            <span className="text-xs text-gray-500 font-medium">Showing {visibleDomains.length} of {total} domains</span>
            <Pagination page={page} totalPages={Math.ceil(total / perPage)} onPage={setPage} />
          </div>
        </Card>
        </>
      )}
    </div>
  );
}
