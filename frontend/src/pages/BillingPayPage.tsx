import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, Button, LoadingSpinner } from "../components/ui";
import { api } from "../lib/api";
import { Lock, ArrowRight, CheckCircle2, Clock, AlertCircle, Copy, ShieldCheck, Check } from "lucide-react";

export default function BillingPayPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    id: number;
    orderId: string;
    domainName: string;
    amount: number;
    fee: number;
    paymentLinkUrl: string;
    expiresAt: string;
    status: string;
    currency: string;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState(3600);
  const [isExpired, setIsExpired] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    api.get(`/payments/status/${orderId}`)
      .then((res: any) => {
        const d = res.data;
        setData({
          id: d.id,
          orderId: d.orderId || d.metadata?.orderId || orderId,
          domainName: d.metadata?.domainName || "Domain Order",
          amount: Number(d.amount || 0),
          fee: Number(d.metadata?.fee || 0),
          paymentLinkUrl: d.paymentLinkUrl || d.metadata?.paymentLinkUrl || "",
          expiresAt: d.expiresAt || d.metadata?.expiresAt || "",
          status: d.status,
          currency: d.currency || "IDR",
        });
        if (d.expiresAt || d.metadata?.expiresAt) {
          const exp = d.expiresAt || d.metadata.expiresAt;
          const targetTime = new Date(exp).getTime();
          const remaining = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
          setTimeLeft(remaining);
          setIsExpired(remaining <= 0);
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (isExpired) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isExpired]);

  if (loading) return <LoadingSpinner />;
  if (!data) {
    return (
      <div className="max-w-lg mx-auto mt-8 px-4">
        <Card>
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-300" />
            <h1 className="text-lg font-bold text-gray-900">Invoice Tidak Ditemukan</h1>
            <p className="text-sm text-gray-500 mt-1">Invoice dengan ID {orderId} tidak ditemukan.</p>
            <Button onClick={() => navigate("/billing")} className="mt-4">Kembali ke Billing</Button>
          </div>
        </Card>
      </div>
    );
  }

  const fmt = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: data.currency === "USD" ? "USD" : "IDR", maximumFractionDigits: 0 }).format(val);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  function copyLink() {
    if (!data?.paymentLinkUrl) return;
    navigator.clipboard.writeText(data.paymentLinkUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isPaid = data.status === "completed" || data.status === "processing_domain";

  return (
    <div className="max-w-2xl mx-auto mt-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Tagihan Pembayaran</h1>
        <Link to="/billing" className="text-xs font-semibold text-gray-500 hover:text-gray-900">← Kembali ke Billing</Link>
      </div>

      {isExpired ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-red-900 uppercase tracking-wider">Batas Waktu Pembayaran Habis</p>
              <p className="text-[10px] text-red-700">Transaksi ini telah dibatalkan karena melewati batas waktu.</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-red-200 text-red-900 px-2 py-1 rounded">EXPIRED</span>
        </div>
      ) : isPaid ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Pembayaran Berhasil</p>
            <p className="text-[10px] text-emerald-700">Domain Anda sedang diproses.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Batas Waktu Pembayaran</p>
              <p className="text-[10px] text-amber-600">Tagihan akan otomatis dibatalkan jika melewati batas waktu</p>
            </div>
          </div>
          <div className="flex items-center gap-1 font-mono">
            <span className="bg-amber-900 text-white text-sm font-bold px-1.5 py-0.5 rounded">{pad(hours)}</span>
            <span className="text-amber-800 font-bold">:</span>
            <span className="bg-amber-900 text-white text-sm font-bold px-1.5 py-0.5 rounded">{pad(minutes)}</span>
            <span className="text-amber-800 font-bold">:</span>
            <span className="bg-amber-900 text-white text-sm font-bold px-1.5 py-0.5 rounded">{pad(seconds)}</span>
          </div>
        </div>
      )}

      <Card>
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">No. Invoice</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-gray-900">{data.orderId}</span>
                  <button onClick={() => { navigator.clipboard.writeText(data.orderId); }} className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-700" title="Salin nomor invoice">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Domain</span>
                <span className="font-bold text-gray-900">{data.domainName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Status</span>
                {isExpired ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                    <AlertCircle className="w-3 h-3 text-red-600" /> Transaksi Dibatalkan
                  </span>
                ) : isPaid ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> PAID
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" /> Menunggu Pembayaran
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Subtotal Domain</span>
                <span className="font-mono font-semibold text-gray-700">{fmt(data.amount)}</span>
              </div>
              {data.fee > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Fee Payment</span>
                  <span className="font-mono font-semibold text-gray-700">{fmt(data.fee)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-900">Total Pembayaran</span>
                <span className="text-2xl font-black text-gray-900 font-mono tracking-tight">{fmt(data.amount + data.fee)}</span>
              </div>
            </div>
          </div>

          {!isExpired && !isPaid && data.paymentLinkUrl && (
            <div className="space-y-2">
              <a
                href={data.paymentLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 bg-gradient-to-r from-gray-900 to-black hover:from-gray-800 hover:to-gray-900 text-white font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2.5 cursor-pointer text-center block active:scale-[0.98]"
              >
                <Lock className="w-4 h-4" />
                Bayar Sekarang
                <ArrowRight className="w-4 h-4" />
              </a>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Tersalin!" : "Salin Link"}
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Cek Status
                </button>
              </div>
            </div>
          )}

          {isPaid && (
            <div className="text-center">
              <Link to="/domains" className="inline-flex items-center gap-2 px-6 py-3 bg-black hover:bg-gray-800 text-white font-bold text-sm rounded-xl transition-colors">
                <CheckCircle2 className="w-4 h-4" />
                Lihat Domain Saya
              </Link>
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 pt-2 text-[10px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
            <span>Transaksi aman &amp; terenkripsi · SSL 256-bit</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
{
  isPaid && (
    <div className="text-center">
      <Link to="/domains" className="inline-flex items-center gap-2 px-6 py-3 bg-black hover:bg-gray-800 text-white font-bold text-sm rounded-xl transition-colors">
        <CheckCircle2 className="w-4 h-4" />
        Lihat Domain Saya
      </Link>
    </div>
  )
}

<div className="flex items-center justify-center gap-1.5 pt-2 text-[10px] text-gray-400">
  <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
  <span>Transaksi aman &amp; terenkripsi · SSL 256-bit</span>
</div>
        </div >
      </Card >
    </div >
  );
}
