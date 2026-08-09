import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Card, LoadingSpinner, EmptyState, Modal, Pagination, Button, SearchBar, toast } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { Printer, CheckCircle2, Receipt, AlertTriangle, X, AlertCircle, RefreshCw, ShoppingBag, CreditCard } from "lucide-react";
import type { Transaction, PaginatedResponse } from "../lib/types";

function fmtPrice(amount: any, currency: string = "IDR"): string {
  const num = Number(amount || 0);
  if (isNaN(num)) return `${currency} 0`;
  const actual = num < 1000 && currency === "IDR" ? num * 1000 : num;
  return `${currency} ${Math.round(actual).toLocaleString("id-ID")}`;
}

function fmtDateTime(d: any): string {
  if (!d) return "";
  const cleanStr = String(d).replace(" ", "T");
  const dateObj = new Date(cleanStr);
  if (isNaN(dateObj.getTime())) return String(d);
  const dateStr = dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dateStr}, ${timeStr} WIB`;
}

// Unified: all invoice numbers use INV- prefix (retail Sumopod INV-{TYPE}-{ms}-{uuid}, wholesale INV-{txnId}).
function getInvoiceNumber(t: any): string {
  if (!t) return "";
  if (t.orderId) return t.orderId;
  if (t.metadata) {
    try {
      const meta = typeof t.metadata === "string" ? JSON.parse(t.metadata) : t.metadata;
      if (meta.orderId) return meta.orderId;
    } catch {}
  }
  if (t.paymentId) return t.paymentId;
  if (t.liquidTransactionId) return `INV-${t.liquidTransactionId}`;
  const numStr = String(t.id).padStart(6, "0");
  return `INV-${numStr}`;
}

function getTxnInfo(t: any) {
  let orderId = getInvoiceNumber(t);
  let domainName = "Domain Order";
  let years = 1;
  let fee = 0;
  let paymentLinkUrl = t.paymentLinkUrl || "";
  let expiresAt = "";
  let registerDate = "";
  let expiryDate = "";

  if (t.metadata) {
    try {
      const meta = typeof t.metadata === "string" ? JSON.parse(t.metadata) : t.metadata;
      if (meta.orderId) orderId = meta.orderId;
      if (meta.domainName) domainName = meta.domainName;
      if (meta.years) years = Number(meta.years) || 1;
      if (meta.fee) fee = Number(meta.fee);
      if (meta.paymentLinkUrl) paymentLinkUrl = meta.paymentLinkUrl;
      if (meta.expiresAt) expiresAt = meta.expiresAt;
      if (meta.expiryDate) expiryDate = meta.expiryDate;
    } catch {}
  }

  if (!expiresAt) {
    const createdAtTime = t.createdAt ? new Date(String(t.createdAt).replace(" ", "T")).getTime() : Date.now();
    expiresAt = new Date(createdAtTime + 60 * 60 * 1000).toISOString();
  }

  // Register/expiry dates for description suffix
  if (t.createdAt) {
    const c = new Date(String(t.createdAt).replace(" ", "T"));
    if (!isNaN(c.getTime())) {
      registerDate = c.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      if (!expiryDate) {
        const e = new Date(c);
        e.setFullYear(e.getFullYear() + years);
        expiryDate = e.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      } else {
        const parsed = new Date(expiryDate);
        if (!isNaN(parsed.getTime())) expiryDate = parsed.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      }
    }
  }

  if (domainName === "Domain Order" && t.description) {
    const match = t.description.match(/(?:Order register domain:|Order transfer domain:|domain:)\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (match) domainName = match[1];
  }

  const amtNum = Number(t.amount || 0);
  const actualAmt = amtNum < 1000 ? amtNum * 1000 : amtNum;
  if (!fee && actualAmt > 0) {
    fee = Math.round(actualAmt * 0.007 + 300);
  }

  return { orderId, domainName, years, fee, paymentLinkUrl, amount: actualAmt, expiresAt, registerDate, expiryDate };
}

function parseTargetTime(expiresAt?: string | Date | number): number {
  if (!expiresAt) return Date.now() + 60 * 60 * 1000;
  if (typeof expiresAt === "number") return expiresAt;
  if (expiresAt instanceof Date) return expiresAt.getTime();
  const cleanStr = String(expiresAt).replace(" ", "T");
  const parsed = new Date(cleanStr).getTime();
  return isNaN(parsed) ? Date.now() + 60 * 60 * 1000 : parsed;
}

function getEffectiveStatus(t: Transaction): string {
  if (t.status === "completed") return "completed";
  if (t.status === "cancelled" || t.status === "expired" || t.status === "failed") return t.status;
  if (t.status === "pending_payment" || (t as any).paymentStatus === "pending") {
    const meta = (t as any).metadata;
    const isSynced = (t as any).isWholesale || (t as any).invoiceType === "wholesale" || (typeof meta === "string" && meta.includes('"syncedFromLiquid":true'));
    if (!isSynced) {
      const info = getTxnInfo(t);
      const targetTime = parseTargetTime(info.expiresAt);
      if (Date.now() > targetTime) {
        return "expired";
      }
    }
    return "pending_payment";
  }
  return t.status;
}

function isPending(t: Transaction): boolean {
  return getEffectiveStatus(t) === "pending_payment";
}

function renderStatusBadge(t: Transaction) {
  const status = getEffectiveStatus(t);
  if (status === "pending_payment") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" /> PENDING
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> PAID
      </span>
    );
  }
  if (status === "expired" || status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 uppercase tracking-wider">
        <AlertCircle className="w-3 h-3 text-red-600" /> {status.toUpperCase()}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200 uppercase tracking-wider">
      {status.toUpperCase()}
    </span>
  );
}

export default function BillingPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const taxEnabled = settings?.tax_enabled === "true" || settings?.tax_enabled === true;
  const taxRate = parseFloat(String(settings?.tax_rate || "0")) || 0;
  const taxLabel = String(settings?.tax_label || "PPN");
  const isCustomer = user?.role === "customer";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const returnStatus = searchParams.get("status");
  const returnOrderId = searchParams.get("order_id");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState({ balance: "0.00", currency: "IDR" });
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [billingSyncing, setBillingSyncing] = useState(false);
  const perPage = 10;

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Transaction | null>(null);

  const [categoryTab, setCategoryTab] = useState<"retail" | "wholesale">("retail");

  const fetchTxns = useCallback(() => {
    setTableLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    // Wholesale tab: live Resellercamp account/transactions (no DB cache, no status/search server params).
    // Retail tab: DB cache (locally created invoices).
    const isWholesale = !isCustomer && categoryTab === "wholesale";

    let url: string;
    if (isWholesale) {
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      url = `/billing/transactions/remote?${params}`;
    } else {
      if (statusFilter) params.set("status", statusFilter);
      if (!isCustomer) params.set("category", categoryTab);
      if (search.trim()) params.set("search", search.trim());
      url = `/billing/transactions?${params}`;
    }

    const promises: Promise<any>[] = [
      api.get<PaginatedResponse<Transaction>>(url).catch(() => ({ data: [], meta: { total: 0 } })),
    ];

    if (!isCustomer) {
      promises.push(api.get<any>("/billing/balance").catch(() => ({ balance: "0.00", currency: "IDR" })));
    }

    Promise.all(promises).then(([txns, bal]) => {
      setTransactions(txns.data || []);
      setTotal(txns.meta?.total || 0);
      if (bal) {
        const b = typeof bal === "object" ? bal : { balance: String(bal), currency: "IDR" };
        setBalance(b);
      }
    }).finally(() => {
      setTableLoading(false);
      setInitialLoading(false);
    });
  }, [page, statusFilter, isCustomer, perPage, categoryTab, search]);

  useEffect(() => {
    if (returnOrderId) {
      api.get(`/payments/status/${returnOrderId}`).catch(() => {}).finally(() => {
        fetchTxns();
      });
    } else {
      fetchTxns();
    }
  }, [fetchTxns, returnStatus, returnOrderId]);

  function clearReturnStatus() {
    searchParams.delete("status");
    searchParams.delete("order_id");
    setSearchParams(searchParams);
  }

  async function doBillingSync() {
    if (billingSyncing) return;
    setBillingSyncing(true);
    try {
      const res: any = await api.post("/billing/sync");
      const synced = res?.data?.synced || res?.synced || 0;
      if (synced > 0) toast(`${synced} transactions synced from Resellercamp`);
      fetchTxns();
    } catch (e: any) { toast(e.message, "error"); }
    setBillingSyncing(false);
  }

  async function openInvoice(txn: Transaction) {
    try {
      const targetId = (txn as any).liquidTransactionId || txn.id;
      const d = await api.get<Transaction>(`/billing/transactions/${targetId}`);
      setDetail(d);
    } catch {
      setDetail(txn);
    }
    setDetailOpen(true);
  }

  function handleInvoiceClick(t: Transaction) {
    const info = getTxnInfo(t);
    const orderId = info.orderId || getInvoiceNumber(t);
    if (!orderId) return;
    navigate(`/billing/pay/${orderId}`);
  }

  if (initialLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Billing & Transaksi</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola faktur tagihan, pembayaran, dan riwayat transaksi pendaftaran domain Anda.</p>
        </div>
        {!isCustomer && balance.balance !== "0.00" && (
          <div className="text-xs sm:text-sm font-semibold text-gray-700 bg-gray-100 px-3.5 py-2 rounded-xl border border-gray-200 shadow-2xs">
            Saldo Deposit: <span className="font-bold text-black">{balance.currency} {Number(balance.balance).toLocaleString("id-ID")}</span>
          </div>
        )}
      </div>

      {returnStatus === "success" && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs space-y-3 animate-fade-in text-emerald-950">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700 shrink-0 mt-0.5">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-emerald-900">Pembayaran Berhasil Dikonfirmasi! 🎉</h3>
                <p className="text-xs sm:text-sm text-emerald-800 mt-0.5">
                  Tagihan <strong className="font-semibold">{returnOrderId || "Sumopod"}</strong> telah berhasil dibayar. Domain Anda sedang diproses dan diaktifkan secara otomatis.
                </p>
              </div>
            </div>
            <button onClick={clearReturnStatus} className="text-emerald-700 hover:text-emerald-950 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Link to="/domains" className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-2xs">
              Lihat Daftar Domain Saya →
            </Link>
            <button onClick={clearReturnStatus} className="px-4 py-2 border border-emerald-300 hover:bg-emerald-100 text-emerald-900 font-semibold text-xs sm:text-sm rounded-xl transition-colors">
              Tutup Notifikasi
            </button>
          </div>
        </div>
      )}

      {returnStatus === "cancel" && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl shadow-xs space-y-3 animate-fade-in text-amber-950">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-amber-900">Pembayaran Dibatalkan</h3>
                <p className="text-xs sm:text-sm text-amber-800 mt-0.5">
                  Tagihan <strong className="font-semibold">{returnOrderId || "Sumopod"}</strong> belum diselesaikan atau dibatalkan saat di halaman Sumopod. Anda dapat melakukan pembayaran ulang kapan saja.
                </p>
              </div>
            </div>
            <button onClick={clearReturnStatus} className="text-amber-700 hover:text-amber-950 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Link to="/domains/register" className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-2xs">
              Kembali ke Pencarian Domain
            </Link>
            <button onClick={clearReturnStatus} className="px-4 py-2 border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold text-xs sm:text-sm rounded-xl transition-colors">
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 flex flex-col sm:flex-row items-center gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Cari invoice berdasarkan nomor atau deskripsi..." />
        <div className="flex gap-1.5 flex-wrap">
          {["", "pending_payment", "completed", "expired", "cancelled", "failed"].map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${
                statusFilter === s ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {s === "" ? "all" : s === "pending_payment" ? "pending" : s}
            </button>
          ))}
        </div>
        {!isCustomer && (
          <Button variant="outline" onClick={doBillingSync} disabled={billingSyncing} className="ml-auto shrink-0 text-xs sm:text-sm !py-2">
            <RefreshCw className={`w-4 h-4 inline mr-1.5 ${billingSyncing ? "animate-spin" : ""}`} />
            {billingSyncing ? "Syncing..." : "Sync Wholesale"}
          </Button>
        )}
      </div>

      <Card className="p-0 overflow-hidden bg-white border border-gray-200 rounded-xl shadow-xs">
        <div className="p-4 sm:p-5 space-y-3 border-b border-gray-100">
          {!isCustomer && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setCategoryTab("retail"); setPage(1); }}
                className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                  categoryTab === "retail"
                    ? "bg-gray-900 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                Invoice Customer
              </button>
              <button
                onClick={() => { setCategoryTab("wholesale"); setPage(1); }}
                className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                  categoryTab === "wholesale"
                    ? "bg-gray-900 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Mutasi &amp; Deposit Reseller
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {isCustomer
                  ? "Riwayat Tagihan & Invoice"
                  : categoryTab === "retail"
                  ? "Invoice Penjualan Customer (Retail)"
                  : "Mutasi & Potong Saldo Reseller (Wholesale)"}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {isCustomer
                  ? "Daftar seluruh transaksi pendaftaran, perpanjangan, dan transfer domain Anda."
                  : categoryTab === "retail"
                  ? "Daftar faktur tagihan penjualan domain resmi yang ditagihkan kepada Customer."
                  : "Daftar mutasi pemotongan dan topup saldo deposit."}
              </p>
            </div>
          </div>
        </div>

        {tableLoading && transactions.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <LoadingSpinner size="md" />
            <span className="text-xs sm:text-sm text-gray-500 font-medium">Memuat data transaksi...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={Receipt}
              title={isCustomer ? "No invoices found" : "No transactions yet"}
              description={isCustomer ? "Your domain registration invoices will appear here once registered." : "System transactions will appear here."}
            />
          </div>
        ) : (
          <>
            <div className={`transition-opacity duration-150 ${tableLoading ? "opacity-40 pointer-events-none" : ""}`}>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3.5 whitespace-nowrap">Invoice #</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Date</th>
                      <th className="px-4 py-3.5 min-w-[280px]">Description</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Berlaku Hingga</th>
                      <th className="px-4 py-3.5 text-right whitespace-nowrap">Amount</th>
                      <th className="px-4 py-3.5 text-center whitespace-nowrap">Status</th>
                      <th className="px-4 py-3.5 text-right whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white text-sm">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/70 transition-colors group">
                        <td className="px-4 py-3.5 text-sm font-bold text-gray-900 whitespace-nowrap">
                          #{getInvoiceNumber(t)}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                          {new Date(t.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-800 font-medium">
                          {(() => {
                            const fallback = t.description || `${t.type === "domain" ? "Domain Registration Order" : "Service Order"}`;
                            if ((t as any).isWholesale || (t as any).invoiceType === "wholesale") return fallback;
                            if (t.type !== "register" && t.type !== "transfer" && t.type !== "renew" && t.type !== "privacy") return fallback;
                            const info = getTxnInfo(t);
                            if (!info.registerDate || !info.expiryDate) return fallback;
                            const typeLabel = t.type === "register" ? "Domain register" : t.type === "transfer" ? "Domain transfer" : t.type === "renew" ? "Domain renewal" : "WHOIS Privacy";
                            return `${typeLabel} - ${info.domainName} (${info.years} yr) - ${info.registerDate} → ${info.expiryDate}`;
                          })()}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                          {(() => {
                            const info = getTxnInfo(t);
                            if (!info.expiresAt) return "—";
                            const dt = new Date(info.expiresAt);
                            if (isNaN(dt.getTime())) return "—";
                            return dt.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
                          })()}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-900 font-bold text-right whitespace-nowrap">
                          {fmtPrice(t.amount)}
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {renderStatusBadge(t)}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {isPending(t) ? (
                            <button
                              onClick={() => handleInvoiceClick(t)}
                              className="px-3.5 py-2 bg-black hover:bg-gray-800 text-white text-xs font-bold rounded-lg transition-all shadow-2xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <CreditCard className="w-3.5 h-3.5" /> Bayar Sekarang
                            </button>
                          ) : (
                            <button
                              onClick={() => openInvoice(t)}
                              className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 hover:text-black text-xs font-bold rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <Receipt className="w-3.5 h-3.5 text-gray-500" /> Invoice
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3 p-4">
                {transactions.map((t) => (
                  <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">#{getInvoiceNumber(t)}</span>
                      {renderStatusBadge(t)}
                    </div>
                    <p className="text-xs text-gray-700 font-medium">
                      {(() => {
                        const fallback = t.description || "Service Order";
                        if ((t as any).isWholesale || (t as any).invoiceType === "wholesale") return fallback;
                        if (t.type !== "register" && t.type !== "transfer" && t.type !== "renew" && t.type !== "privacy") return fallback;
                        const info = getTxnInfo(t);
                        if (!info.registerDate || !info.expiryDate) return fallback;
                        const typeLabel = t.type === "register" ? "Domain register" : t.type === "transfer" ? "Domain transfer" : t.type === "renew" ? "Domain renewal" : "WHOIS Privacy";
                        return `${typeLabel} - ${info.domainName} (${info.years} yr) - ${info.registerDate} → ${info.expiryDate}`;
                      })()}
                    </p>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <span className="text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span className="text-sm font-bold text-gray-900">{fmtPrice(t.amount)}</span>
                    </div>
                    {isPending(t) ? (
                      <button
                        onClick={() => handleInvoiceClick(t)}
                        className="w-full mt-1 px-3 py-2.5 bg-black hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4" /> Bayar Sekarang
                      </button>
                    ) : (
                      <button
                        onClick={() => openInvoice(t)}
                        className="w-full mt-1 px-3 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Receipt className="w-4 h-4 text-gray-500" /> Invoice
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {total > perPage && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                <Pagination
                  page={page}
                  totalPages={Math.ceil(total / perPage)}
                  onPage={(p) => {
                    setPage(p);
                  }}
                  totalItems={total}
                  perPage={perPage}
                />
              </div>
            )}
          </>
        )}
      </Card>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={(detail as any)?.isWholesale || (detail as any)?.invoiceType === "wholesale" ? "Reseller Wholesale Balance Receipt" : "Official Tax Invoice & Receipt"} size="2xl">
        {detail && (
          <div className="space-y-6 text-xs text-gray-800 p-2">
            <div className="flex justify-between items-start border-b border-gray-200 pb-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">
                  {(detail as any).isWholesale || (detail as any).invoiceType === "wholesale"
                    ? "RESELLER WHOLESALE BALANCE DEBIT NOTE"
                    : "OFFICIAL CUSTOMER RETAIL INVOICE"}
                </h3>
                <p className="text-xs font-mono font-bold text-blue-600">#{getInvoiceNumber(detail)}</p>
                {((detail as any).paymentId || (detail as any).liquidTransactionId || (detail as any).liquidOrderId) && (
                  <p className="text-[10px] font-mono text-gray-500 mt-0.5">
                    Ref ID: {(detail as any).paymentId || (detail as any).liquidTransactionId || (detail as any).liquidOrderId}
                  </p>
                )}
              </div>
              <div className="text-right">
                {(() => {
                  const status = getEffectiveStatus(detail);
                  if (status === "pending_payment") {
                    return (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" /> MENUNGGU PEMBAYARAN
                      </span>
                    );
                  }
                  if (status === "completed") {
                    return (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> PAYMENT COMPLETED
                      </span>
                    );
                  }
                  if (status === "expired" || status === "cancelled" || status === "failed") {
                    return (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-200 uppercase tracking-wider">
                        <AlertCircle className="w-3.5 h-3.5 text-red-600" /> TRANSACTION {status.toUpperCase()}
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-gray-100 text-gray-700 border border-gray-200 uppercase tracking-wider">
                      {status.toUpperCase()}
                    </span>
                  );
                })()}
                <p className="text-[11px] text-gray-500 mt-1">Date: {fmtDateTime(detail.createdAt)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              {(detail as any).isWholesale || (detail as any).invoiceType === "wholesale" ? (
                /* --- WHOLESALE INVOICE (Reseller Deposit Debit Note) --- */
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Wholesale Registrar System</p>
                    <p className="font-bold text-gray-900 text-sm mt-0.5">Resellercamp Wholesale (Liquid API)</p>
                    <p className="text-gray-500 text-[11px] mt-0.5">Automated Wholesale Registrar Service</p>
                    <p className="text-gray-500 text-[11px] font-mono mt-0.5">support@resellercamp.com</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Billed To Reseller Account</p>
                    <p className="font-bold text-gray-900 text-sm mt-0.5">
                      {(detail as any).resellerInfo?.brandName || (detail as any).resellerInfo?.name || user?.name}
                    </p>
                    {(detail as any).resellerInfo?.address && (
                      <p className="text-gray-500 text-[11px] mt-0.5 leading-relaxed">
                        {(detail as any).resellerInfo.address}
                      </p>
                    )}
                    <p className="text-gray-500 text-[11px] font-mono mt-0.5">
                      {(detail as any).resellerInfo?.email || user?.email}
                    </p>
                  </div>
                </>
              ) : (
                /* --- RETAIL INVOICE (Customer Retail Tax Invoice) --- */
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Registrar Provider</p>
                    <p className="font-bold text-gray-900 text-sm mt-0.5">
                      {(detail as any).resellerInfo?.brandName || (detail as any).resellerInfo?.name || "Ekstensi ID"}
                    </p>
                    {(detail as any).resellerInfo?.company && (detail as any).resellerInfo?.company !== ((detail as any).resellerInfo?.brandName || (detail as any).resellerInfo?.name) && (
                      <p className="text-gray-600 text-xs font-semibold">
                        {(detail as any).resellerInfo.company}
                      </p>
                    )}
                    {(detail as any).resellerInfo?.address && (
                      <p className="text-gray-500 text-[11px] mt-0.5 leading-relaxed">
                        {(detail as any).resellerInfo.address}
                      </p>
                    )}
                    {(detail as any).resellerInfo?.email && (
                      <p className="text-gray-500 text-[11px] font-mono mt-0.5">
                        {(detail as any).resellerInfo.email}
                      </p>
                    )}
                    {(detail as any).resellerInfo?.phone && (
                      <p className="text-gray-400 text-[10px] font-mono mt-0.5">
                        Telp: {(detail as any).resellerInfo.phone}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Billed To Customer</p>
                    <p className="font-bold text-gray-900 text-sm mt-0.5">
                      {(detail as any).customer?.name || (isCustomer ? user?.name : "-")}
                    </p>
                    {(detail as any).customer?.company && (
                      <p className="text-gray-600 text-xs font-semibold mt-0.5">
                        {(detail as any).customer.company}
                      </p>
                    )}
                    {((detail as any).customer?.formattedAddress || (detail as any).customer?.address) && (
                      <p className="text-gray-500 text-[11px] mt-0.5 leading-relaxed">
                        {(detail as any).customer.formattedAddress || (detail as any).customer.address}
                      </p>
                    )}
                    {((detail as any).customer?.email || (isCustomer ? user?.email : null)) && (
                      <p className="text-gray-500 text-[11px] font-mono mt-0.5">
                        {(detail as any).customer?.email || (isCustomer ? user?.email : "")}
                      </p>
                    )}
                    {(detail as any).customer?.phone && (
                      <p className="text-gray-400 text-[10px] font-mono mt-0.5">
                        Telp: {(detail as any).customer.phone}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="text-left p-3">Item Description</th>
                    <th className="text-center p-3 w-16">Qty</th>
                    <th className="text-right p-3 w-40 whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="p-3">
                      <p className="font-bold text-gray-900">
                        {(() => {
                          const fallback = detail.description || "Domain Registration Order";
                          if ((detail as any).isWholesale || (detail as any).invoiceType === "wholesale") return fallback;
                          if (detail.type !== "register" && detail.type !== "transfer" && detail.type !== "renew" && detail.type !== "privacy") return fallback;
                          const info = getTxnInfo(detail);
                          if (!info.registerDate || !info.expiryDate) return fallback;
                          const typeLabel = detail.type === "register" ? "Domain register" : detail.type === "transfer" ? "Domain transfer" : detail.type === "renew" ? "Domain renewal" : "WHOIS Privacy";
                          return `${typeLabel} - ${info.domainName} (${info.years} yr) - ${info.registerDate} → ${info.expiryDate}`;
                        })()}
                      </p>
                    </td>
                    <td className="p-3 text-center font-mono">1</td>
                    <td className="p-3 text-right font-mono font-bold whitespace-nowrap">{fmtPrice(detail.amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <div className="w-64 space-y-2 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-semibold">{fmtPrice(detail.amount)}</span>
                </div>
                {taxEnabled && taxRate > 0 && (() => {
                  const baseAmt = Number(detail.amount || 0);
                  const actualAmt = baseAmt < 1000 ? baseAmt * 1000 : baseAmt;
                  const taxAmt = Math.round(actualAmt * taxRate / 100);
                  const totalAmt = actualAmt + taxAmt;
                  return (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span>{taxLabel} ({taxRate}%)</span>
                        <span className="font-mono font-semibold">IDR {taxAmt.toLocaleString("id-ID")}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-sm text-gray-900">
                        <span>Total Amount</span>
                        <span className={`font-mono ${isPending(detail) ? "text-amber-600" : "text-emerald-600"}`}>IDR {totalAmt.toLocaleString("id-ID")}</span>
                      </div>
                    </>
                  );
                })()}
                {(!taxEnabled || taxRate === 0) && (
                  <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-sm text-gray-900">
                    <span>Total Amount</span>
                    <span className={`font-mono ${isPending(detail) ? "text-amber-600" : "text-emerald-600"}`}>{fmtPrice(detail.amount)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
              {isPending(detail) ? (
                <button
                  onClick={() => {
                    setDetailOpen(false);
                    handleInvoiceClick(detail);
                  }}
                  className="px-4 py-2 bg-black hover:bg-gray-800 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-md"
                >
                  <span>🔐</span> Bayar Tagihan Ini Sekarang ➔
                </button>
              ) : <div />}
              <Button
                variant="secondary"
                onClick={() => window.print()}
                className="text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Invoice
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
