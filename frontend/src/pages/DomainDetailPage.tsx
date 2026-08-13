import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  Globe, ShieldCheck, Lock, Unlock, Key, RefreshCw, Server, Mail,
  AlertTriangle, Trash2, Copy, Check, ExternalLink, Calendar, User, ArrowLeft
} from "lucide-react";
import { Button, CardSkeleton, Modal, InfoBanner, ConfirmDialog, toast, PaymentModal } from "../components/ui";
import { api } from "../lib/api";
import type { Domain } from "../lib/types";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";

function fmtPrice(amount: any): string {
  if (!amount) return "";
  const num = Number(amount);
  if (isNaN(num)) return "";
  const actual = num < 1000 ? num * 1000 : num;
  return `Rp ${Math.round(actual).toLocaleString("id-ID")}`;
}

export default function DomainDetailPage() {
  const nav = useNavigate();
  const { settings } = useSettings();
  const { id } = useParams();
  const { user } = useAuth();
  const isReseller = user?.role === "reseller";
  const [domain, setDomain] = useState<Domain | null>(null);
  const isIdDomain = (domain?.tld || "").toLowerCase().endsWith("id");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [copiedNs, setCopiedNs] = useState(false);

  // Modal states
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewYears, setRenewYears] = useState(1);
  const [renewWithPrivacy, setRenewWithPrivacy] = useState(false);
  const [renewLoading, setRenewLoading] = useState(false);
  const [buyPrivacyOpen, setBuyPrivacyOpen] = useState(false);
  const [priceList, setPriceList] = useState<Record<string, any>>({});

  useEffect(() => {
    api.get<any>("/billing/prices").then((data) => setPriceList(data || {})).catch(() => {});
  }, []);

  // Payment modal state
  const [paymentData, setPaymentData] = useState<{
    open: boolean;
    orderId: string;
    paymentLinkUrl: string;
    amount: number;
    fee: number;
    expiresAt?: string;
    domainName: string;
  }>({ open: false, orderId: "", paymentLinkUrl: "", amount: 0, fee: 0, expiresAt: "", domainName: "" });

  const [nsOpen, setNsOpen] = useState(false);
  const [nsForm, setNsForm] = useState(["", ""]);
  const [nsLoading, setNsLoading] = useState(false);

  const [authCodeOpen, setAuthCodeOpen] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [copiedAuth, setCopiedAuth] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendError, setSuspendError] = useState("");
  const [unsuspendOpen, setUnsuspendOpen] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [theftLoading, setTheftLoading] = useState(false);
  const [privacyBuying, setPrivacyBuying] = useState(false);
  const [privacyToggling, setPrivacyToggling] = useState(false);
  const [raaSending, setRaaSending] = useState(false);
  const [activeContactTab, setActiveContactTab] = useState<"registrant" | "admin" | "tech" | "billing">("registrant");

  async function doResendRaa() {
    setRaaSending(true);
    try {
      await api.post(`/domains/${id}/raa-verification/resend`);
      toast("Email verifikasi ICANN RAA berhasil dikirim ulang!");
    } catch (e: any) {
      toast(e.message || "Gagal mengirim ulang email verifikasi RAA", "error");
    }
    setRaaSending(false);
  }

  const fetchDomain = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<Domain>(`/domains/${id}`);
      setDomain(d);
    } catch {
      toast("Domain tidak ditemukan", "error");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchDomain();
  }, [fetchDomain]);

  async function toggleLock() {
    if (!domain) return;
    const currentLock = Boolean(domain.locked);
    const targetLockState = currentLock ? 0 : 1;
    setLockLoading(true);
    setMsg("");

    // Optimistic UI state update (Instant UI reaction)
    setDomain((prev) => (prev ? { ...prev, locked: targetLockState } : prev));

    try {
      if (currentLock) {
        await api.delete(`/domains/${id}/locked`);
        toast("Penguncian domain (Transfer Lock) berhasil dibuka");
      } else {
        await api.put(`/domains/${id}/locked`);
        toast("Domain berhasil dikunci (Transfer Lock Aktif)");
      }
    } catch (e: any) {
      const errorMsg = String(e?.message || "");
      if (errorMsg.includes("already Locked") || errorMsg.includes("already locked")) {
        setDomain((prev) => (prev ? { ...prev, locked: 1 } : prev));
        toast("Status diperbarui: Domain sudah dalam keadaan dikunci (Locked)");
      } else if (errorMsg.includes("already Unlocked") || errorMsg.includes("already unlocked")) {
        setDomain((prev) => (prev ? { ...prev, locked: 0 } : prev));
        toast("Status diperbarui: Domain sudah dalam keadaan terbuka (Unlocked)");
      } else {
        // Rollback state on error
        setDomain((prev) => (prev ? { ...prev, locked: currentLock ? 1 : 0 } : prev));
        toast(errorMsg || "Gagal mengubah status transfer lock", "error");
      }
    }
    setLockLoading(false);
  }

  async function doRenew() {
    setRenewLoading(true);
    setMsg("");
    try {
      const res: any = await api.post(`/domains/${id}/renew`, {
        years: renewYears,
        purchase_privacy_protection: isIdDomain ? false : renewWithPrivacy,
      });
      setRenewOpen(false);
      const paymentInfo = res?.data || res;
      const paymentLinkUrl = paymentInfo?.paymentLinkUrl || paymentInfo?.payment_link_url;
      const orderId = paymentInfo?.orderId || paymentInfo?.order_id;

      if (orderId) {
        nav(`/billing/pay/${orderId}`);
      } else if (paymentLinkUrl) {
        window.location.href = paymentLinkUrl;
      } else {
        toast("Perpanjangan domain berhasil diproses!");
        await fetchDomain();
      }
    } catch (e: any) {
      toast(e.message || "Gagal memproses perpanjangan domain", "error");
    }
    setRenewLoading(false);
  }

  async function doUpdateNs() {
    const validNs = nsForm.map(s => s.trim()).filter(Boolean);
    if (validNs.length < 2) {
      toast("Minimal 2 Nameserver wajib diisi", "error");
      return;
    }
    setNsLoading(true);
    setMsg("");
    try {
      const res: any = await api.put(`/domains/${id}/ns`, { nameservers: validNs });
      const updatedNs = res?.nameservers || validNs;
      setDomain(prev => prev ? { ...prev, nameservers: updatedNs } : prev);
      toast("Nameservers berhasil diperbarui!");
      setNsOpen(false);
      await fetchDomain();
    } catch (e: any) {
      toast(e.message || "Gagal memperbarui nameservers", "error");
    }
    setNsLoading(false);
  }

  async function getAuthCode() {
    setAuthLoading(true);
    try {
      const res: any = await api.get(`/domains/${id}/auth-code`);
      let code = "-";
      if (typeof res === "string" && res.trim()) {
        code = res.trim();
      } else if (res && typeof res === "object") {
        const payload = res.data ?? res;
        if (typeof payload === "string" && payload.trim()) {
          code = payload.trim();
        } else if (payload && typeof payload === "object") {
          code =
            payload.auth_code ||
            payload.authcode ||
            payload.auth_code_secret ||
            payload.epp_code ||
            payload.eppCode ||
            payload.code ||
            payload.secret ||
            payload.authCode ||
            payload.domain_secret ||
            "-";
        }
      }
      setAuthCode(typeof code === "string" ? code : String(code));
      setAuthCodeOpen(true);
    } catch (e: any) {
      toast(e.message || "Gagal mengambil EPP Auth Code dari Resellercamp", "error");
    }
    setAuthLoading(false);
  }

  async function togglePrivacy() {
    if (!domain) return;
    const currentPrivacy = Boolean(domain.privacyProtection);
    const targetState = currentPrivacy ? 0 : 1;
    setPrivacyToggling(true);

    setDomain(prev => prev ? { ...prev, privacyProtection: targetState } : prev);

    try {
      if (currentPrivacy) {
        await api.delete(`/domains/${id}/privacy`);
        toast("WHOIS Privacy protection berhasil dinonaktifkan");
      } else {
        await api.put(`/domains/${id}/privacy`);
        toast("WHOIS Privacy protection berhasil diaktifkan");
      }
      await fetchDomain();
    } catch (e: any) {
      setDomain(prev => prev ? { ...prev, privacyProtection: currentPrivacy ? 1 : 0 } : prev);
      toast(e.message || "Gagal mengubah status WHOIS Privacy", "error");
    }
    setPrivacyToggling(false);
  }


  function toggleSuspend() {
    if (!domain) return;
    if (domain.status === "suspended") {
      setUnsuspendOpen(true);
    } else {
      setSuspendReason("");
      setSuspendError("");
      setSuspendOpen(true);
    }
  }

  async function submitSuspend() {
    const reason = suspendReason.trim();
    if (reason.length < 5) {
      setSuspendError("Alasan minimal 5 karakter");
      return;
    }
    setSuspendLoading(true);
    setSuspendError("");
    try {
      await api.put(`/domains/${id}/suspended`, { reason });
      toast("Domain berhasil di-suspend");
      setSuspendOpen(false);
      setSuspendReason("");
      await fetchDomain();
    } catch (e: any) {
      setSuspendError(e.message || "Gagal mengubah status suspend domain");
    }
    setSuspendLoading(false);
  }

  async function confirmUnsuspend() {
    setSuspendLoading(true);
    try {
      await api.delete(`/domains/${id}/suspended`);
      toast("Domain berhasil di-unsuspend (Aktif kembali)");
      setUnsuspendOpen(false);
      await fetchDomain();
    } catch (e: any) {
      toast(e.message || "Gagal mengubah status suspend domain", "error");
    }
    setSuspendLoading(false);
  }

  async function toggleTheft() {
    if (!domain) return;
    const currentTheft = Boolean(domain.theftProtection);
    const targetState = currentTheft ? 0 : 1;
    setTheftLoading(true);

    // Optimistic UI state update (Instant UI reaction)
    setDomain((prev) => (prev ? { ...prev, theftProtection: targetState } : prev));

    try {
      if (currentTheft) {
        await api.delete(`/domains/${id}/theft-protection`);
        toast("Proteksi pencurian domain (Theft Protection) dinonaktifkan");
      } else {
        await api.put(`/domains/${id}/theft-protection`);
        toast("Proteksi pencurian domain (Theft Protection) diaktifkan");
      }
    } catch (e: any) {
      const errorMsg = String(e?.message || "");
      if (errorMsg.includes("already enabled") || errorMsg.includes("already active")) {
        setDomain((prev) => (prev ? { ...prev, theftProtection: 1 } : prev));
        toast("Status diperbarui: Theft Protection sudah dalam keadaan aktif");
      } else if (errorMsg.includes("already disabled") || errorMsg.includes("not enabled")) {
        setDomain((prev) => (prev ? { ...prev, theftProtection: 0 } : prev));
        toast("Status diperbarui: Theft Protection sudah dalam keadaan non-aktif");
      } else {
        // Rollback state on error
        setDomain((prev) => (prev ? { ...prev, theftProtection: currentTheft ? 1 : 0 } : prev));
        toast(errorMsg || "Gagal mengubah status theft protection", "error");
      }
    }
    setTheftLoading(false);
  }

  async function doDelete() {
    setDeleteLoading(true);
    try {
      await api.delete(`/domains/${id}`);
      toast("Catatan domain berhasil dihapus");
      nav("/domains");
    } catch (e: any) {
      toast(e.message || "Gagal menghapus domain", "error");
      setDeleteOpen(false);
    }
    setDeleteLoading(false);
  }

  async function doBuyPrivacy() {
    setPrivacyBuying(true);
    try {
      const res: any = await api.post(`/domains/${id}/privacy/buy`, {});
      setBuyPrivacyOpen(false);
      const paymentInfo = res?.data || res;
      const orderId = paymentInfo?.orderId || paymentInfo?.order_id;
      const paymentLinkUrl = paymentInfo?.paymentLinkUrl || paymentInfo?.payment_link_url;

      if (orderId) {
        nav(`/billing/pay/${orderId}`);
      } else if (paymentLinkUrl) {
        window.location.href = paymentLinkUrl;
      } else {
        toast("Order WHOIS Privacy berhasil dibuat");
        await fetchDomain();
      }
    } catch (e: any) {
      toast(e.message || "Gagal membuat order WHOIS Privacy", "error");
    }
    setPrivacyBuying(false);
  }

  function handleCopyNs() {
    const list = domain?.nameservers?.length ? domain.nameservers.join("\n") : "ns1.liquid.net\nns2.liquid.net";
    navigator.clipboard.writeText(list);
    setCopiedNs(true);
    toast("Nameservers berhasil disalin!");
    setTimeout(() => setCopiedNs(false), 2000);
  }

  if (loading && !domain) {
    return (
      <div className="space-y-6">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={6} />
      </div>
    );
  }
  if (!domain) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-gray-500 font-medium">Domain tidak ditemukan atau Anda tidak memiliki hak akses.</p>
        <Link to="/domains">
          <Button variant="secondary"><ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Daftar Domain</Button>
        </Link>
      </div>
    );
  }



  const activeNs = domain?.nameservers?.length ? domain.nameservers : ["ns1.liquid.net", "ns2.liquid.net"];

  return (
    <div className="space-y-6">
      {msg && <InfoBanner type="error" message={msg} />}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm flex items-center gap-3">
        <Link to="/domains" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight font-mono">{domain.domainName}</h1>
        </div>
      </div>

      {/* Suspended Banner — visible to customer & reseller when domain is suspended */}
      {domain.status === "suspended" && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-rose-600 text-white rounded-xl shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-rose-900 uppercase tracking-wider">Domain Sedang Di-Suspend</h3>
            <p className="text-xs text-rose-700 mt-0.5">
              {domain.suspendedAt
                ? `Domain ini di-suspend sejak ${new Date(domain.suspendedAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}.`
                : "Domain ini sedang dalam status suspend."}
            </p>
            {domain.suspendReason && (
              <div className="mt-3 p-3 bg-white/70 border border-rose-200 rounded-lg">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">Alasan Suspend</span>
                <p className="text-sm text-rose-900 font-medium mt-1 whitespace-pre-wrap break-words">{domain.suspendReason}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Grid: Details & Nameservers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Domain Information Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-800" /> Informasi Spesifikasi Domain
            </h2>
            {domain.liquidOrderId && (
              <span className="text-xs font-semibold bg-gray-100 px-2.5 py-1 rounded-md text-gray-700">
                Domain ID: #{domain.liquidOrderId}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* Status Verifikasi Item */}
            <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-2 col-span-2">
              <span className="text-gray-500 block text-xs font-medium">Status Verifikasi</span>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {domain.raaVerification?.status === "pending" ? (
                  <span className="inline-flex items-center gap-1.5 font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-md text-xs border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" /> Pending Verifikasi ({domain.raaVerification.email || domain.customerEmail})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md text-xs border border-emerald-200">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" /> Verified
                  </span>
                )}
                {domain.raaVerification?.status === "pending" && (
                  <button
                    onClick={doResendRaa}
                    disabled={raaSending}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shrink-0"
                  >
                    {raaSending ? "Mengirim..." : "Kirim Ulang Email"}
                  </button>
                )}
              </div>
            </div>

            <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-1">
              <span className="text-gray-500 block text-xs font-medium">Tanggal Registrasi</span>
              <span className="font-semibold text-gray-900">{domain.registrationDate || "-"}</span>
            </div>
            <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-1">
              <span className="text-gray-500 block text-xs font-medium">Tanggal Kadaluarsa</span>
              <span className="font-semibold text-gray-900">{domain.expiryDate || "-"}</span>
            </div>
            <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-1">
              <span className="text-gray-500 block text-xs font-medium">Durasi Kontrak</span>
              <span className="font-semibold text-gray-900">{domain.years} Tahun</span>
            </div>
            <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-1">
              <span className="text-gray-500 block text-xs font-medium">Perpanjangan Otomatis</span>
              <span className={`font-semibold ${domain.autoRenew ? "text-emerald-600" : "text-gray-700"}`}>
                {domain.autoRenew ? "✓ Auto-Renew" : "Manual"}
              </span>
            </div>
            {/* WHOIS Privacy Card */}
            <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-2.5 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 block text-xs font-medium">WHOIS Privacy</span>
                {Boolean(domain.privacyProtection) ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                    ✓ Aktif
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-200 border border-gray-300 px-2 py-0.5 rounded-full">
                    Non-Aktif
                  </span>
                )}
              </div>

              {!isIdDomain ? (
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className={`w-4 h-4 ${domain.privacyProtection ? "text-emerald-600" : "text-gray-400"}`} />
                      <span className="text-xs font-semibold text-gray-800">
                        {privacyToggling ? "Memproses..." : domain.privacyProtection ? "Proteksi Aktif" : "Proteksi Non-Aktif"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={togglePrivacy}
                      disabled={privacyToggling || domain.status === "suspended"}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        domain.privacyProtection ? "bg-emerald-600" : "bg-gray-300"
                      } ${privacyToggling || domain.status === "suspended" ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span className="sr-only">Toggle WHOIS Privacy</span>
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          domain.privacyProtection ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {!domain.privacyProtection && (
                    <button
                      onClick={() => setBuyPrivacyOpen(true)}
                      disabled={privacyBuying || domain.status === "suspended"}
                      className="w-full text-xs font-bold text-gray-900 hover:text-black hover:underline transition-colors text-center block pt-1 cursor-pointer"
                    >
                      + Beli WHOIS Protection
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-gray-400 italic">Tidak tersedia untuk domain .id</p>
              )}
            </div>

            {/* Transfer Lock Card */}
            <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-2.5 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 block text-xs font-medium">Transfer Lock</span>
                {domain.locked ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                    🔒 Terkunci
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                    🔓 Terbuka
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  {domain.locked ? <Lock className="w-4 h-4 text-emerald-600" /> : <Unlock className="w-4 h-4 text-amber-600" />}
                  <span className="text-xs font-semibold text-gray-800">
                    {lockLoading ? "Memproses..." : domain.locked ? "Locked" : "Unlocked"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleLock}
                  disabled={lockLoading || domain.status === "suspended"}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    domain.locked ? "bg-emerald-600" : "bg-gray-300"
                  } ${lockLoading || domain.status === "suspended" ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className="sr-only">Toggle Transfer Lock</span>
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      domain.locked ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Theft Protection Card */}
            <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-2.5 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 block text-xs font-medium">Theft Protection</span>
                {domain.theftProtection ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                    ✓ Aktif
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-200 border border-gray-300 px-2 py-0.5 rounded-full">
                    Non-Aktif
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`w-4 h-4 ${domain.theftProtection ? "text-emerald-600" : "text-gray-400"}`} />
                  <span className="text-xs font-semibold text-gray-800">
                    {theftLoading ? "Memproses..." : domain.theftProtection ? "Proteksi Aktif" : "Proteksi Non-Aktif"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleTheft}
                  disabled={theftLoading || domain.status === "suspended"}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    domain.theftProtection ? "bg-emerald-600" : "bg-gray-300"
                  } ${theftLoading || domain.status === "suspended" ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className="sr-only">Toggle Theft Protection</span>
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      domain.theftProtection ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {(domain.customerName || domain.customerEmail) && (
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-sm text-gray-700">
              <span className="flex items-center gap-1.5 text-gray-500"><User className="w-4 h-4" /> Pemilik Domain:</span>
              <span className="font-semibold text-gray-900">{domain.customerName || domain.customerEmail}</span>
            </div>
          )}
        </div>

        {/* Nameservers Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" /> Nameservers Aktif (DNS NS)
              </h2>
              <button
                onClick={handleCopyNs}
                className="text-xs font-semibold text-gray-700 hover:text-black flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                {copiedNs ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copiedNs ? "Tersalin" : "Salin All"}
              </button>
            </div>

            <div className="space-y-2.5">
              {activeNs.map((ns: string, i: number) => (
                <div key={i} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 text-sm font-semibold text-gray-900 flex items-center justify-between">
                  <span>{ns}</span>
                  <span className="text-xs text-gray-500 font-sans uppercase font-bold bg-white px-2 py-0.5 rounded border border-gray-200">NS{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 flex justify-end">
            <button
              onClick={() => { setNsForm(activeNs.length ? [...activeNs] : ["", ""]); setNsOpen(true); }}
              disabled={domain.status === "suspended"}
              title={domain.status === "suspended" ? "Domain suspended — unsuspend dulu" : undefined}
              style={{ backgroundColor: settings.primary_color || "#000000" }}
              className={`w-full py-3 text-white text-sm font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 ${domain.status === "suspended" ? "opacity-50 cursor-not-allowed" : "hover:opacity-90 cursor-pointer"}`}
            >
              <Globe className="w-4 h-4" /> Ubah Nameservers Domain
            </button>
          </div>
        </div>
      </div>

      {/* Action Control Panel */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm space-y-6">
        <div className="border-b border-gray-100 pb-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Pusat Aksi & Kontrol Domain</h2>
            <p className="text-xs text-gray-500 mt-0.5">Akses cepat ke konfigurasi DNS, perpanjangan, transfer auth code, dan administrasi domain.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Action 1: Manage DNS */}
          <Link
            to={`/domains/${id}/dns`}
            onClick={(e) => { if (domain.status === "suspended") e.preventDefault(); }}
            aria-disabled={domain.status === "suspended"}
            title={domain.status === "suspended" ? "Domain suspended — unsuspend dulu" : undefined}
            className={`p-4 sm:p-5 bg-gray-50 border border-gray-200/80 rounded-xl transition-all flex flex-col justify-between gap-3 group ${
              domain.status === "suspended" ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100/90 hover:border-gray-300 cursor-pointer shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 text-white rounded-xl group-hover:scale-105 transition-transform shrink-0" style={{ backgroundColor: settings.primary_color || "#000000" }}>
                <Server className="w-5 h-5" />
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-black transition-colors" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Kelola DNS Record</h3>
              <p className="text-xs text-gray-500 mt-1">Atur A, CNAME, MX, TXT, AAAA record secara langsung.</p>
            </div>
          </Link>

          {/* Action 2: Renew Domain */}
          <button
            onClick={() => { setRenewYears(1); setRenewOpen(true); }}
            disabled={domain.status === "suspended"}
            title={domain.status === "suspended" ? "Domain suspended — unsuspend dulu" : undefined}
            className={`p-4 sm:p-5 bg-gray-50 border border-gray-200/80 rounded-xl transition-all flex flex-col justify-between gap-3 text-left group ${
              domain.status === "suspended" ? "opacity-50 cursor-not-allowed" : "hover:bg-emerald-50/60 hover:border-emerald-200 cursor-pointer shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl group-hover:scale-105 transition-transform">
                <RefreshCw className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                Extend
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Perpanjang Domain</h3>
              <p className="text-xs text-gray-500 mt-1">Tambah masa aktif domain 1-10 tahun.</p>
            </div>
          </button>

          {/* Action 3: Get Auth Code */}
          <button
            onClick={getAuthCode}
            disabled={authLoading || domain.status === "suspended"}
            title={domain.status === "suspended" ? "Domain suspended — unsuspend dulu" : undefined}
            className={`p-4 sm:p-5 bg-gray-50 border border-gray-200/80 rounded-xl transition-all flex flex-col justify-between gap-3 text-left group ${
              domain.status === "suspended" ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100/60 hover:border-gray-300 cursor-pointer shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 text-white rounded-xl group-hover:scale-105 transition-transform shrink-0" style={{ backgroundColor: settings.primary_color || "#000000" }}>
                <Key className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-200">
                EPP Auth
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Dapatkan EPP Auth Code</h3>
              <p className="text-xs text-gray-500 mt-1">Kode otorisasi resmi untuk transfer domain.</p>
            </div>
          </button>

          {/* Action 4: Resend RAA Verification */}
          <button
            onClick={doResendRaa}
            disabled={raaSending || domain.status === "suspended"}
            title={domain.status === "suspended" ? "Domain suspended — unsuspend dulu" : undefined}
            className={`p-4 sm:p-5 bg-gray-50 border border-gray-200/80 rounded-xl transition-all flex flex-col justify-between gap-3 text-left group ${
              domain.status === "suspended" ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-50/60 hover:border-indigo-200 cursor-pointer shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl group-hover:scale-105 transition-transform">
                <Mail className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                ICANN
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Verifikasi RAA ICANN</h3>
              <p className="text-xs text-gray-500 mt-1">Kirim ulang email verifikasi kontak domain.</p>
            </div>
          </button>
        </div>

        {/* Reseller Administrative Controls (Danger Zone / Admin Actions) */}
        {isReseller && (
          <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={toggleSuspend}
                disabled={suspendLoading}
                className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs sm:text-sm font-bold rounded-xl border border-amber-200 transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
                {domain.status === "suspended" ? "Unsuspend Domain" : "Suspend Domain"}
              </button>
            </div>

            <button
              onClick={() => setDeleteOpen(true)}
              className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs sm:text-sm font-bold rounded-xl border border-rose-200 transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-4.5 h-4.5 text-rose-600" /> Hapus Record Domain
            </button>
          </div>
        )}
      </div>

      {/* Complete Domain Contact Information Card (Registrant, Admin, Tech, Billing) */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" /> Detail Kontak Informasi Domain (WHOIS)
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Kontak terdaftar untuk Registrant, Administrative, Technical, dan Billing.</p>
          </div>
          
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl shrink-0">
            {(["registrant", "admin", "tech", "billing"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveContactTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  activeContactTab === tab
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab === "registrant" ? "Registrant" : tab === "admin" ? "Admin" : tab === "tech" ? "Technical" : "Billing"}
              </button>
            ))}
          </div>
        </div>

        {(() => {
          const reg = domain.registrantContact || {};
          const activeContact =
            (activeContactTab === "registrant"
              ? domain.registrantContact
              : activeContactTab === "admin"
              ? domain.adminContact
              : activeContactTab === "tech"
              ? domain.techContact
              : domain.billingContact) || reg;

          const displayName = activeContact.name || reg.name || domain.customerName || domain.customerEmail || "-";
          const displayCompany = activeContact.company || reg.company || "-";
          const displayEmail = activeContact.email || reg.email || domain.customerEmail || "-";
          const displayAddress = activeContact.address || reg.address || "-";
          const displayCity = activeContact.city || reg.city;
          const displayState = activeContact.state || reg.state;
          const displayCountry = activeContact.country || reg.country;
          const displayLoc = [displayCity, displayState, displayCountry].filter(Boolean).join(", ") || "-";
          const displayZip = activeContact.zipcode || reg.zipcode || "-";
          const displayPhone = activeContact.phone || reg.phone || "-";

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-1">
                <span className="text-gray-500 block text-xs font-medium">Nama Lengkap</span>
                <span className="font-semibold text-gray-900 block">{displayName}</span>
              </div>
              <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-1">
                <span className="text-gray-500 block text-xs font-medium">Perusahaan / Organisasi</span>
                <span className="font-semibold text-gray-900 block">{displayCompany}</span>
              </div>
              <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-1">
                <span className="text-gray-500 block text-xs font-medium">Email</span>
                <span className="font-semibold text-gray-900 block font-mono text-xs">{displayEmail}</span>
              </div>
              <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-1 sm:col-span-2">
                <span className="text-gray-500 block text-xs font-medium">Alamat</span>
                <span className="font-semibold text-gray-900 block">{displayAddress}</span>
              </div>
              <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-1">
                <span className="text-gray-500 block text-xs font-medium">Kota / Provinsi / Negara</span>
                <span className="font-semibold text-gray-900 block">{displayLoc}</span>
              </div>
              <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-1">
                <span className="text-gray-500 block text-xs font-medium">Kode Pos</span>
                <span className="font-semibold text-gray-900 block">{displayZip}</span>
              </div>
              <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-1">
                <span className="text-gray-500 block text-xs font-medium">No. Telepon</span>
                <span className="font-semibold text-gray-900 block">{displayPhone}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Renew Modal */}
      {domain && (
        <Modal open={renewOpen} onClose={() => setRenewOpen(false)} title="Perpanjang Masa Berlaku Domain">
          <div className="space-y-4 text-left">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Nama Domain</span>
              <p className="text-sm font-black text-emerald-950 font-mono">{domain.domainName}</p>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Pilih Durasi Perpanjangan</label>
              <select
                value={renewYears}
                onChange={(e) => setRenewYears(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black font-semibold"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(y => (
                  <option key={y} value={y}>{y} Tahun</option>
                ))}
              </select>
            </div>

            {/* WHOIS Protection Option */}
            {!isIdDomain && (
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={renewWithPrivacy}
                    onChange={(e) => setRenewWithPrivacy(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-black focus:ring-black border-gray-300 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">Sertakan / Perpanjang WHOIS Protection</span>
                    <span className="text-[11px] text-gray-500 block">
                      Proteksi privasi identitas WHOIS (+ {fmtPrice((priceList[domain.tld?.toLowerCase()]?.privacy_protect) || 70000)} / tahun)
                    </span>
                  </div>
                </label>
              </div>
            )}

            {/* Itemized Cost Breakdown */}
            {(() => {
              const domainTld = domain.tld?.toLowerCase() || "";
              const pInfo = priceList[domainTld] || {};
              const rawRenewPrice = pInfo.price_renew || 150000;
              const renewUnitPrice = Number(rawRenewPrice) < 1000 ? Number(rawRenewPrice) * 1000 : Number(rawRenewPrice);

              const rawPrivacyPrice = pInfo.privacy_protect || 70000;
              const privacyUnitPrice = Number(rawPrivacyPrice) < 1000 ? Number(rawPrivacyPrice) * 1000 : Number(rawPrivacyPrice);

              const domainTotalCost = renewUnitPrice * renewYears;
              const privacyTotalCost = (!isIdDomain && renewWithPrivacy) ? privacyUnitPrice * renewYears : 0;
              const grandTotalCost = domainTotalCost + privacyTotalCost;

              return (
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Perpanjangan Domain ({renewYears} Tahun)</span>
                    <span className="font-mono font-semibold">{fmtPrice(domainTotalCost)}</span>
                  </div>
                  {!isIdDomain && renewWithPrivacy && (
                    <div className="flex justify-between text-gray-600">
                      <span>WHOIS Protection ({renewYears} Tahun)</span>
                      <span className="font-mono font-semibold">{fmtPrice(privacyTotalCost)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-gray-900 text-sm">
                    <span>Total Tagihan Pembayaran</span>
                    <span className="font-mono font-black text-black">{fmtPrice(grandTotalCost)}</span>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setRenewOpen(false)}>Batal</Button>
              <Button variant="primary" onClick={doRenew} disabled={renewLoading}>
                {renewLoading ? "Memproses..." : "Lanjutkan Pembayaran"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Standalone WHOIS Privacy Buy Modal */}
      {domain && (
        <Modal open={buyPrivacyOpen} onClose={() => setBuyPrivacyOpen(false)} title="Beli WHOIS Privacy Protection">
          <div className="space-y-4 text-left">
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Nama Domain</span>
              <p className="text-sm font-black text-gray-900 font-mono">{domain.domainName}</p>
            </div>

            <div className="p-3.5 bg-gray-50/80 border border-gray-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Proteksi Identitas WHOIS Publik:
              </div>
              <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
                <li>Sembunyikan nama, email, nomor telepon, dan alamat rumah/kantor Anda dari publik.</li>
                <li>Mencegah spam email marketing, penipuan telemarketing, dan scraping kontak domain.</li>
                <li>Status proteksi privasi dapat diaktifkan atau dinonaktifkan sewaktu-waktu.</li>
              </ul>
            </div>

            {(() => {
              const domainTld = domain.tld?.toLowerCase() || "";
              const pInfo = priceList[domainTld] || {};
              const rawPrivacyPrice = pInfo.privacy_protect || 70000;
              const privacyUnitPrice = Number(rawPrivacyPrice) < 1000 ? Number(rawPrivacyPrice) * 1000 : Number(rawPrivacyPrice);

              return (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-950 block">Biaya WHOIS Protection</span>
                    <span className="text-[11px] text-emerald-700">Masa berlaku mengikuti sisa durasi domain</span>
                  </div>
                  <span className="text-base font-black text-emerald-950 font-mono">
                    {fmtPrice(privacyUnitPrice)}
                  </span>
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setBuyPrivacyOpen(false)}>Batal</Button>
              <Button variant="primary" onClick={doBuyPrivacy} disabled={privacyBuying}>
                {privacyBuying ? "Memproses..." : "Lanjutkan Pembayaran"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Nameserver Edit Modal */}
      <Modal open={nsOpen} onClose={() => setNsOpen(false)} title="Ubah Nameservers Domain">
        <div className="space-y-4 text-left">
          <p className="text-xs text-gray-500">Masukkan minimal 2 Host Nameserver aktif untuk mengarahkan DNS domain Anda.</p>
          <div className="space-y-3">
            {nsForm.map((ns, i) => (
              <div key={i}>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Nameserver {i + 1}</label>
                <input
                  value={ns}
                  placeholder={`ns${i + 1}.example.com`}
                  onChange={(e) => {
                    const n = [...nsForm];
                    n[i] = e.target.value;
                    setNsForm(n);
                  }}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black font-mono"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setNsForm([...nsForm, ""])}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              + Tambah Nameserver
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setNsOpen(false)}>Batal</Button>
              <Button onClick={doUpdateNs} disabled={nsLoading}>
                {nsLoading ? "Menyimpan..." : "Simpan Changes"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Auth Code Modal */}
      <Modal open={authCodeOpen} onClose={() => setAuthCodeOpen(false)} title="Kode EPP / Auth Code Domain">
        <div className="space-y-4 text-left">
          <p className="text-xs text-gray-600 leading-relaxed">
            Kode EPP Auth Code ini digunakan jika Anda ingin mengotorisasi pemindahan/transfer domain <strong className="font-mono text-gray-900">{domain.domainName}</strong> ke registrar lain.
          </p>
          <div className="p-4 bg-gray-900 text-emerald-400 rounded-xl border border-gray-800 font-mono text-base text-center font-bold tracking-widest select-all shadow-inner">
            {authCode}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(authCode);
              setCopiedAuth(true);
              toast("Auth code berhasil disalin!");
              setTimeout(() => setCopiedAuth(false), 2000);
            }}
            style={{ backgroundColor: settings.primary_color || "#000000" }}
            className="w-full py-2.5 text-white text-xs font-bold rounded-xl shadow-sm transition-all hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer"
          >
            {copiedAuth ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copiedAuth ? "Tersalin ke Clipboard" : "Salin Auth Code"}
          </button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        title="Hapus Catatan Domain"
        message={`Apakah Anda yakin ingin menghapus catatan domain ${domain.domainName}? Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={doDelete}
        onClose={() => setDeleteOpen(false)}
        loading={deleteLoading}
      />

      {/* Suspend Reason Modal */}
      <Modal open={suspendOpen} onClose={() => !suspendLoading && setSuspendOpen(false)} title="Suspend Domain">
        <div className="space-y-4 text-left">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Nama Domain</span>
            <p className="text-sm font-black text-amber-950 font-mono">{domain.domainName}</p>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Domain akan di-suspend dan alasan akan dicatat. Alasan ini akan ditampilkan ke customer.
          </p>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
              Alasan Suspend <span className="text-rose-600">*</span>
            </label>
            <textarea
              value={suspendReason}
              onChange={(e) => { setSuspendReason(e.target.value); if (suspendError) setSuspendError(""); }}
              placeholder="Contoh: Pelanggaran TOS, domain mengandung kata terlarang..."
              rows={4}
              maxLength={500}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-gray-500">Minimal 5 karakter</span>
              <span className="text-[11px] text-gray-500">{suspendReason.length}/500</span>
            </div>
            {suspendError && (
              <p className="text-xs text-rose-600 font-semibold mt-1.5">{suspendError}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setSuspendOpen(false)} disabled={suspendLoading}>Batal</Button>
            <Button onClick={submitSuspend} disabled={suspendLoading}>
              {suspendLoading ? "Memproses..." : "Suspend Domain"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Unsuspend Confirm */}
      <ConfirmDialog
        open={unsuspendOpen}
        title="Unsuspend Domain"
        message={`Aktifkan kembali domain ${domain.domainName}? Domain akan aktif normal kembali.`}
        onConfirm={confirmUnsuspend}
        onClose={() => setUnsuspendOpen(false)}
        loading={suspendLoading}
      />

      {/* Payment Gateway Modal */}
      <PaymentModal
        open={paymentData.open}
        onClose={() => setPaymentData({ ...paymentData, open: false })}
        orderId={paymentData.orderId}
        paymentLinkUrl={paymentData.paymentLinkUrl}
        amount={paymentData.amount}
        fee={paymentData.fee}
        expiresAt={paymentData.expiresAt}
        currency="IDR"
        domainName={paymentData.domainName}
        onSuccess={() => fetchDomain()}
      />
    </div>
  );
}
