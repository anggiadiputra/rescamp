import { useState, useEffect } from "react";
import { Card, Button, InfoBanner, LoadingSpinner, toast, SecretInput } from "../components/ui";
import { api } from "../lib/api";
import {
  Globe, Mail, Palette, MessageSquare, CreditCard, HardDrive, Send, Save, Key
} from "lucide-react";

import { useSettings } from "../contexts/SettingsContext";

export default function SettingsPage() {
  const { refreshSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingKirisan, setTestingKirisan] = useState(false);
  const [msg, setMsg] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  const [form, setForm] = useState<Record<string, any>>({
    // Brand & SEO
    brand_name: "DomainWhois",
    site_tagline: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    og_image_url: "",

    // Email Gateway
    email_provider: "kirisan",
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
    smtp_from_email: "noreply@domainwhois.net",
    smtp_from_name: "DomainWhois Support",

    // Theme & Colors
    primary_color: "#000000",
    header_color: "#ffffff",
    sidebar_color: "#ffffff",
    theme_preset: "monochrome",

    // WA Fonnte
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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
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
          className="px-6 py-2.5 bg-black hover:bg-gray-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2"
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

          </div>
        </div>

        {/* Floating Bottom Save Bar */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-black hover:bg-gray-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving Configuration..." : "Simpan Semua Konfigurasi"}
          </Button>
        </div>
      </form>
    </div>
  );
}
