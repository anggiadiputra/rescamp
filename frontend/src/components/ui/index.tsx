import { useState, type ReactNode } from "react";
import { Search, X, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";

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
        className={`w-full pr-10 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2 text-gray-400 hover:text-gray-700 p-1 rounded-md transition-colors"
        tabIndex={-1}
        title={show ? "Sembunyikan Kredensial" : "Tampilkan Kredensial"}
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
    primary: "px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50",
    secondary: "px-4 py-2 border border-gray-200 hover:bg-gray-50 text-sm font-semibold rounded-lg text-gray-700 transition-colors",
    outline: "px-4 py-2 border border-gray-200 hover:bg-gray-50 text-sm font-semibold rounded-lg text-gray-700 transition-colors",
    danger: "px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-lg transition-colors",
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

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
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
  currency = "IDR",
  domainName,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  paymentLinkUrl: string;
  amount: number;
  currency?: string;
  domainName: string;
  onSuccess?: () => void;
}) {
  if (!open) return null;

  const fmt = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: currency === "USD" ? "USD" : "IDR", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-md w-full overflow-hidden text-left" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 bg-black text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Sumopod Payment Gateway</span>
            <h2 className="text-base font-bold">Tagihan Pembayaran Domain</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>Nomor Tagihan (Invoice)</span>
              <span className="font-mono font-bold text-gray-900">{orderId}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>Domain</span>
              <span className="font-mono font-bold text-gray-900">{domainName}</span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-900">Total Pembayaran</span>
              <span className="text-lg font-black text-gray-900 font-mono">{fmt(amount)}</span>
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-emerald-900">
              <span>💳 Instan & Otomatis via Sumopod</span>
            </p>
            <p className="text-[11px] text-emerald-700">
              Mendukung QRIS, Bank Transfer, & E-Wallet. Domain akan diaktifkan secara otomatis begitu pembayaran selesai diselesaikan.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <a
              href={paymentLinkUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3.5 bg-black hover:bg-gray-800 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-center block"
            >
              Bayar Sekarang via Sumopod (QRIS) ➔
            </a>
            <button
              type="button"
              onClick={() => {
                if (onSuccess) onSuccess();
                onClose();
              }}
              className="w-full py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl transition-colors"
            >
              Saya Sudah Bayar / Cek Status Halaman Domain
            </button>
          </div>
        </div>
      </div>
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
