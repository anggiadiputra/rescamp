import { useState } from "react";
import { Card, TableSkeleton, EmptyState, Pagination, Button, SearchBar, Modal, toast, StatCard, StatCardSkeleton } from "../components/ui";
import { api } from "../lib/api";
import { useCachedFetch } from "../contexts/DataCacheContext";
import { Activity, RefreshCw, RotateCcw, AlertTriangle, ShieldCheck, ListChecks, Eye } from "lucide-react";

interface PaymentEvent {
  id: number | string;
  orderId: string | null;
  paymentId: string | null;
  gateway: string | null;
  eventType: string | null;
  outcome: string;
  severity: string;
  detail: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  critical: number;
  warn: number;
  last24h: number;
  unresolved: number;
}

function fmtDateTime(d: any): string {
  if (!d) return "-";
  const parsed = new Date(String(d).replace(" ", "T"));
  if (isNaN(parsed.getTime())) return String(d);
  const dateStr = parsed.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = parsed.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dateStr}, ${timeStr}`;
}

// Neutral, monochrome-friendly severity pill — a dot plus label, no coloured box.
function SeverityPill({ severity }: { severity: string }) {
  const s = String(severity || "").toLowerCase();
  const dot =
    s === "critical" ? "bg-rose-500" : s === "warn" ? "bg-amber-500" : "bg-gray-300";
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-600">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {s || "info"}
    </span>
  );
}

function OutcomeLabel({ outcome }: { outcome: string }) {
  const map: Record<string, string> = {
    processed_successfully: "Pembayaran diproses",
    already_processing: "Sudah diproses",
    amount_mismatch: "Nominal tidak cocok",
    transaction_not_found: "Transaksi tidak ditemukan",
    missing_metadata: "Metadata hilang",
    invalid_metadata: "Metadata tidak valid",
    user_not_found: "Pemilik order tidak ada",
    ignored_event_type: "Event diabaikan",
    ignored_already_completed: "Sudah selesai (diabaikan)",
    missing_order_id: "Order ID tidak ada",
    stuck_alert: "Order macet — perlu review",
    rejected_payment_unresolved: "Pembayaran ditolak & belum tuntas",
    error: "Error pemrosesan",
  };
  return <span className="text-xs font-semibold text-gray-800">{map[outcome] || outcome}</span>;
}

export default function PaymentMonitoringPage() {
  const [page, setPage] = useState(1);
  const [onlyIssues, setOnlyIssues] = useState(true);
  const [search, setSearch] = useState("");
  const [detailModal, setDetailModal] = useState<PaymentEvent | null>(null);
  const [replayOrder, setReplayOrder] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);
  const perPage = 20;

  const { data: stats, refetch: refetchStats } = useCachedFetch<Stats>(
    "payments:monitoring:stats",
    () => api.get<Stats>("/payments/admin/stats"),
  );

  const { data, loading, isRefreshing, refetch } = useCachedFetch<{ data: PaymentEvent[]; meta: any }>(
    `payments:monitoring:${onlyIssues ? "issues" : "all"}:page:${page}`,
    () =>
      api.get<any>(
        `/payments/admin/events?page=${page}&perPage=${perPage}&onlyIssues=${onlyIssues}`,
      ),
  );

  const rows: PaymentEvent[] = data?.data || [];
  const visible = search
    ? rows.filter((r) =>
        [r.orderId, r.paymentId, r.outcome, r.eventType]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search.toLowerCase())),
      )
    : rows;

  async function doReplay() {
    if (!replayOrder) return;
    setReplaying(true);
    try {
      const res: any = await api.post(`/payments/admin/replay/${encodeURIComponent(replayOrder)}`);
      const result = res?.data || res;
      if (result?.ok) {
        toast(result.message || "Order berhasil diproses ulang.");
      } else {
        toast(result?.message || "Replay ditolak oleh sistem.", "error");
      }
      setReplayOrder(null);
      refetch();
      refetchStats();
    } catch (e: any) {
      toast(e?.message || "Gagal memproses ulang order.", "error");
    }
    setReplaying(false);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
            <Activity className="w-5 h-5 text-gray-700" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">Monitoring Pembayaran</h1>
            <p className="text-xs text-gray-500 font-medium">Audit event pembayaran & pemulihan order yang tertahan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOnlyIssues((v) => !v)}
            className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${
              onlyIssues ? "bg-white border-gray-300 text-gray-900" : "bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-800"
            }`}
          >
            {onlyIssues ? "Menampilkan: Perlu perhatian" : "Menampilkan: Semua event"}
          </button>
          <Button variant="outline" size="sm" onClick={() => { refetch(); refetchStats(); }} loading={isRefreshing}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      {!stats ? (
        <StatCardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Total Event" value={stats.total} icon={ListChecks} />
          <StatCard label="Kritis" value={stats.critical} icon={AlertTriangle} />
          <StatCard label="Perlu Ditinjau" value={stats.warn} icon={Eye} />
          <StatCard label="Belum Tuntas" value={stats.unresolved} icon={ShieldCheck} />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={onlyIssues ? "Tidak Ada Masalah Pembayaran" : "Belum Ada Event Pembayaran"}
          description={
            onlyIssues
              ? "Semua event pembayaran terpantau normal. Tidak ada yang perlu ditindaklanjuti."
              : "Event pembayaran akan muncul di sini setelah ada aktivitas webhook."
          }
        />
      ) : (
        <Card className="p-0 overflow-hidden border border-gray-200 shadow-xs rounded-xl">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Log Event</span>
            <SearchBar value={search} onChange={setSearch} placeholder="Cari order / payment ID" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3.5 whitespace-nowrap">Waktu</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Order ID</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Hasil</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Tingkat</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {visible.map((r) => (
                  <tr key={String(r.id)} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-3.5 text-xs text-gray-600 font-medium whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="text-xs font-mono font-semibold text-gray-900">{r.orderId || "-"}</p>
                      {r.paymentId && <p className="text-[10px] text-gray-400 font-mono">{r.paymentId}</p>}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <OutcomeLabel outcome={r.outcome} />
                      {r.eventType && <p className="text-[10px] text-gray-400 mt-0.5">{r.eventType}</p>}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap"><SeverityPill severity={r.severity} /></td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setDetailModal(r)}>
                          <Eye className="w-3.5 h-3.5" /> Detail
                        </Button>
                        {r.orderId && r.severity !== "info" && (
                          <Button variant="outline" size="sm" onClick={() => setReplayOrder(r.orderId)}>
                            <RotateCcw className="w-3.5 h-3.5" /> Proses Ulang
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100">
            <Pagination
              page={page}
              totalPages={data?.meta?.totalPages || 1}
              onPage={setPage}
              totalItems={data?.meta?.total}
              perPage={perPage}
            />
          </div>
        </Card>
      )}

      {/* Detail modal */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title="Detail Event Pembayaran" size="lg">
        {detailModal && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Order ID</p>
                <p className="text-xs font-mono font-semibold text-gray-900 break-all">{detailModal.orderId || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Payment ID</p>
                <p className="text-xs font-mono font-semibold text-gray-900 break-all">{detailModal.paymentId || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Hasil</p>
                <OutcomeLabel outcome={detailModal.outcome} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tingkat</p>
                <SeverityPill severity={detailModal.severity} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Gateway / Event</p>
                <p className="text-xs text-gray-700 font-medium">{detailModal.gateway || "-"} · {detailModal.eventType || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Waktu</p>
                <p className="text-xs text-gray-700 font-medium">{fmtDateTime(detailModal.createdAt)}</p>
              </div>
            </div>
            {detailModal.detail && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Detail Teknis</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[11px] text-gray-700 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                  {(() => { try { return JSON.stringify(JSON.parse(detailModal.detail), null, 2); } catch { return detailModal.detail; } })()}
                </pre>
              </div>
            )}
            {detailModal.orderId && detailModal.severity !== "info" && (
              <div className="pt-2 flex justify-end">
                <Button onClick={() => { setReplayOrder(detailModal.orderId); setDetailModal(null); }}>
                  <RotateCcw className="w-4 h-4" /> Proses Ulang Order Ini
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Replay confirm */}
      <Modal open={!!replayOrder} onClose={() => !replaying && setReplayOrder(null)} title="Konfirmasi Proses Ulang" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Sistem akan memproses ulang order <span className="font-mono font-bold">{replayOrder}</span>.
            Pastikan customer sudah benar-benar membayar — proses ini meneruskan order ke registrar dan
            memotong saldo reseller.
          </p>
          <p className="text-xs text-gray-500">
            Order dengan nominal tidak cocok akan tetap ditolak oleh sistem.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReplayOrder(null)} disabled={replaying}>Batal</Button>
            <Button onClick={doReplay} loading={replaying}>
              <RotateCcw className="w-4 h-4" /> Proses Ulang
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
