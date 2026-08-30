import { useState, useEffect } from "react";
import { Card, Button, InfoBanner, LoadingSpinner, toast, SecretInput } from "../components/ui";
import { api } from "../lib/api";
import {
  Globe, Mail, Palette, MessageSquare, CreditCard, HardDrive, Send, Save, Key, RefreshCw, ShieldCheck, Receipt, Percent, SlidersHorizontal, X, Check
} from "lucide-react";

import { useSettings } from "../contexts/SettingsContext";
import { useAuth } from "../contexts/AuthContext";
import { hasResellerCapabilities } from "../lib/types";

const SECTION_FIELDS: Record<string, string[]> = {
  brand: ["brand_name", "site_tagline", "seo_title", "seo_description", "seo_keywords", "og_image_url"],
  email: [
    "email_provider", "kirisan_api_url", "kirisan_token", "kirisan_channel_key",
    "kirisan_template_id", "kirisan_login_otp_template_id", "kirisan_register_otp_template_id",
    "kirisan_reset_password_template_id", "kirisan_register_success_template_id",
    "smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from_email", "smtp_from_name"
  ],
  theme: ["primary_color", "header_color", "sidebar_color", "theme_preset"],
  fonnte: ["fonnte_api_url", "fonnte_token", "fonnte_sender", "fonnte_notify_order", "fonnte_notify_expiry"],
  sumopod: ["sumopod_api_key", "sumopod_base_url", "sumopod_webhook_token", "sumopod_webhook_secret", "sumopod_success_url", "sumopod_cancel_url"],
  s3: ["s3_endpoint", "s3_region", "s3_access_key", "s3_secret_key", "s3_bucket", "s3_public_url"],
  turnstile: ["turnstile_enabled", "turnstile_site_key", "turnstile_secret_key", "turnstile_verify_url"],
  tax: ["tax_enabled", "tax_rate", "tax_label"],
  reseller: ["reseller_id", "reseller_api_key"],
};

