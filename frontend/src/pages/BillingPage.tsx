import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, LoadingSpinner, EmptyState, Modal, Pagination, Button } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { FileText, Printer, CheckCircle2, Receipt, AlertTriangle, X } from "lucide-react";
import type { Transaction, PaginatedResponse } from "../lib/types";

function fmtPrice(amount: any, currency: string = "IDR"): string {
  const num = Number(amount || 0);
  if (isNaN(num)) return `${currency} 0`;
  const actual = num < 10000 && currency === "IDR" ? num * 1000 : num;
  return `${currency} ${Math.round(actual).toLocaleString("id-ID")}`;
}

export default function BillingPage() {
  const { user } = useAuth();
  const isCustomer = user?.role === "customer";
  const [searchParams, setSearchParams] = useSearchParams();

  const returnStatus = searchParams.get("status");
  const returnOrderId = searchParams.get("order_id");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState({ balance: "0.00", currency: "IDR" });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Transaction | null>(null);

  useEffect(() => {
    setLoading(true);
    const promises: Promise<any>[] = [
      api.get<PaginatedResponse<Transaction>>(`/billing/transactions?page=${page}&per_page=${perPage}`),
    ];

    if (!isCustomer) {
      promises.push(api.get<any>("/billing/balance"));
    }

    Promise.all(promises).then(([txns, bal]) => {
      setTransactions(txns.data || []);
      setTotal(txns.meta?.total || 0);
      if (bal) {
        const b = typeof bal === "object" ? bal : { balance: String(bal), currency: "IDR" };
        setBalance(b);
      }
    }).finally(() => setLoading(false));
  }, [page, isCustomer, returnStatus]);

  function clearReturnStatus() {
    searchParams.delete("status");
    searchParams.delete("order_id");
    setSearchParams(searchParams);
  }

  async function openInvoice(txn: Transaction) {
    try {
      const d = await api.get<Transaction>(`/billing/transactions/${txn.id}`);
      setDetail(d);
      setDetailOpen(true);
    } catch {
      setDetail(txn);
      setDetailOpen(true);
    }
  }

  const totalSpent = transactions.reduce((acc, t) => {
    const amt = Number(t.amount || 0);
    const actual = amt < 10000 ? amt * 1000 : amt;
    return acc + actual;
  }, 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Return URL Banners */}
      {returnStatus === "success" && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm space-y-3 animate-fade-in text-emerald-950">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700 shrink-0 mt-0.5">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-900">Pembayaran Berhasil Dikonfirmasi! 🎉</h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Tagihan <strong className="font-mono">{returnOrderId || "Sumopod"}</strong> telah berhasil dibayar. Domain Anda sedang diproses dan diaktifkan secara otomatis.
                </p>
              </div>
            </div>
            <button onClick={clearReturnStatus} className="text-emerald-700 hover:text-emerald-950 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Link to="/domains" className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-bold text-xs rounded-lg transition-colors">
              Lihat Daftar Domain Saya →
            </Link>
            <button onClick={clearReturnStatus} className="px-4 py-2 border border-emerald-300 hover:bg-emerald-100 text-emerald-900 font-semibold text-xs rounded-lg transition-colors">
              Tutup Notifikasi
            </button>
          </div>
        </div>
      )}

      {returnStatus === "cancel" && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm space-y-3 animate-fade-in text-amber-950">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-900">Pembayaran Dibatalkan</h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Tagihan <strong className="font-mono">{returnOrderId || "Sumopod"}</strong> belum diselesaikan atau dibatalkan saat di halaman Sumopod. Anda dapat melakukan pembayaran ulang kapan saja.
                </p>
              </div>
            </div>
            <button onClick={clearReturnStatus} className="text-amber-700 hover:text-amber-950 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Link to="/domains/register" className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-bold text-xs rounded-lg transition-colors">
              Kembali ke Pencarian Domain
            </Link>
            <button onClick={clearReturnStatus} className="px-4 py-2 border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold text-xs rounded-lg transition-colors">
              Tutup
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            {isCustomer ? <FileText className="w-5 h-5 text-gray-700" /> : <Receipt className="w-5 h-5 text-gray-700" />}
            {isCustomer ? "My Invoices" : "Billing & Balance"}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {isCustomer ? "View and download domain registration invoices and payment receipts." : "Manage reseller deposit balance and view system transaction history."}
          </p>
        </div>
      </div>

      {/* Customer Stat Cards vs Reseller Balance */}
      {isCustomer ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Invoices</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{total}</p>
          </Card>
          <Card className="p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Spent</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{fmtPrice(totalSpent)}</p>
          </Card>
        </div>
      ) : (
        <Card className="p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Reseller Deposit Balance</p>
          <p className="text-3xl font-black text-gray-900 mt-1">{fmtPrice(balance.balance, balance.currency)}</p>
        </Card>
      )}

      {/* Transactions / Invoice Table */}
      <Card className="p-0 border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="px-5 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            {isCustomer ? "Invoice History" : "System Transactions"}
          </h2>
          <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / perPage))} onPage={setPage} />
        </div>

        {transactions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={FileText}
              title={isCustomer ? "No invoices found" : "No transactions yet"}
              description={isCustomer ? "Your domain registration invoices will appear here once registered." : "System transactions will appear here."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 text-xs font-mono font-bold text-gray-900">
                      #INV-2026-{String(t.id).padStart(4, "0")}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-600">
                      {new Date(t.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-800 font-medium">
                      {t.description || `${t.type === "domain" ? "Domain Registration Order" : "Service Order"}`}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-900 font-bold text-right font-mono">
                      {fmtPrice(t.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> PAID
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => openInvoice(t)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-md transition-colors"
                      >
                        View Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Official Printable Invoice Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Official Tax Invoice & Receipt">
        {detail && (
          <div className="space-y-6 text-xs text-gray-800 p-2">
            {/* Invoice Header */}
            <div className="flex justify-between items-start border-b border-gray-200 pb-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">INVOICE & RECEIPT</h3>
                <p className="text-xs font-mono font-bold text-blue-600">#INV-2026-{String(detail.id).padStart(4, "0")}</p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> PAYMENT COMPLETED
                </span>
                <p className="text-[11px] text-gray-500 mt-1">Date: {new Date(detail.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
            </div>

            {/* Seller & Buyer Info */}
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Registrar Provider</p>
                <p className="font-bold text-gray-900 text-sm mt-0.5">Domain Services Portal</p>
                <p className="text-gray-500 text-[11px]">Authorized Domain Registrar Partner</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Billed To Customer</p>
                <p className="font-bold text-gray-900 text-sm mt-0.5">{user?.name || "Customer"}</p>
                <p className="text-gray-500 text-[11px] font-mono">{user?.email}</p>
              </div>
            </div>

            {/* Itemized Invoice Table */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                    <th className="text-left p-3">Item Description</th>
                    <th className="text-center p-3">Qty</th>
                    <th className="text-right p-3">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="p-3">
                      <p className="font-bold text-gray-900">{detail.description || "Domain Registration Order"}</p>
                      <p className="text-[10px] text-gray-500">WHOIS Privacy Guard Protection Included</p>
                    </td>
                    <td className="p-3 text-center font-mono">1</td>
                    <td className="p-3 text-right font-mono font-bold">{fmtPrice(detail.amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary Totals */}
            <div className="flex justify-end pt-2">
              <div className="w-64 space-y-2 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-semibold">{fmtPrice(detail.amount)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax (PPN 0%)</span>
                  <span className="font-mono font-semibold">IDR 0</span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-sm text-gray-900">
                  <span>Total Amount Paid</span>
                  <span className="font-mono text-emerald-600">{fmtPrice(detail.amount)}</span>
                </div>
              </div>
            </div>

            {/* Print Action Button */}
            <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
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
