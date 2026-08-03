import { useState, useEffect, type ReactNode } from "react";
import { Search, X, ChevronLeft, ChevronRight, Eye, EyeOff, CheckCircle2, Loader2, Clock, AlertCircle, Copy, Lock, ArrowRight, ShieldCheck, Ban } from "lucide-react";
import { api } from "../../lib/api";

export function SecretInput({
  value,
  onChange,
  placeholder,
  className = "",
  disabled = false,
}: {
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative flex items-center w-full">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full pl-3 pr-10 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-black text-gray-800 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export function PasswordInput({
  value,
  onChange,
  placeholder,
  className = "",
  disabled = false,
  required = false,
  minLength,
  autoComplete,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative flex items-center w-full">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className={`w-full pl-3.5 pr-10 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        tabIndex={-1}
        className="absolute right-3 p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 md:p-6 ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center shrink-0">
        <Icon className="w-5.5 h-5.5 text-white" />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{label}</p>
        <p className="text-2xl font-black text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export function Button({
  children, variant = "primary", onClick, disabled, className = "", type = "button",
}: { children: ReactNode; variant?: "primary" | "secondary" | "danger" | "icon" | "outline"; onClick?: () => void; disabled?: boolean; className?: string; type?: "button" | "submit" }) {
  const base = {
    primary: "px-4 py-2 bg-black text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50",
    secondary: "px-4 py-2 border border-gray-200 hover:bg-gray-50 text-xs sm:text-sm font-semibold rounded-lg text-gray-700 transition-colors",
    outline: "px-4 py-2 border border-gray-200 hover:bg-gray-50 text-xs sm:text-sm font-semibold rounded-lg text-gray-700 transition-colors",
    danger: "px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs sm:text-sm font-semibold rounded-lg transition-colors",
    icon: "p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors",
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base[variant]} ${className}`}>{children}</button>;
}

export function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-150",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    expired: "bg-red-50 text-red-700 border-red-100",
    suspended: "bg-gray-100 text-gray-600 border-gray-200",
    transferred: "bg-blue-50 text-blue-700 border-blue-100",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-150",
    failed: "bg-red-50 text-red-700 border-red-100",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${colors[status] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {status}
    </span>
  );
}

export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" };
  return (
    <div className="flex items-center justify-center py-16">
      <div className={`${sizes[size]} animate-spin border-2 border-gray-300 border-t-black rounded-full`} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: any; title: string; description: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <Icon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
      {action && (
        <button onClick={action.onClick} className="mt-4 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
          {action.label}
        </button>
      )}
    </div>
  );
}

export function InfoBanner({ type, message }: { type: "error" | "success" | "warning"; message: string }) {
  const colors = {
    error: "bg-red-50 border-red-100 text-red-800",
    success: "bg-emerald-50 border-emerald-100 text-emerald-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
  };
  return (
    <div className={`p-4 border rounded-xl flex items-center gap-3 text-sm ${colors[type]}`}>
      <span>{message}</span>
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-64 shrink-0">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-black text-gray-800"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
}) {
  if (!open) return null;
  const sizeMap: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
  };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className={`bg-white rounded-2xl border border-gray-200 shadow-xl w-full overflow-hidden ${sizeMap[size] || "max-w-md"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function PaymentModal({
  open,
  onClose,
  orderId,
  paymentLinkUrl,
  amount,
  fee = 0,
  currency = "IDR",
  domainName,
  expiresAt,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  paymentLinkUrl: string;
  amount: number;
  fee?: number;
  currency?: string;
  domainName: string;
  expiresAt?: string | Date | number;
  onSuccess?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [timeLeft, setTimeLeft] = useState(3600); // remaining seconds
  const [isExpired, setIsExpired] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resultStatus, setResultStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setActiveStep(1);

    // Calculate target timestamp (default 1 hour if not specified)
    let targetTime = Date.now() + 60 * 60 * 1000;
    if (expiresAt) {
      if (typeof expiresAt === "number") {
        targetTime = expiresAt;
      } else if (expiresAt instanceof Date) {
        targetTime = expiresAt.getTime();
      } else {
        let str = String(expiresAt).trim().replace(" ", "T");
        if (!str.includes("Z") && !/[+-]\d{2}:\d{2}$/.test(str)) {
          str += "Z";
        }
        const parsed = new Date(str).getTime();
        if (!isNaN(parsed)) targetTime = parsed;
      }
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setIsExpired(true);
      } else {
        setIsExpired(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [open, expiresAt, orderId]);

  if (!open) return null;

  const fmt = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: currency === "USD" ? "USD" : "IDR", maximumFractionDigits: 0 }).format(val);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  function copyInvoice() {
    navigator.clipboard.writeText(orderId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const steps = [
    { num: 1, label: "Ringkasan" },
    { num: 2, label: "Pembayaran" },
    { num: 3, label: "Selesai" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{ animation: "fadeIn 0.2s ease-out" }} onClick={onClose}>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-lg w-full overflow-hidden text-left" style={{ animation: "slideUp 0.3s ease-out" }} onClick={(e) => e.stopPropagation()}>

        {/* Header with gradient */}
        <div className="relative px-6 py-5 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-blue-400/10 rounded-full translate-y-6 -translate-x-6" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${isExpired ? "bg-red-500" : "bg-emerald-400 animate-pulse"}`} />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isExpired ? "text-red-300" : "text-emerald-300"}`}>
                  {isExpired ? "Payment Expired" : "Secure Payment"}
                </span>
              </div>
              <h2 className="text-lg font-bold tracking-tight">Tagihan Pembayaran</h2>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            {steps.map((step, i) => (
              <div key={step.num} className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                  activeStep >= step.num
                    ? "bg-black text-white shadow-sm"
                    : "bg-gray-200 text-gray-400"
                }`}>
                  {activeStep > step.num ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    step.num
                  )}
                </div>
                <span className={`text-[10px] font-semibold ${activeStep >= step.num ? "text-gray-900" : "text-gray-400"}`}>
                  {step.label}
                </span>
                {i < steps.length - 1 && (
                  <div className={`w-8 sm:w-12 h-px mx-1 transition-colors ${activeStep > step.num ? "bg-black" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Countdown Timer Banner */}
          {isExpired ? (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-red-900 uppercase tracking-wider">Batas Waktu Pembayaran Habis (1 Jam)</p>
                  <p className="text-[10px] text-red-700">Transaksi ini telah dibatalkan secara otomatis karena melewati batas waktu.</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold bg-red-200 text-red-900 px-2 py-1 rounded">EXPIRED</span>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Batas Waktu Pembayaran ({hours > 1 ? `${hours} Jam` : "1 Jam"})</p>
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

          {/* Invoice detail card */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">No. Invoice</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-gray-900">{orderId}</span>
                  <button
                    onClick={copyInvoice}
                    className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-700"
                    title="Salin nomor invoice"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Domain</span>
                <span className="font-bold text-gray-900">{domainName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Status</span>
                {isExpired ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                    <AlertCircle className="w-3 h-3 text-red-600" /> Transaksi Dibatalkan
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    Menunggu Pembayaran
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Subtotal Domain</span>
                <span className="font-mono font-semibold text-gray-700">{fmt(amount)}</span>
              </div>
              {fee > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Fee Payment</span>
                  <span className="font-mono font-semibold text-gray-700">{fmt(fee)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-900">Total Pembayaran</span>
                <span className="text-2xl font-black text-gray-900 font-mono tracking-tight">{fmt(amount + fee)}</span>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-2.5 pt-1">
            {isExpired ? (
              <button
                disabled
                className="w-full py-3.5 bg-gray-200 text-gray-500 font-bold text-sm rounded-xl cursor-not-allowed flex items-center justify-center gap-2 shadow-inner"
              >
                <AlertCircle className="w-4 h-4" /> Tagihan Dibatalkan (Expired)
              </button>
            ) : (
              <a
                href={paymentLinkUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => setActiveStep(2)}
                className="w-full py-3.5 bg-gradient-to-r from-gray-900 to-black hover:from-gray-800 hover:to-gray-900 text-white font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2.5 cursor-pointer text-center block active:scale-[0.98]"
              >
                <Lock className="w-4 h-4" />
                Bayar Sekarang
                <ArrowRight className="w-4 h-4" />
              </a>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isExpired}
                onClick={() => {
                  navigator.clipboard.writeText(paymentLinkUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5" />
                Salin Link
              </button>
              <button
                type="button"
                disabled={checking}
                onClick={async () => {
                  setChecking(true);
                  try {
                    const res: any = await api.get(`/payments/status/${orderId}`);
                    const status = res?.data?.status || res?.status || "";
                    setResultStatus(status);
                    if (status === "completed" || status === "processing_domain") {
                      setActiveStep(3);
                      if (onSuccess) onSuccess();
                      setTimeout(onClose, 1000);
                    } else {
                      setActiveStep(2);
                    }
                  } catch {
                    setResultStatus("error");
                  }
                  setChecking(false);
                }}
                className="py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {checking ? "Memeriksa..." : "Cek Status"}
              </button>
            </div>

            {/* Payment Status Result */}
            {resultStatus && (
              <div className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                resultStatus === "completed" || resultStatus === "processing_domain"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : resultStatus === "failed" || resultStatus === "expired" || resultStatus === "error"
                  ? "bg-red-50 text-red-700 border border-red-100"
                  : "bg-amber-50 text-amber-700 border border-amber-100"
              }`}>
                {resultStatus === "completed" || resultStatus === "processing_domain"
                  ? <ShieldCheck className="w-4 h-4 shrink-0" />
                  : resultStatus === "failed" || resultStatus === "expired" || resultStatus === "error"
                  ? <Ban className="w-4 h-4 shrink-0" />
                  : <Clock className="w-4 h-4 shrink-0" />}
                <span>
                  {resultStatus === "completed" || resultStatus === "processing_domain"
                    ? "Pembayaran berhasil dikonfirmasi!"
                    : resultStatus === "failed"
                    ? "Pembayaran gagal — silakan coba lagi"
                    : resultStatus === "expired"
                    ? "Batas waktu pembayaran habis"
                    : resultStatus === "error"
                    ? "Gagal memeriksa status. Coba lagi."
                    : "Pembayaran masih dalam proses. Silakan cek kembali."}
                </span>
              </div>
            )}
          </div>

          {/* Security footer */}
          <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
            <span>Transaksi aman &amp; terenkripsi &middot; SSL 256-bit</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-1.5">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}
        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-colors disabled:opacity-40">
        <ChevronLeft className="w-4 h-4" />
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button key={p} onClick={() => onPage(p)}
          className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${p === page ? "bg-black text-white" : "border border-gray-200 text-gray-600 hover:bg-white"}`}>
          {p}
        </button>
      ))}
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}
        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-colors disabled:opacity-40">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onConfirm, onClose, loading }: { open: boolean; title: string; message: string; onConfirm: () => void; onClose: () => void; loading?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-sm w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 text-center">
          <h3 className="text-sm font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-xs text-gray-500">{message}</p>
          <div className="flex justify-center gap-2 mt-4">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="danger" onClick={onConfirm} disabled={loading}>{loading ? "..." : "Confirm"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Toast notification (auto-dismiss)
let toastId = 0;
export function toast(message: string, type: "success" | "error" = "success") {
  const id = ++toastId;
  const container = document.getElementById("toast-container") || (() => { const el = document.createElement("div"); el.id = "toast-container"; el.className = "fixed bottom-5 right-5 z-50 space-y-2"; document.body.appendChild(el); return el; })();
  const el = document.createElement("div");
  const colors = type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800";
  el.className = `px-4 py-3 border rounded-xl text-xs font-semibold shadow-lg transition-all animate-fade-in ${colors}`;
  el.textContent = message;
  el.id = `toast-${id}`;
  container.appendChild(el);
  setTimeout(() => { el.remove(); }, 4000);
}

export function WaBadge({ phone }: { phone: string }) {
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!phone || phone.length < 8) { setVerified(null); return; }
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await fetch("/api/auth/check-whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        const data = await res.json();
        setVerified(data.data?.registered === true);
      } catch { setVerified(null); }
      setChecking(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [phone]);

  if (!phone || phone.length < 8) return null;
  if (checking) return <span className="inline-flex items-center gap-1 text-[10px] text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Checking...</span>;
  if (verified === true) return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> WA Verified</span>;
  if (verified === false) return <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">Not on WhatsApp</span>;
  return null;
}

export * from "./TurnstileWidget";