export default function SettingsPage() {
  const { refreshSettings, updatePreviewColors, settings } = useSettings();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingKirisan, setTestingKirisan] = useState(false);
  const [testingLiquid, setTestingLiquid] = useState(false);
  const [msg, setMsg] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  // Track editing state per section card
  const [editingSections, setEditingSections] = useState<Record<string, boolean>>({
    brand: false,
    email: false,
    theme: false,
    fonnte: false,
    sumopod: false,
    s3: false,
    turnstile: false,
    tax: false,
    reseller: false,
  });

  // Track initial/saved form state to allow section cancellation
  const [initialForm, setInitialForm] = useState<Record<string, any>>({});

  function handleColorChange(key: "primary_color" | "header_color" | "sidebar_color", val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
    updatePreviewColors({ [key]: val });
  }

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
    kirisan_register_success_template_id: "",
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

    // Resellercamp Upstream API
    reseller_id: "",
    reseller_api_key: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await api.get<any>("/settings");
      const data = res?.data || res;
      const loadedForm = {
        ...form,
        ...data,
        fonnte_notify_order: data.fonnte_notify_order === "true" || data.fonnte_notify_order === true,
        fonnte_notify_expiry: data.fonnte_notify_expiry === "true" || data.fonnte_notify_expiry === true,
        turnstile_enabled: data.turnstile_enabled === "true" || data.turnstile_enabled === true,
        tax_enabled: data.tax_enabled === "true" || data.tax_enabled === true,
        tax_rate: data.tax_rate ?? "11",
        tax_label: data.tax_label ?? "PPN",
        reseller_id: data.reseller_id || "",
        reseller_api_key: data.reseller_api_key || "",
      };
      setForm(loadedForm);
      setInitialForm(loadedForm);
    } catch (e: any) {
      setMsg(e.message || "Gagal memuat konfigurasi sistem");
    }
    setLoading(false);
  }

  function toggleSectionEdit(sectionKey: string) {
    setEditingSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  }

  function cancelSectionEdit(sectionKey: string, fields: string[]) {
    // Revert form fields to initial loaded state
    setForm((prev) => {
      const reverted = { ...prev };
      fields.forEach((f) => {
        if (initialForm[f] !== undefined) {
          reverted[f] = initialForm[f];
        }
      });
      return reverted;
    });
    setEditingSections((prev) => ({
      ...prev,
      [sectionKey]: false,
    }));
  }

  async function handleSave(e?: React.FormEvent, targetSection?: string) {
    if (e) e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMsg("");
    try {
      let payload: Record<string, any> = form;
      if (targetSection && SECTION_FIELDS[targetSection]) {
        payload = {};
        for (const field of SECTION_FIELDS[targetSection]) {
          if (field in form) {
            payload[field] = form[field];
          }
        }
      }
      await api.put("/settings", payload);
      await refreshSettings();
      setInitialForm({ ...form });
      if (targetSection) {
        setEditingSections((prev) => ({ ...prev, [targetSection]: false }));
      } else {
        // Close all edit modes on full save
        setEditingSections({
          brand: false,
          email: false,
          theme: false,
          fonnte: false,
          sumopod: false,
          s3: false,
          turnstile: false,
          tax: false,
          reseller: false,
        });
      }
      toast("Konfigurasi sistem berhasil disimpan dan diterapkan!");
    } catch (e: any) {
      setMsg(e.message || "Gagal menyimpan konfigurasi");
    }
    setSaving(false);
  }

  async function handleTestEmail() {
    if (!recipientEmail) {
      toast("Masukkan email penerima pengujian terlebih dahulu", "error");
      return;
    }
    setTestingKirisan(true);
    try {
      const res = await api.post<any>("/settings/test-email", {
        provider: form.email_provider,
        kirisan_token: form.kirisan_token,
        kirisan_channel_key: form.kirisan_channel_key,
        kirisan_template_id: form.kirisan_template_id || form.kirisan_login_otp_template_id,
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port,
        smtp_user: form.smtp_user,
        smtp_pass: form.smtp_pass,
        brevo_api_key: form.brevo_api_key || form.smtp_pass,
        smtp_from_email: form.smtp_from_email,
        smtp_from_name: form.smtp_from_name,
        recipient_email: recipientEmail,
      });
      toast(res.message || "Email pengujian berhasil dikirim!");
    } catch (e: any) {
      toast(e.message || "Gagal mengirim email pengujian", "error");
    }
    setTestingKirisan(false);
  }

  async function handleTestLiquid() {
    setTestingLiquid(true);
    try {
      const res = await api.post<any>("/settings/test-liquid", {
        reseller_id: form.reseller_id,
        api_key: form.reseller_api_key,
      });
      toast(res.message || "Koneksi Resellercamp API Berhasil!");
    } catch (e: any) {
      toast(e.message || "Gagal menguji koneksi Resellercamp API", "error");
    }
    setTestingLiquid(false);
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

  function maskSecret(val?: string) {
    if (!val) return "Belum diatur";
    if (val.length <= 8) return "••••••••";
    return `${val.substring(0, 4)}••••••••${val.substring(val.length - 4)}`;
  }

  if (loading) return <LoadingSpinner />;

  const isAnyEditing = Object.values(editingSections).some(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Key className="w-6 h-6 text-gray-700" />
            Konfigurasi Sistem
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Atur identitas brand, SEO, gateway email, WA Fonnte, Sumopod payment, S3 storage, Turnstile, dan Pajak.
          </p>
        </div>
        <Button
          onClick={() => handleSave()}
          disabled={saving}
          style={{ backgroundColor: settings.primary_color || "#000000" }}
          className="px-4 sm:px-6 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 hover:opacity-90 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {saving ? "Menyimpan..." : "Simpan Konfigurasi"}
        </Button>
      </div>

      {msg && <InfoBanner type="error" message={msg} />}

      <form onSubmit={(e) => handleSave(e)}>
        {/* 2-Column Responsive Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT COLUMN: Brand, SEO, Email Gateway & Theme Colors */}
          <div className="space-y-6">

            {/* 1. Nama Brand & Kebutuhan SEO */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-gray-700" />
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">1. Brand & SEO Meta</h2>
                </div>
                {!editingSections.brand ? (
                  <button
                    type="button"
                    onClick={() => toggleSectionEdit("brand")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-black bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cancelSectionEdit("brand", ["brand_name", "site_tagline", "seo_title", "seo_description", "og_image_url"])}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave(undefined, "brand")}
                      disabled={saving}
                      style={{ backgroundColor: settings.primary_color || "#000000" }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-colors shadow-xs hover:opacity-90 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan
                    </button>
                  </div>
                )}
              </div>

              {!editingSections.brand ? (
                /* READ-ONLY VIEW */
                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Nama Brand Platform</label>
                    <p className="text-sm font-semibold text-gray-900">{form.brand_name || "—"}</p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Tagline Platform</label>
                    <p className="text-sm text-gray-700 font-medium">{form.site_tagline || "—"}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">SEO Title Tag</label>
                      <p className="text-xs text-gray-800 font-mono bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">{form.seo_title || "—"}</p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">OG Image Banner URL</label>
                      <p className="text-xs text-gray-800 font-mono bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100 truncate">{form.og_image_url || "—"}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">SEO Meta Description</label>
                    <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded border border-gray-100 leading-relaxed">{form.seo_description || "—"}</p>
                  </div>
                </div>
              ) : (
                /* EDIT FORM */
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
              )}
            </Card>

            {/* 2. Email Gateway (Brevo / Kirisan API) */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-gray-700" />
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">2. Konfigurasi Email Gateway</h2>
                </div>
                {!editingSections.email ? (
                  <button
                    type="button"
                    onClick={() => toggleSectionEdit("email")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-black bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cancelSectionEdit("email", [
                        "email_provider", "kirisan_api_url", "kirisan_token", "kirisan_channel_key",
                        "kirisan_template_id", "kirisan_login_otp_template_id", "kirisan_register_otp_template_id",
                        "kirisan_reset_password_template_id", "kirisan_register_success_template_id",
                        "smtp_host", "smtp_port", "smtp_user", "smtp_pass",
                        "smtp_from_email", "smtp_from_name"
                      ])}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave(undefined, "email")}
                      disabled={saving}
                      style={{ backgroundColor: settings.primary_color || "#000000" }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-colors shadow-xs hover:opacity-90 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan
                    </button>
                  </div>
                )}
              </div>

              {!editingSections.email ? (
                /* READ-ONLY VIEW */
                <div className="space-y-3.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-gray-500 font-semibold uppercase text-[10px]">Aktif Provider:</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white uppercase tracking-wider" style={{ backgroundColor: settings.primary_color || "#000000" }}>
                      {form.email_provider === "kirisan" ? "Kirisan API (Recommended)" : "SMTP / Brevo"}
                    </span>
                  </div>

                  {form.email_provider === "kirisan" ? (
                    <div className="space-y-2.5 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Kirisan API URL</label>
                          <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100 truncate">
                            {form.kirisan_api_url || "Default (https://api.kirisan.com/v1)"}
                          </p>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Kirisan Account Token</label>
                          <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                            {maskSecret(form.kirisan_token)}
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Kirisan Channel Key</label>
                        <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                          {maskSecret(form.kirisan_channel_key)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
                        <div className="bg-gray-50 p-2 rounded border border-gray-100">
                          <span className="text-[9px] uppercase font-bold text-gray-400 block">Expiry Alert ID</span>
                          <span className="text-xs font-mono font-bold text-gray-800">{form.kirisan_template_id || "—"}</span>
                        </div>
                        <div className="bg-gray-50 p-2 rounded border border-gray-100">
                          <span className="text-[9px] uppercase font-bold text-gray-400 block">Login OTP ID</span>
                          <span className="text-xs font-mono font-bold text-gray-800">{form.kirisan_login_otp_template_id || "—"}</span>
                        </div>
                        <div className="bg-gray-50 p-2 rounded border border-gray-100">
                          <span className="text-[9px] uppercase font-bold text-gray-400 block">Register OTP ID</span>
                          <span className="text-xs font-mono font-bold text-gray-800">{form.kirisan_register_otp_template_id || "—"}</span>
                        </div>
                        <div className="bg-gray-50 p-2 rounded border border-gray-100">
                          <span className="text-[9px] uppercase font-bold text-gray-400 block">Reset Pass ID</span>
                          <span className="text-xs font-mono font-bold text-gray-800">{form.kirisan_reset_password_template_id || "—"}</span>
                        </div>
                        <div className="bg-gray-50 p-2 rounded border border-gray-100">
                          <span className="text-[9px] uppercase font-bold text-gray-400 block">Reg Success ID</span>
                          <span className="text-xs font-mono font-bold text-gray-800">{form.kirisan_register_success_template_id || "—"}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">SMTP Host & Port</label>
                          <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                            {form.smtp_host || "—"}:{form.smtp_port || "587"}
                          </p>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">SMTP Username</label>
                          <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100 truncate">
                            {form.smtp_user || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Pengirim Email (From)</label>
                          <p className="text-xs font-medium text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                            {form.smtp_from_name ? `${form.smtp_from_name} <${form.smtp_from_email}>` : form.smtp_from_email || "—"}
                          </p>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">SMTP Password</label>
                          <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                            {maskSecret(form.smtp_pass)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Uji Koneksi Kirisan API */}
                  <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="Email tujuan pengujian..."
                      className="w-full sm:flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-black bg-white"
                    />
                    <Button
                      type="button"
                      onClick={handleTestEmail}
                      disabled={testingKirisan}
                      style={{ backgroundColor: settings.primary_color || "#000000" }}
                      className="w-full sm:w-auto px-4 py-2 hover:opacity-90 text-white font-semibold text-xs rounded-lg transition-opacity flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {testingKirisan ? "Menguji..." : `Uji Email (${form.email_provider === "kirisan" ? "Kirisan" : "Brevo"})`}
                    </Button>
                  </div>
                </div>
              ) : (
                /* EDIT FORM */
                <div className="space-y-4">
                  {/* Provider Selection Tabs */}
                  <div className="p-1 bg-gray-100 rounded-xl flex gap-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, email_provider: "kirisan" })}
                      style={form.email_provider === "kirisan" ? { backgroundColor: settings.primary_color || "#000000", color: "#ffffff" } : undefined}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        form.email_provider === "kirisan"
                          ? "shadow-xs"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Kirisan API (Recommended)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, email_provider: "smtp" })}
                      style={form.email_provider === "smtp" ? { backgroundColor: settings.primary_color || "#000000", color: "#ffffff" } : undefined}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        form.email_provider === "smtp"
                          ? "shadow-xs"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      SMTP (Brevo / Nodemailer)
                    </button>
                  </div>

                  {/* Kirisan API Fields */}
                  {form.email_provider === "kirisan" ? (
                    <div className="space-y-3.5 pt-1">
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
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Reset Pass Template ID</label>
                          <input
                            type="text"
                            value={form.kirisan_reset_password_template_id || ""}
                            onChange={(e) => setForm({ ...form, kirisan_reset_password_template_id: e.target.value })}
                            className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                            placeholder="Contoh: 104"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Reg Success Template ID</label>
                          <input
                            type="text"
                            value={form.kirisan_register_success_template_id || ""}
                            onChange={(e) => setForm({ ...form, kirisan_register_success_template_id: e.target.value })}
                            className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono text-xs"
                            placeholder="Contoh: 105"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* SMTP / Brevo Fields */
                    <div className="space-y-3.5 pt-1">
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
                </div>
              )}
            </Card>

            {/* 3. Konfigurasi Warna & Tema */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-gray-700" />
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">3. Tema & Warna Tampilan</h2>
                </div>
                {!editingSections.theme ? (
                  <button
                    type="button"
                    onClick={() => toggleSectionEdit("theme")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-black bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cancelSectionEdit("theme", ["primary_color", "header_color", "sidebar_color"])}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave(undefined, "theme")}
                      disabled={saving}
                      style={{ backgroundColor: settings.primary_color || "#000000" }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-colors shadow-xs hover:opacity-90 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan
                    </button>
                  </div>
                )}
              </div>

              {!editingSections.theme ? (
                /* READ-ONLY VIEW */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-3">
                    <span
                      className="w-8 h-8 rounded-full border border-gray-300 shadow-xs shrink-0"
                      style={{ backgroundColor: form.primary_color || "#000000" }}
                    />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Warna Utama</span>
                      <span className="font-mono font-bold text-gray-900">{form.primary_color || "#000000"}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-3">
                    <span
                      className="w-8 h-8 rounded-full border border-gray-300 shadow-xs shrink-0"
                      style={{ backgroundColor: form.header_color || "#ffffff" }}
                    />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Aksen Header</span>
                      <span className="font-mono font-bold text-gray-900">{form.header_color || "#ffffff"}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-3">
                    <span
                      className="w-8 h-8 rounded-full border border-gray-300 shadow-xs shrink-0"
                      style={{ backgroundColor: form.sidebar_color || "#ffffff" }}
                    />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Aksen Sidebar</span>
                      <span className="font-mono font-bold text-gray-900">{form.sidebar_color || "#ffffff"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* EDIT FORM */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Warna Utama (Primary)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.primary_color || "#000000"}
                        onChange={(e) => handleColorChange("primary_color", e.target.value)}
                        className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={form.primary_color || "#000000"}
                        onChange={(e) => handleColorChange("primary_color", e.target.value)}
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
                        onChange={(e) => handleColorChange("header_color", e.target.value)}
                        className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={form.header_color || "#ffffff"}
                        onChange={(e) => handleColorChange("header_color", e.target.value)}
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
                        onChange={(e) => handleColorChange("sidebar_color", e.target.value)}
                        className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={form.sidebar_color || "#ffffff"}
                        onChange={(e) => handleColorChange("sidebar_color", e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </Card>

          </div>

          {/* RIGHT COLUMN: WA Fonnte, Sumopod Gateway & S3 Storage */}
          <div className="space-y-6">

            {/* 4. Konfigurasi WA Fonnte */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-gray-700" />
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">4. WhatsApp Gateway (Fonnte)</h2>
                </div>
                {!editingSections.fonnte ? (
                  <button
                    type="button"
                    onClick={() => toggleSectionEdit("fonnte")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-black bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cancelSectionEdit("fonnte", ["fonnte_api_url", "fonnte_token", "fonnte_sender", "fonnte_notify_order", "fonnte_notify_expiry"])}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave(undefined, "fonnte")}
                      disabled={saving}
                      style={{ backgroundColor: settings.primary_color || "#000000" }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-colors shadow-xs hover:opacity-90 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan
                    </button>
                  </div>
                )}
              </div>

              {!editingSections.fonnte ? (
                /* READ-ONLY VIEW */
                <div className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Fonnte API URL</label>
                      <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100 truncate">
                        {form.fonnte_api_url || "Default (https://api.fonnte.com)"}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Nomor Pengirim (Sender)</label>
                      <p className="text-xs font-mono font-semibold text-gray-900 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                        {form.fonnte_sender || "—"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Fonnte API Token</label>
                    <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                      {maskSecret(form.fonnte_token)}
                    </p>
                  </div>
                  <div className="space-y-2 pt-1 border-t border-gray-100">
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
                      <span className="text-gray-700 font-medium">Notifikasi WA Order Domain Baru</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${form.fonnte_notify_order ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"}`}>
                        {form.fonnte_notify_order ? "Aktif" : "Non-aktif"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
                      <span className="text-gray-700 font-medium">Pengingat WA Domain Kedaluwarsa</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${form.fonnte_notify_expiry ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"}`}>
                        {form.fonnte_notify_expiry ? "Aktif" : "Non-aktif"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* EDIT FORM */
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
              )}
            </Card>

            {/* 5. Konfigurasi Sumopod Payment Gateway */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-gray-700" />
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">5. Sumopod Payment Gateway</h2>
                </div>
                {!editingSections.sumopod ? (
                  <button
                    type="button"
                    onClick={() => toggleSectionEdit("sumopod")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-black bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cancelSectionEdit("sumopod", ["sumopod_api_key", "sumopod_base_url", "sumopod_webhook_token", "sumopod_webhook_secret"])}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave(undefined, "sumopod")}
                      disabled={saving}
                      style={{ backgroundColor: settings.primary_color || "#000000" }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-colors shadow-xs hover:opacity-90 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan
                    </button>
                  </div>
                )}
              </div>

              {!editingSections.sumopod ? (
                /* READ-ONLY VIEW */
                <div className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Environment Mode</label>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${form.sumopod_base_url?.includes("sandbox") ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                        <span className={`w-2 h-2 rounded-full ${form.sumopod_base_url?.includes("sandbox") ? "bg-amber-500" : "bg-emerald-500"}`}></span>
                        {form.sumopod_base_url?.includes("sandbox") ? "Sandbox (Testing)" : "Live (Production)"}
                      </span>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Sumopod API Key</label>
                      <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                        {maskSecret(form.sumopod_api_key)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">API Base URL</label>
                    <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                      {form.sumopod_base_url || "https://api-pay.sumopod.com/api/v1"}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Webhook Token Header</label>
                      <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                        {maskSecret(form.sumopod_webhook_token)}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Webhook Secret (Svix)</label>
                      <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                        {maskSecret(form.sumopod_webhook_secret)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* EDIT FORM */
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Pilih Environment Mode</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, sumopod_base_url: "https://api-pay.sumopod.com/api/v1" })}
                        className={`p-3 border rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                          !form.sumopod_base_url?.includes("sandbox")
                            ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            Live (Production)
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono mt-1">https://api-pay.sumopod.com/api/v1</div>
                        </div>
                        {!form.sumopod_base_url?.includes("sandbox") && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setForm({ ...form, sumopod_base_url: "https://api-pay-sandbox.sumopod.com/api/v1" })}
                        className={`p-3 border rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                          form.sumopod_base_url?.includes("sandbox")
                            ? "border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                            Sandbox (Testing)
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono mt-1">https://api-pay-sandbox.sumopod.com/api/v1</div>
                        </div>
                        {form.sumopod_base_url?.includes("sandbox") && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                      </button>
                    </div>
                  </div>

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
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Sumopod API Base URL (Custom)</label>
                    <input
                      type="text"
                      value={form.sumopod_base_url || "https://api-pay.sumopod.com/api/v1"}
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
              )}
            </Card>

            {/* 6. Konfigurasi S3 Object Storage */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-gray-700" />
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">6. S3 Object Storage</h2>
                </div>
                {!editingSections.s3 ? (
                  <button
                    type="button"
                    onClick={() => toggleSectionEdit("s3")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-black bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cancelSectionEdit("s3", ["s3_endpoint", "s3_region", "s3_access_key", "s3_secret_key", "s3_bucket", "s3_public_url"])}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave(undefined, "s3")}
                      disabled={saving}
                      style={{ backgroundColor: settings.primary_color || "#000000" }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-colors shadow-xs hover:opacity-90 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan
                    </button>
                  </div>
                )}
              </div>

              {!editingSections.s3 ? (
                /* READ-ONLY VIEW */
                <div className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">S3 Endpoint URL</label>
                      <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100 truncate">
                        {form.s3_endpoint || "—"}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">S3 Region</label>
                      <p className="text-xs font-mono font-semibold text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                        {form.s3_region || "us-east-1"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Access Key ID</label>
                      <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100 truncate">
                        {form.s3_access_key || "—"}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Secret Access Key</label>
                      <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                        {maskSecret(form.s3_secret_key)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Bucket Name</label>
                      <p className="text-xs font-mono font-bold text-gray-900 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                        {form.s3_bucket || "—"}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Public CDN URL</label>
                      <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100 truncate">
                        {form.s3_public_url || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* EDIT FORM */
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
              )}
            </Card>

            {/* 7. Cloudflare Turnstile Bot Protection */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">7. Keamanan & Cloudflare Turnstile</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${form.turnstile_enabled ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}>
                    {form.turnstile_enabled ? "Aktif" : "Non-Aktif"}
                  </span>
                  {!editingSections.turnstile ? (
                    <button
                      type="button"
                      onClick={() => toggleSectionEdit("turnstile")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-black bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => cancelSectionEdit("turnstile", ["turnstile_enabled", "turnstile_site_key", "turnstile_secret_key", "turnstile_verify_url"])}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSave(undefined, "turnstile")}
                        disabled={saving}
                        style={{ backgroundColor: settings.primary_color || "#000000" }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-colors shadow-xs hover:opacity-90 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Simpan
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {!editingSections.turnstile ? (
                /* READ-ONLY VIEW */
                <div className="space-y-3.5 text-xs">
                  <p className="text-xs text-gray-500">
                    Cloudflare Turnstile melindungi portal web dari bot dan serangan spam tanpa mengganggu kenyamanan pengguna.
                  </p>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Turnstile Site Key (Public Key)</label>
                    <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                      {form.turnstile_site_key || "—"}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Turnstile Secret Key (Private Key)</label>
                    <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                      {maskSecret(form.turnstile_secret_key)}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Verify URL</label>
                    <p className="text-xs font-mono text-gray-800 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100 truncate">
                      {form.turnstile_verify_url || "Default (https://challenges.cloudflare.com/...)"}
                    </p>
                  </div>
                </div>
              ) : (
                /* EDIT FORM */
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Cloudflare Turnstile melindungi portal web dari bot dan serangan spam tanpa mengganggu kenyamanan pengguna (tanpa CAPTCHA teka-teki).
                  </p>

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
              )}
            </Card>

            {/* 8. Konfigurasi Pajak (PPN) */}
            <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-gray-700" />
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">8. Konfigurasi Pajak (PPN)</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${form.tax_enabled ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}>
                    {form.tax_enabled ? "Aktif" : "Non-Aktif"}
                  </span>
                  {!editingSections.tax ? (
                    <button
                      type="button"
                      onClick={() => toggleSectionEdit("tax")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-black bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => cancelSectionEdit("tax", ["tax_enabled", "tax_label", "tax_rate"])}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSave(undefined, "tax")}
                        disabled={saving}
                        style={{ backgroundColor: settings.primary_color || "#000000" }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-colors shadow-xs hover:opacity-90 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Simpan
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {!editingSections.tax ? (
                /* READ-ONLY VIEW */
                <div className="space-y-3.5 text-xs">
                  <p className="text-xs text-gray-500">
                    Aktifkan pajak (PPN) pada invoice. Persentase dan label pajak dapat disesuaikan sesuai ketentuan bisnis Anda.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Label Pajak</label>
                      <p className="text-xs font-bold text-gray-900 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                        {form.tax_label || "PPN"}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Persentase Pajak (%)</label>
                      <p className="text-xs font-mono font-bold text-gray-900 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                        {form.tax_rate || "11"}%
                      </p>
                    </div>
                  </div>

                  {form.tax_enabled && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                      <p className="text-xs font-semibold text-blue-700">Preview Kalkulasi Tagihan:</p>
                      <p className="text-[11px] text-blue-600 mt-1">
                        Subtotal: <span className="font-mono">IDR 100.000</span>&nbsp;→&nbsp;
                        {form.tax_label || "PPN"} {form.tax_rate || "11"}%: <span className="font-mono">IDR {(100000 * (parseFloat(form.tax_rate) || 11) / 100).toLocaleString("id-ID")}</span>&nbsp;→&nbsp;
                        Total: <span className="font-mono font-bold">IDR {(100000 * (1 + (parseFloat(form.tax_rate) || 11) / 100)).toLocaleString("id-ID")}</span>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* EDIT FORM */
                <div className="space-y-4">
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
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
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
                </div>
              )}
            </Card>

            {/* Resellercamp Liquid API Configuration — admin retains reseller capabilities */}
            {hasResellerCapabilities(user?.role) && (
              <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Kredensial Resellercamp (Liquid API)</h2>
                      <p className="text-xs text-gray-500">Konfigurasi akun reseller untuk pemesanan domain, DNS, dan sinkronisasi data.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingSections.reseller ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => cancelSectionEdit("reseller", SECTION_FIELDS.reseller)}
                          disabled={saving}
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Batal
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => handleSave(undefined, "reseller")}
                          disabled={saving}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Simpan
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleSectionEdit("reseller")}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 mr-1" /> Ubah
                      </Button>
                    )}
                  </div>
                </div>

                {!editingSections.reseller ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-100">
                      <span className="text-xs text-gray-400 block mb-1 font-medium">Reseller ID</span>
                      <span className="text-sm font-mono text-gray-900 font-semibold">{form.reseller_id || "Belum diatur"}</span>
                    </div>
                    <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-100">
                      <span className="text-xs text-gray-400 block mb-1 font-medium">API Key</span>
                      <span className="text-sm font-mono text-gray-700">{maskSecret(form.reseller_api_key)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                          Reseller ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.reseller_id || ""}
                          onChange={(e) => setForm({ ...form, reseller_id: e.target.value })}
                          className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                          placeholder="Masukkan Reseller ID Anda..."
                        />
                        <p className="text-[10px] text-gray-400 mt-1">ID Reseller dari dashboard Resellercamp / Liquid.</p>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                          API Key Resellercamp <span className="text-red-500">*</span>
                        </label>
                        <SecretInput
                          value={form.reseller_api_key || ""}
                          onChange={(e) => setForm({ ...form, reseller_api_key: e.target.value })}
                          placeholder="Masukkan API Key Resellercamp..."
                        />
                        <p className="text-[10px] text-gray-400 mt-1">API Key dienkripsi aman dengan AES-256-GCM di database.</p>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleTestLiquid}
                        disabled={testingLiquid || !form.reseller_id || !form.reseller_api_key}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1 ${testingLiquid ? "animate-spin" : ""}`} />
                        {testingLiquid ? "Menguji..." : "Uji Koneksi Resellercamp"}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Reseller API Sync — admin retains reseller capabilities */}
            {hasResellerCapabilities(user?.role) && (
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
                    variant="primary"
                    size="md"
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
        <div className="mt-8 pt-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {isAnyEditing ? "⚠️ Terdapat section yang sedang disunting." : "Semua section dalam kondisi tertutup (ringkasan)."}
          </p>
          <Button
            type="submit"
            disabled={saving}
            style={{ backgroundColor: settings.primary_color || "#000000" }}
            className="px-5 sm:px-8 py-3 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 hover:opacity-90 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? "Menyimpan..." : "Simpan Semuanya"}
          </Button>
        </div>
      </form>
    </div>
  );
}
