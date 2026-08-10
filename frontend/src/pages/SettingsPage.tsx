import { useState, useEffect } from "react";
import { Card, Button, InfoBanner, LoadingSpinner, toast, SecretInput } from "../components/ui";
import { api } from "../lib/api";
import {
  Globe, Mail, Palette, MessageSquare, CreditCard, HardDrive, Send, Save, Key, RefreshCw, ShieldCheck, Receipt, Percent
} from "lucide-react";

import { useSettings } from "../contexts/SettingsContext";
import { useAuth } from "../contexts/AuthContext";

export default function SettingsPage() {
  const { refreshSettings } = useSettings();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingKirisan, setTestingKirisan] = useState(false);
  const [msg, setMsg] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  // Reseller sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncError, setSyncError] = useState("");

  const [form, setForm] = useState<Record<string, any>>({
    // Brand & SEO
    brand_name: "Ekstensi.id",
    site_tagline: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    og_image_url: "",

    // Email Gateway
    email_provider: "kirisan",
    kirisan_api_url: "",
    kirisan_token: "",
    kirisan_channel_key: "",
    kirisan_template_id: "",
    kirisan_login_otp_template_id: "",
    kirisan_register_otp_template_id: "",
    kirisan_reset_password_template_id: "",
    smtp_host: "smtp-relay.brevo.com",
    smtp_port: "587",
    smtp_user: "",
    smtp_pass: "",
    smtp_from_email: "noreply@ekstensi.id",
    smtp_from_name: "Ekstensi.id Support",

    // Theme & Colors
    primary_color: "#000000",
    header_color: "#ffffff",
    sidebar_color: "#ffffff",
    theme_preset: "monochrome",

    // WA Fonnte
    fonnte_api_url: "",
    fonnte_token: "",
    fonnte_sender: "",
    fonnte_notify_order: true,
    fonnte_notify_expiry: true,

    // Sumopod Gateway
    sumopod_api_key: "",
    sumopod_base_url: "https://api.sumopod.com/v1",
    sumopod_webhook_token: "",
    sumopod_webhook_secret: "",
    sumopod_success_url: "",
    sumopod_cancel_url: "",

    // S3 Object Storage
    s3_endpoint: "",
    s3_region: "us-east-1",
    s3_access_key: "",
    s3_secret_key: "",
    s3_bucket: "",
    s3_public_url: "",

    // Cloudflare Turnstile Security
    turnstile_enabled: false,
    turnstile_site_key: "",
    turnstile_secret_key: "",
    turnstile_verify_url: "",

    // Tax / PPN Configuration
    tax_enabled: false,
    tax_rate: "11",
    tax_label: "PPN",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await api.get<any>("/settings");
      const data = res?.data || res;
      setForm((prev) => ({
        ...prev,
        ...data,
        fonnte_notify_order: data.fonnte_notify_order === "true" || data.fonnte_notify_order === true,
        fonnte_notify_expiry: data.fonnte_notify_expiry === "true" || data.fonnte_notify_expiry === true,
        turnstile_enabled: data.turnstile_enabled === "true" || data.turnstile_enabled === true,
        tax_enabled: data.tax_enabled === "true" || data.tax_enabled === true,
        tax_rate: data.tax_rate ?? "11",
        tax_label: data.tax_label ?? "PPN",
      }));
    } catch (e: any) {
      setMsg(e.message || "Gagal memuat konfigurasi sistem");
    }
    setLoading(false);
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMsg("");
    try {
      await api.put("/settings", form);
      await refreshSettings();
      toast("Konfigurasi sistem berhasil disimpan dan diterapkan!");
    } catch (e: any) {
      setMsg(e.message || "Gagal menyimpan konfigurasi");
    }
    setSaving(false);
  }

  async function handleTestKirisan() {
    if (!recipientEmail) {
      toast("Masukkan email penerima pengujian terlebih dahulu", "error");
      return;
    }
    setTestingKirisan(true);
    try {
      const res = await api.post<any>("/settings/test-kirisan", {
        kirisan_token: form.kirisan_token,
        kirisan_channel_key: form.kirisan_channel_key,
        kirisan_template_id: form.kirisan_template_id || form.kirisan_login_otp_template_id,
        recipient_email: recipientEmail,
      });
      toast(res.message || "Email pengujian Kirisan berhasil dikirim!");
    } catch (e: any) {
      toast(e.message || "Gagal mengirim email pengujian Kirisan", "error");
    }
    setTestingKirisan(false);
  }

  async function handleSyncReseller() {
    setSyncing(true);
    setSyncError("");
    setSyncResult(null);
    try {
      const [resellerRes, custSyncRes, domainSyncRes, billingSyncRes] = await Promise.all([
        api.get<any>("/auth/reseller-data").catch((e) => ({ error: e.message || "Gagal memuat data reseller" })),
        api.post<any>("/customers/sync", {}).catch((e) => ({ error: e.message || "Gagal sinkronisasi customer" })),
        api.post<any>("/domains/sync", {}).catch((e) => ({ error: e.message || "Gagal sinkronisasi domain" })),
        api.post<any>("/billing/sync", {}).catch((e) => ({ error: e.message || "Gagal sinkronisasi billing" })),
      ]);

      const resData = resellerRes?.data || resellerRes;
      const custData = custSyncRes?.data || custSyncRes;
      const domainData = domainSyncRes?.data || domainSyncRes;
      const billingData = billingSyncRes?.data || billingSyncRes;

      if (resData.error && custData.error && domainData.error && billingData.error) {
        throw new Error(resData.error || custData.error || domainData.error || billingData.error);
      }

      setSyncResult({
        ...resData,
        customerSync: custData,
        domainSync: domainData,
        billingSync: billingData,
      });
      toast("Data reseller, customer, domain & billing berhasil disinkronkan ke database!");
    } catch (e: any) {
      console.error("[SettingsPage] ❌ Reseller Sync Error:", e);
      setSyncError(e.message || "Gagal sinkronisasi data reseller");
    }
    setSyncing(false);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Key className="w-6 h-6 text-gray-700" />
            Konfigurasi Sistem
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Atur identitas brand, SEO, gateway email (Kirisan/Brevo), WA Fonnte, Sumopod payment, dan S3 storage.
          </p>
        </div>
        <Button
          onClick={() => handleSave()}
          disabled={saving}
          className="px-4 sm:px-6 py-2.5 bg-black hover:bg-gray-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Simpan Semua Konfigurasi"}
        </Button>
      </div>

      {msg && <InfoBanner type="error" message={msg} />}

      <form onSubmit={handleSave}>
        {/* 2-Column Responsive Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT COLUMN: Brand, SEO, Email Gateway & Theme Colors */}
          <div className="space-y-6">

            {/* 1. Nama Brand & Kebutuhan SEO */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <Globe className="w-5 h-5 text-gray-700" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">1. Brand & SEO Meta</h2>
              </div>
              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nama Brand Platform</label>
                  <input
                    type="text"
                    value={form.brand_name || ""}
                    onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                    placeholder="DomainWhois"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Tagline Platform</label>
                  <input
                    type="text"
                    value={form.site_tagline || ""}
                    onChange={(e) => setForm({ ...form, site_tagline: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                    placeholder="Platform Registrasi & Manajemen Domain Terdepan"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">SEO Title Tag</label>
                  <input
                    type="text"
                    value={form.seo_title || ""}
                    onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                    placeholder="DomainWhois — Domain Registrar"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">SEO Meta Description</label>
                  <textarea
                    rows={2}
                    value={form.seo_description || ""}
                    onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white resize-none"
                    placeholder="Deskripsi meta untuk pencarian Google..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">OG Image Banner URL</label>
                  <input
                    type="text"
                    value={form.og_image_url || ""}
                    onChange={(e) => setForm({ ...form, og_image_url: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                    placeholder="https://domain.com/og-banner.png"
                  />
                </div>
              </div>
            </Card>

            {/* 2. Email Gateway (Brevo / Kirisan API) */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-gray-700" />
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">2. Konfigurasi Email Gateway</h2>
                </div>
              </div>

              {/* Provider Selection Tabs */}
              <div className="p-1 bg-gray-100 rounded-xl flex gap-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, email_provider: "kirisan" })}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    form.email_provider === "kirisan"
                      ? "bg-black text-white shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Kirisan API (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, email_provider: "smtp" })}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    form.email_provider === "smtp"
                      ? "bg-black text-white shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  SMTP (Brevo / Nodemailer)
                </button>
              </div>

              {/* Kirisan API Fields */}
              {form.email_provider === "kirisan" ? (
                <div className="space-y-3.5 pt-2">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                    <p className="font-semibold">💡 Catatan Kirisan API:</p>
                    <p className="mt-0.5">Sistem akan menggunakan template ID dari Dashboard Kirisan. Jika Kirisan gagal/unconfigured, otomatis fallback ke SMTP.</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Kirisan API URL (opsional, override)</label>
                    <input
                      type="url"
                      value={form.kirisan_api_url || ""}
                      onChange={(e) => setForm({ ...form, kirisan_api_url: e.target.value })}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                      placeholder="https://api.kirisan.com/v1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Kirisan Account Token</label>
                    <SecretInput
                      value={form.kirisan_token || ""}
                      onChange={(e) => setForm({ ...form, kirisan_token: e.target.value })}
                      className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                      placeholder="Bearer token dari Kirisan Account Settings"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Kirisan Channel Key (Email Token)</label>
                    <SecretInput
                      value={form.kirisan_channel_key || ""}
                      onChange={(e) => setForm({ ...form, kirisan_channel_key: e.target.value })}
                      className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                      placeholder="Channel key dari Dashboard Kirisan → Channel Email"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Expiry Alert Template ID</label>
                      <input
                        type="text"
                        value={form.kirisan_template_id || ""}
                        onChange={(e) => setForm({ ...form, kirisan_template_id: e.target.value })}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                        placeholder="Contoh: 101"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Login OTP Template ID</label>
                      <input
                        type="text"
                        value={form.kirisan_login_otp_template_id || ""}
                        onChange={(e) => setForm({ ...form, kirisan_login_otp_template_id: e.target.value })}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                        placeholder="Contoh: 102"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Register OTP Template ID</label>
                      <input
                        type="text"
                        value={form.kirisan_register_otp_template_id || ""}
                        onChange={(e) => setForm({ ...form, kirisan_register_otp_template_id: e.target.value })}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                        placeholder="Contoh: 103"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Reset Password Template ID</label>
                      <input
                        type="text"
                        value={form.kirisan_reset_password_template_id || ""}
                        onChange={(e) => setForm({ ...form, kirisan_reset_password_template_id: e.target.value })}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                        placeholder="Contoh: 104"
                      />
                    </div>
                  </div>

                  {/* Uji Koneksi Kirisan API */}
                  <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="Email tujuan pengujian..."
                      className="w-full sm:flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    <Button
                      type="button"
                      onClick={handleTestKirisan}
                      disabled={testingKirisan}
                      className="w-full sm:w-auto px-4 py-2 bg-gray-900 hover:bg-black text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {testingKirisan ? "Menguji..." : "Uji Kirisan API"}
                    </Button>
                  </div>
                </div>
              ) : (
                /* SMTP / Brevo Fields */
                <div className="space-y-3.5 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">SMTP Host</label>
                      <input
                        type="text"
                        value={form.smtp_host || ""}
                        onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                        placeholder="smtp-relay.brevo.com"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">SMTP Port</label>
                      <input
                        type="text"
                        value={form.smtp_port || "587"}
                        onChange={(e) => setForm({ ...form, smtp_port: e.target.value })}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                        placeholder="587"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">SMTP Username / API Key</label>
                    <input
                      type="text"
                      value={form.smtp_user || ""}
                      onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                      placeholder="user@brevo.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">SMTP Password</label>
                    <SecretInput
                      value={form.smtp_pass || ""}
                      onChange={(e) => setForm({ ...form, smtp_pass: e.target.value })}
                      className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                      placeholder="••••••••••••••••"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Pengirim Email (From)</label>
                      <input
                        type="email"
                        value={form.smtp_from_email || ""}
                        onChange={(e) => setForm({ ...form, smtp_from_email: e.target.value })}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white text-xs"
                        placeholder="noreply@domain.com"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nama Pengirim (From Name)</label>
                      <input
                        type="text"
                        value={form.smtp_from_name || ""}
                        onChange={(e) => setForm({ ...form, smtp_from_name: e.target.value })}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white text-xs"
                        placeholder="DomainWhois Support"
                      />
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* 3. Konfigurasi Warna & Tema */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <Palette className="w-5 h-5 text-gray-700" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">3. Tema & Warna Tampilan</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Warna Utama (Primary)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.primary_color || "#000000"}
                      onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={form.primary_color || "#000000"}
                      onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Aksen Header</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.header_color || "#ffffff"}
                      onChange={(e) => setForm({ ...form, header_color: e.target.value })}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={form.header_color || "#ffffff"}
                      onChange={(e) => setForm({ ...form, header_color: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Aksen Sidebar</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.sidebar_color || "#ffffff"}
                      onChange={(e) => setForm({ ...form, sidebar_color: e.target.value })}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={form.sidebar_color || "#ffffff"}
                      onChange={(e) => setForm({ ...form, sidebar_color: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </Card>

          </div>

          {/* RIGHT COLUMN: WA Fonnte, Sumopod Gateway & S3 Storage */}
          <div className="space-y-6">

            {/* 4. Konfigurasi WA Fonnte */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <MessageSquare className="w-5 h-5 text-gray-700" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">4. WhatsApp Gateway (Fonnte)</h2>
              </div>
              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Fonnte API URL (opsional, override)</label>
                  <input
                    type="url"
                    value={form.fonnte_api_url || ""}
                    onChange={(e) => setForm({ ...form, fonnte_api_url: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                    placeholder="https://api.fonnte.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Fonnte API Token</label>
                  <SecretInput
                    value={form.fonnte_token || ""}
                    onChange={(e) => setForm({ ...form, fonnte_token: e.target.value })}
                    className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                    placeholder="Token API dari Fonnte Dashboard"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nomor Pengirim (Sender Number)</label>
                  <input
                    type="text"
                    value={form.fonnte_sender || ""}
                    onChange={(e) => setForm({ ...form, fonnte_sender: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                    placeholder="6281234567890"
                  />
                </div>
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.fonnte_notify_order}
                      onChange={(e) => setForm({ ...form, fonnte_notify_order: e.target.checked })}
                      className="rounded text-black focus:ring-black h-4 w-4"
                    />
                    Kirim notifikasi WA otomatis untuk transaksi order domain baru
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.fonnte_notify_expiry}
                      onChange={(e) => setForm({ ...form, fonnte_notify_expiry: e.target.checked })}
                      className="rounded text-black focus:ring-black h-4 w-4"
                    />
                    Kirim pengingat WA otomatis saat domain mendekati kedaluwarsa
                  </label>
                </div>
              </div>
            </Card>

            {/* 5. Konfigurasi Sumopod Payment Gateway */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <CreditCard className="w-5 h-5 text-gray-700" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">5. Sumopod Payment Gateway</h2>
              </div>
              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Sumopod API Key</label>
                  <SecretInput
                    value={form.sumopod_api_key || ""}
                    onChange={(e) => setForm({ ...form, sumopod_api_key: e.target.value })}
                    className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                    placeholder="API Key dari Sumopod Dashboard"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Sumopod API Base URL</label>
                  <input
                    type="text"
                    value={form.sumopod_base_url || "https://api.sumopod.com/v1"}
                    onChange={(e) => setForm({ ...form, sumopod_base_url: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Webhook Token Header</label>
                    <SecretInput
                      value={form.sumopod_webhook_token || ""}
                      onChange={(e) => setForm({ ...form, sumopod_webhook_token: e.target.value })}
                      className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                      placeholder="X-Webhook-Token"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Webhook Secret (Svix)</label>
                    <SecretInput
                      value={form.sumopod_webhook_secret || ""}
                      onChange={(e) => setForm({ ...form, sumopod_webhook_secret: e.target.value })}
                      className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                      placeholder="whsec_..."
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* 6. Konfigurasi S3 Object Storage */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <HardDrive className="w-5 h-5 text-gray-700" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">6. S3 Object Storage</h2>
              </div>
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">S3 Endpoint URL</label>
                    <input
                      type="text"
                      value={form.s3_endpoint || ""}
                      onChange={(e) => setForm({ ...form, s3_endpoint: e.target.value })}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                      placeholder="https://s3.amazonaws.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">S3 Region</label>
                    <input
                      type="text"
                      value={form.s3_region || "us-east-1"}
                      onChange={(e) => setForm({ ...form, s3_region: e.target.value })}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                      placeholder="us-east-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Access Key ID</label>
                    <input
                      type="text"
                      value={form.s3_access_key || ""}
                      onChange={(e) => setForm({ ...form, s3_access_key: e.target.value })}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                      placeholder="AKIA..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Secret Access Key</label>
                    <SecretInput
                      value={form.s3_secret_key || ""}
                      onChange={(e) => setForm({ ...form, s3_secret_key: e.target.value })}
                      className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Bucket Name</label>
                    <input
                      type="text"
                      value={form.s3_bucket || ""}
                      onChange={(e) => setForm({ ...form, s3_bucket: e.target.value })}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                      placeholder="my-domain-assets"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Public CDN / Custom Domain URL</label>
                    <input
                      type="text"
                      value={form.s3_public_url || ""}
                      onChange={(e) => setForm({ ...form, s3_public_url: e.target.value })}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                      placeholder="https://cdn.domainwhois.net"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* 7. Cloudflare Turnstile Bot Protection */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">7. Keamanan & Cloudflare Turnstile</h2>
                </div>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${form.turnstile_enabled ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}>
                  {form.turnstile_enabled ? "Aktif" : "Non-Aktif"}
                </span>
              </div>

              <p className="text-xs text-gray-500">
                Cloudflare Turnstile melindungi portal web dari bot dan serangan spam tanpa mengganggu kenyamanan pengguna (tanpa CAPTCHA teka-teki).
              </p>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-100 rounded-lg hover:bg-gray-50/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={!!form.turnstile_enabled}
                    onChange={(e) => setForm({ ...form, turnstile_enabled: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                  />
                  <div>
                    <p className="text-xs font-bold text-gray-900">Aktifkan Cloudflare Turnstile Bot Protection</p>
                    <p className="text-[11px] text-gray-500">Mencegah pendaftaran otomatis dan spam brute-force pada formulir sistem</p>
                  </div>
                </label>

                {form.turnstile_enabled && (
                  <div className="space-y-3.5 pt-2 border-t border-gray-100">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Turnstile Site Key (Public Key)</label>
                      <input
                        type="text"
                        value={form.turnstile_site_key || ""}
                        onChange={(e) => setForm({ ...form, turnstile_site_key: e.target.value })}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                        placeholder="0x4AAAAAA..."
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Key publik yang digunakan pada widget Turnstile di frontend.</p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Turnstile Secret Key (Private Key)</label>
                      <SecretInput
                        value={form.turnstile_secret_key || ""}
                        onChange={(e) => setForm({ ...form, turnstile_secret_key: e.target.value })}
                        className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                        placeholder="0x4AAAAAA..."
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Key rahasia untuk verifikasi token CAPTCHA pada server backend Cloudflare siteverify API.</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Turnstile Verify URL (opsional, override)</label>
                      <input
                        type="url"
                        value={form.turnstile_verify_url || ""}
                        onChange={(e) => setForm({ ...form, turnstile_verify_url: e.target.value })}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                        placeholder="https://challenges.cloudflare.com/turnstile/v0/siteverify"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Endpoint siteverify. Kosongkan untuk default.</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Konfigurasi Pajak (PPN) */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <Receipt className="w-5 h-5 text-gray-700" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Konfigurasi Pajak (PPN)</h2>
              </div>
              <p className="text-xs text-gray-500">
                Aktifkan pajak (PPN) pada invoice. Persentase dan label pajak dapat disesuaikan sesuai ketentuan bisnis Anda.
              </p>

              {/* Toggle Aktifkan PPN */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-gray-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">Aktifkan Pajak</p>
                    <p className="text-[11px] text-gray-500">Tampilkan baris pajak pada faktur tagihan</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, tax_enabled: !form.tax_enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    form.tax_enabled ? "bg-emerald-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      form.tax_enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {form.tax_enabled && (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                      Label Pajak
                    </label>
                    <input
                      type="text"
                      value={form.tax_label || "PPN"}
                      onChange={(e) => setForm({ ...form, tax_label: e.target.value })}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                      placeholder="PPN"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Label yang ditampilkan pada baris pajak di faktur (misal: PPN, GST, VAT).</p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                      Persentase Pajak (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={form.tax_rate || "11"}
                        onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white pr-10"
                        placeholder="11"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">%</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Besaran persentase pajak yang diterapkan pada setiap tagihan. Contoh: 11 untuk PPN 11%.</p>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs font-semibold text-blue-700">Preview Kalkulasi:</p>
                    <p className="text-[11px] text-blue-600 mt-1">
                      Subtotal: <span className="font-mono">IDR 100.000</span>&nbsp;→&nbsp;
                      {form.tax_label || "PPN"} {form.tax_rate || "11"}%: <span className="font-mono">IDR {(100000 * (parseFloat(form.tax_rate) || 11) / 100).toLocaleString("id-ID")}</span>&nbsp;→&nbsp;
                      Total: <span className="font-mono font-bold">IDR {(100000 * (1 + (parseFloat(form.tax_rate) || 11) / 100)).toLocaleString("id-ID")}</span>
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* Reseller API Sync — only for reseller role */}
            {user?.role === "reseller" && (
              <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <RefreshCw className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Reseller API Sync</h2>
                </div>
                <p className="text-xs text-gray-500">
                  Sinkronkan data akun reseller dan **seluruh data Customer** dari Resellercamp langsung ke database MySQL lokal server.
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  <Button
                    type="button"
                    onClick={handleSyncReseller}
                    disabled={syncing}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Syncing..." : "Sync Sekarang"}
                  </Button>
                  {syncResult && (
                    <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-3.5 space-y-1.5 w-full">
                      <p className="font-bold border-b border-green-200 pb-1.5 text-green-800 flex items-center justify-between">
                        <span>Hasil Sinkronisasi Resellercamp:</span>
                        <span className="text-[10px] bg-green-200 text-green-900 px-2 py-0.5 rounded-full font-semibold">Selesai</span>
                      </p>
                      {syncResult.reseller_id && (
                        <p><strong>Reseller ID:</strong> {syncResult.reseller_id}</p>
                      )}
                      <p>
                        <strong>Saldo Reseller:</strong>{" "}
                        {(() => {
                          if (!syncResult.balance) return "Gagal membaca saldo (Resellercamp API offline/IP blocked)";
                          if (typeof syncResult.balance === "number") return `Rp ${syncResult.balance.toLocaleString("id-ID")}`;
                          if (typeof syncResult.balance === "string") return `Rp ${parseFloat(syncResult.balance || "0").toLocaleString("id-ID")}`;
                          const val = syncResult.balance?.available ?? syncResult.balance?.balance;
                          if (val !== undefined && val !== null) return `Rp ${parseFloat(String(val)).toLocaleString("id-ID")}`;
                          return "Rp 0";
                        })()}
                      </p>
                      <p>
                        <strong>Status Customer DB:</strong>{" "}
                        {(() => {
                          const c = syncResult.customerSync;
                          if (c?.error) return <span className="text-red-600 font-semibold">❌ Gagal: {c.error}</span>;
                          if (c?.syncedCount !== undefined) return `✅ Berhasil sinkronisasi ${c.syncedCount} customer (${c.newAddedCount ?? 0} baru)`;
                          if (c?.message) return `✅ ${c.message}`;
                          return "✅ Selesai";
                        })()}
                      </p>
                      <p>
                        <strong>Status Domain DB:</strong>{" "}
                        {(() => {
                          const d = syncResult.domainSync;
                          if (d?.error) return <span className="text-red-600 font-semibold">❌ Gagal: {d.error}</span>;
                          if (d?.syncedCount !== undefined) return `✅ Berhasil sinkronisasi ${d.syncedCount} domain (${d.newAddedCount ?? 0} baru)`;
                          if (d?.message) return `✅ ${d.message}`;
                          return "✅ Selesai";
                        })()}
                      </p>
                      <p>
                        <strong>Status Billing DB:</strong>{" "}
                        {(() => {
                          const b = syncResult.billingSync;
                          if (b?.error) return <span className="text-red-600 font-semibold">❌ Gagal: {b.error}</span>;
                          if (b?.synced !== undefined) return `✅ Berhasil sinkronisasi ${b.synced} transaksi wholesale`;
                          if (b?.message) return `✅ ${b.message}`;
                          return "✅ Selesai";
                        })()}
                      </p>
                    </div>
                  )}
                  {syncError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{syncError}</p>
                  )}
                </div>
              </Card>
            )}

          </div>
        </div>

        {/* Floating Bottom Save Bar */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="px-5 sm:px-8 py-3 bg-black hover:bg-gray-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving Configuration..." : "Simpan Semua Konfigurasi"}
          </Button>
        </div>
      </form>
    </div>
  );
}
