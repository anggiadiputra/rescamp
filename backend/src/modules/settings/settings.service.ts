import { db } from "../../db";
import { appSettings, users } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { env } from "../../config/env";
import { AppError } from "../../lib/error";
import { decrypt, encrypt } from "../../lib/encryption";

export interface SettingsData {
  // Brand & SEO
  brand_name?: string;
  site_tagline?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  og_image_url?: string;

  // Email Gateway
  email_provider?: "kirisan" | "smtp" | "brevo_api";
  kirisan_api_url?: string;
  kirisan_token?: string;
  kirisan_channel_key?: string;
  kirisan_template_id?: string;
  kirisan_login_otp_template_id?: string;
  kirisan_register_otp_template_id?: string;
  kirisan_reset_password_template_id?: string;
  kirisan_register_success_template_id?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from_email?: string;
  smtp_from_name?: string;
  brevo_api_key?: string;

  // Theme & Colors
  primary_color?: string;
  header_color?: string;
  sidebar_color?: string;
  theme_preset?: string;

  // WA Fonnte
  fonnte_api_url?: string;
  fonnte_token?: string;
  fonnte_sender?: string;
  fonnte_notify_order?: boolean;
  fonnte_notify_expiry?: boolean;

  // Sumopod Gateway
  sumopod_api_key?: string;
  sumopod_base_url?: string;
  sumopod_webhook_token?: string;
  sumopod_webhook_secret?: string;
  sumopod_success_url?: string;
  sumopod_cancel_url?: string;

  // Duitku Gateway (payment gateway #2 — aktif berdampingan dengan Sumopod)
  duitku_enabled?: string; // "true"/"false"
  duitku_merchant_code?: string;
  duitku_api_key?: string; // terenkripsi at rest (SECRET_SETTING_FIELDS)
  duitku_base_url?: string; // kosong = default dari DUITKU_ENV
  duitku_environment?: string; // "sandbox" | "production" — override base URL
  payment_gateways_config?: string; // JSON {default} — default terkunci "sumopod"
  duitku_channels?: string; // JSON cache channel hasil tombol Sinkronkan

  // S3 Object Storage
  s3_endpoint?: string;
  s3_region?: string;
  s3_access_key?: string;
  s3_secret_key?: string;
  s3_bucket?: string;
  s3_public_url?: string;

  // Cloudflare Turnstile Security
  turnstile_enabled?: boolean;
  turnstile_site_key?: string;
  turnstile_secret_key?: string;
  turnstile_verify_url?: string;

  // Tax / PPN Configuration
  tax_enabled?: boolean;
  tax_rate?: string; // percent, e.g. "11" for 11%
  tax_label?: string; // e.g. "PPN"
}

const DEFAULT_SETTINGS: Record<string, string> = {
  brand_name: "Ekstensi.id",
  site_tagline: "High-Performance Domain & Hosting Management Platform",
  seo_title: "Ekstensi.id — Registrasi & Manajemen Domain",
  seo_description: "Manage, register, transfer, and renew domains effortlessly.",
  seo_keywords: "domain, registrar, whois, dns, hosting, liquid, sumopod",
  og_image_url: "",

  email_provider: "kirisan",
  kirisan_api_url: env.KIRISAN_API_URL,
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
  brevo_api_key: "",

  primary_color: "#000000",
  header_color: "#ffffff",
  sidebar_color: "#ffffff",
  theme_preset: "monochrome",

  fonnte_api_url: env.FONNTE_API_URL,
  fonnte_token: "",
  fonnte_sender: "",
  fonnte_notify_order: "true",
  fonnte_notify_expiry: "true",

  sumopod_api_key: env.SUMOPOD_API_KEY,
  sumopod_base_url: env.SUMOPOD_PAYMENT_URL,
  sumopod_webhook_token: env.SUMOPOD_WEBHOOK_TOKEN,
  sumopod_webhook_secret: env.SUMOPOD_WEBHOOK_SECRET,
  sumopod_success_url: `${env.CORS_ORIGIN}/billing?status=success`,
  sumopod_cancel_url: `${env.CORS_ORIGIN}/billing?status=cancel`,

  duitku_enabled: "false",
  duitku_merchant_code: env.DUITKU_MERCHANT_CODE,
  duitku_api_key: env.DUITKU_API_KEY,
  duitku_base_url: env.DUITKU_BASE_URL,
  duitku_environment: env.DUITKU_ENV === "production" ? "production" : "sandbox",
  payment_gateways_config: JSON.stringify({ default: "sumopod" }),
  duitku_channels: "",

  s3_endpoint: "",
  s3_region: "us-east-1",
  s3_access_key: "",
  s3_secret_key: "",
  s3_bucket: "",
  s3_public_url: "",

  turnstile_enabled: "false",
  turnstile_site_key: "",
  turnstile_secret_key: "",
  turnstile_verify_url: env.TURNSTILE_VERIFY_URL,

  tax_enabled: "false",
  tax_rate: "11",
  tax_label: "PPN",

  reseller_id: env.DEFAULT_RESELLER_ID || "",
  reseller_api_key: env.RESELLER_API_KEY || "",
};

const SECRET_SETTING_FIELDS = new Set([
  "sumopod_api_key", "sumopod_webhook_secret", "sumopod_webhook_token",
  "kirisan_token", "kirisan_channel_key", "smtp_pass", "brevo_api_key",
  "fonnte_token", "s3_access_key", "s3_secret_key", "turnstile_secret_key",
  "reseller_api_key", "liquid_api_key",
  "duitku_api_key",
]);

export async function encodeSettingValue(key: string, value: string): Promise<string> {
  if (!SECRET_SETTING_FIELDS.has(key) || !value || value.startsWith("v2:")) return value;
  return encrypt(value);
}

export async function decodeSettingValue(key: string, value: string): Promise<string> {
  if (!SECRET_SETTING_FIELDS.has(key) || !value || !value.startsWith("v2:")) return value;
  return decrypt(value);
}

let isTableInitialized = false;

export async function ensureSettingsTableExists() {
  if (isTableInitialized) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`app_settings\` (
        \`key\` VARCHAR(100) PRIMARY KEY,
        \`value\` TEXT,
        \`category\` VARCHAR(50) DEFAULT 'general',
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Auto-seed initial settings into database table if table is empty
    const rows = await db.select().from(appSettings).limit(1);
    if (rows.length === 0) {
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        await db.insert(appSettings).values({
          key,
          value: await encodeSettingValue(key, value),
          category: getCategoryForKey(key),
        }).catch(() => {});
      }
    }

    // Transparently migrate legacy plaintext secrets at startup.
    const currentRows = await db.select().from(appSettings);
    for (const row of currentRows) {
      if (row.key && row.value && SECRET_SETTING_FIELDS.has(row.key) && !row.value.startsWith("v2:")) {
        await db.update(appSettings)
          .set({ value: await encodeSettingValue(row.key, row.value) })
          .where(eq(appSettings.key, row.key));
      }
    }

    isTableInitialized = true;
  } catch (err) {
    console.error("[settings service] Auto-creation of app_settings table failed:", err);
  }
}

export async function getSystemSettings(): Promise<Record<string, string>> {
  await ensureSettingsTableExists();
  try {
    const rows = await db.select().from(appSettings);
    const settingsMap: Record<string, string> = {};

    // Populate dynamic values directly from database rows
    for (const r of rows) {
      if (r.key && r.value !== null) {
        settingsMap[r.key] = await decodeSettingValue(r.key, r.value);
      }
    }

    // Fill missing schema keys if not present in DB
    for (const [key, defaultVal] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(key in settingsMap)) {
        settingsMap[key] = defaultVal;
      }
    }

    return settingsMap;
  } catch (err) {
    console.warn("[settings service] Table app_settings read failed:", err);
    return {};
  }
}

// H16: SSRF guard — URLs in settings must be https and point at known providers.
// Prevents a (compromised) reseller from steering the app's outgoing requests
// (which carry real API keys/tokens) to an attacker host.
//
// Every field the server actually FETCHES outbound must be listed here. A
// `_url` field that is NOT in this map gets no host allowlist (only the
// https + non-private checks), which is exactly how an SSRF sneaks through.
const URL_FIELD_ALLOWED_HOSTS: Record<string, string[]> = {
  kirisan_api_url: ["api.kirisan.com"],
  fonnte_api_url: ["api.fonnte.com"],
  turnstile_verify_url: ["challenges.cloudflare.com"],
  sumopod_base_url: ["api-pay.sumopod.com", "api-pay-sandbox.sumopod.com", "api.sumopod.com"],
  duitku_base_url: ["passport.duitku.com", "sandbox.duitku.com"],
};

// Server-fetched URL fields: these MUST pass the full check (https + non-private
// + host allowlist). Anything the server sends an outbound request to belongs here.
const SERVER_FETCH_URL_FIELDS = new Set([
  "kirisan_api_url",
  "fonnte_api_url",
  "turnstile_verify_url",
  "sumopod_base_url",
  "duitku_base_url",
]);

export function validateSettingUrl(key: string, value: string) {
  const allowed = URL_FIELD_ALLOWED_HOSTS[key];
  const isServerFetched = SERVER_FETCH_URL_FIELDS.has(key);
  // Only validate fields that are (a) server-fetched URLs, or (b) otherwise
  // URL-shaped. Non-URL fields pass straight through.
  if (!isServerFetched && !key.endsWith("_url") && !key.endsWith("_endpoint") && !allowed) return;
  if (!value || value.trim() === "") return; // allow empty optional URL fields
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AppError(`URL tidak valid untuk pengaturan "${key}"`, 400);
  }
  const hostname = parsed.hostname.toLowerCase();
  const isPrivateHost = hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname === "0.0.0.0"
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    || /^169\.254\./.test(hostname);
  if (parsed.protocol !== "https:") {
    throw new AppError(`Pengaturan "${key}" harus menggunakan https://`, 400);
  }
  if (parsed.username || parsed.password || isPrivateHost) {
    throw new AppError(`Host "${parsed.hostname}" tidak diizinkan untuk pengaturan "${key}"`, 400);
  }
  if (allowed && !allowed.includes(hostname)) {
    throw new AppError(`Host "${parsed.hostname}" tidak diizinkan untuk pengaturan "${key}"`, 400);
  }
  // Fail closed: a server-fetched URL without an allowlist entry is a config bug
  // — reject rather than let it through on https-only.
  if (isServerFetched && !allowed) {
    throw new AppError(`Pengaturan "${key}" tidak memiliki daftar host yang diizinkan`, 500);
  }
}

export async function updateSystemSettings(data: Record<string, any>): Promise<Record<string, string>> {
  await ensureSettingsTableExists();
  const { clearCredsCache } = await import("../../lib/reseller-creds");
  const { encryptApiKey } = await import("../../lib/encryption");

  let updatedResellerId = "";
  let updatedResellerApiKey = "";

  const allowedKeys = new Set(Object.keys(DEFAULT_SETTINGS));

  for (const [key, value] of Object.entries(data)) {
    if (!allowedKeys.has(key)) {
      throw new AppError(`Pengaturan "${key}" tidak dikenal`, 400);
    }
    const stringVal = typeof value === "boolean" ? (value ? "true" : "false") : String(value ?? "");

    // Do not overwrite existing secret values with masked placeholders
    if (stringVal.includes("••••") || stringVal.includes("****")) {
      continue;
    }

    validateSettingUrl(key, stringVal);
    const storedValue = await encodeSettingValue(key, stringVal);

    if (key === "reseller_id" && stringVal.trim()) {
      updatedResellerId = stringVal.trim();
    }
    if ((key === "reseller_api_key" || key === "liquid_api_key") && stringVal.trim()) {
      updatedResellerApiKey = stringVal.trim();
    }

    // Use atomic upsert to prevent race conditions between concurrent admin updates
    await db.insert(appSettings).values({
      key,
      value: storedValue,
      category: getCategoryForKey(key),
    }).onDuplicateKeyUpdate({
      set: { value: storedValue }
    });
  }

  // If reseller credentials were updated, sync to primary reseller user in users table & invalidate cache
  if (updatedResellerId || updatedResellerApiKey) {
    clearCredsCache();
    try {
      const [master] = await db.select().from(users).where(sql`${users.role} = 'admin'`).limit(1);
      if (master) {
        const updatePayload: Record<string, any> = {};
        if (updatedResellerId) updatePayload.resellerId = updatedResellerId;
        if (updatedResellerApiKey) {
          updatePayload.apiKeyEncrypted = await encryptApiKey(updatedResellerApiKey);
          updatePayload.apiKey = null; // Remove plaintext
        }
        await db.update(users).set(updatePayload).where(eq(users.id, master.id));
      }
    } catch (e) {
      console.warn("[updateSystemSettings] Syncing updated credentials to master user failed:", e);
    }
  }

  return getSystemSettings();
}

function getCategoryForKey(key: string): string {
  if (key.startsWith("kirisan_") || key.startsWith("smtp_") || key === "email_provider") return "email";
  if (key.startsWith("sumopod_")) return "sumopod";
  if (key.startsWith("fonnte_")) return "fonnte";
  if (key.startsWith("s3_")) return "s3";
  if (key.includes("color") || key.includes("theme")) return "theme";
  if (key.startsWith("seo_") || key.startsWith("brand_") || key.startsWith("site_") || key === "og_image_url") return "brand_seo";
  if (key.startsWith("turnstile_")) return "security";
  if (key.startsWith("tax_")) return "tax";
  if (key.startsWith("reseller_") || key.startsWith("liquid_")) return "reseller";
  return "general";
}

function unmaskIfNecessary(providedVal?: string, dbVal?: string): string {
  if (!providedVal) return dbVal || "";
  if (providedVal.includes("•") || providedVal.includes("****")) {
    return dbVal || "";
  }
  return providedVal;
}

export async function testKirisanConnection(payload: {
  kirisan_token?: string;
  kirisan_channel_key?: string;
  kirisan_template_id?: string;
  recipient_email: string;
}) {
  const settings = await getSystemSettings();
  const token = unmaskIfNecessary(payload.kirisan_token, settings.kirisan_token);
  const channelKey = unmaskIfNecessary(payload.kirisan_channel_key, settings.kirisan_channel_key);
  const templateId = payload.kirisan_template_id || settings.kirisan_template_id || settings.kirisan_login_otp_template_id;
  const apiUrl = settings.kirisan_api_url || env.KIRISAN_API_URL;

  if (!token || !channelKey) {
    throw new Error("Kirisan Token dan Channel Key wajib diisi untuk melakukan pengujian.");
  }

  const reqBody = {
    keys: {
      email: {
        token: channelKey,
      },
    },
    target: {
      email: payload.recipient_email,
      variables: {
        otp: "123456",
        code: "123456",
        purpose: "test",
        expiry_minutes: 10,
      },
    },
    content: {
      email: {
        template: Number(templateId) || 1,
      },
    },
  };

  const res = await fetch(`${apiUrl}/send`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(reqBody),
  });

  const json: any = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.message || json?.error || `Kirisan API mengembalikan HTTP status ${res.status}`);
  }

  return {
    success: true,
    message: `Koneksi Kirisan API Berhasil! Email pengujian dikirim ke ${payload.recipient_email}`,
    data: json,
  };
}

export async function testEmailConnection(payload: {
  provider?: "kirisan" | "smtp" | "brevo_api";
  recipient_email: string;
  kirisan_token?: string;
  kirisan_channel_key?: string;
  kirisan_template_id?: string;
  brevo_api_key?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from_email?: string;
  smtp_from_name?: string;
}) {
  const settings = await getSystemSettings();
  const provider = payload.provider || settings.email_provider || "kirisan";

  if (provider === "kirisan") {
    return testKirisanConnection(payload);
  }

  // Brevo API / SMTP Relay: unmask if frontend passed masked string ('xsmt••••odZV')
  const rawApiKey = payload.brevo_api_key || payload.smtp_pass;
  const apiKey = unmaskIfNecessary(rawApiKey, settings.brevo_api_key || settings.smtp_pass);
  const fromEmail = payload.smtp_from_email || settings.smtp_from_email || "noreply@ekstensi.id";
  const fromName = payload.smtp_from_name || settings.smtp_from_name || settings.brand_name || "Ekstensi.id Support";

  if (!apiKey || apiKey.includes("•")) {
    throw new Error("Brevo API Key / SMTP Password belum diisi atau masih ter-mask. Masukkan Kunci API Brevo di Settings dan klik Simpan terlebih dahulu.");
  }

  const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "accept": "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: payload.recipient_email }],
      subject: `[Test Email] Pengujian Koneksi Brevo - ${settings.brand_name || "Ekstensi.id"}`,
      htmlContent: `
        <div style="font-family: sans-serif; padding: 24px; background: #f9fafb; color: #111827;">
          <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb;">
            <h2 style="margin-top: 0; color: #111827;">Pengujian Brevo API Berhasil!</h2>
            <p>Halo,</p>
            <p>Ini adalah email pengujian untuk mengonfirmasi bahwa pengiriman email transaksional via <strong>Brevo API / SMTP Relay</strong> di platform Anda telah berfungsi dengan sempurna.</p>
            <div style="background: #f3f4f6; padding: 12px 16px; border-radius: 8px; font-family: monospace; font-size: 12px; margin: 16px 0;">
              Sender: ${fromName} &lt;${fromEmail}&gt;<br/>
              Recipient: ${payload.recipient_email}<br/>
              Status: 200 OK (Brevo REST API)
            </div>
            <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">Email ini dikirim secara otomatis dari halaman Settings Dashboard.</p>
          </div>
        </div>
      `,
    }),
  });

  const json: any = await brevoRes.json().catch(() => null);

  if (!brevoRes.ok) {
    if (brevoRes.status === 401 && apiKey.startsWith("xsmtp")) {
      throw new Error("Gagal otentikasi Brevo API. Kunci yang Anda masukkan ('xsmtp...') adalah SMTP Password. Silakan gunakan Brevo API Key berawalan 'xkeysib-...' dari Dashboard Brevo > SMTP & API > API Keys.");
    }
    throw new Error(json?.message || json?.error || `Brevo API mengembalikan HTTP status ${brevoRes.status}`);
  }

  return {
    success: true,
    message: `Koneksi Brevo API Berhasil! Email pengujian dikirim ke ${payload.recipient_email}`,
    data: json,
  };
}

export async function testLiquidConnection(resellerId?: string, apiKey?: string) {
  let rId = resellerId;
  let key = apiKey;

  if (!rId || !key) {
    const { resolveResellerCreds } = await import("../../lib/reseller-creds");
    const [reseller] = await db.select().from(users).where(sql`${users.role} = 'admin'`).limit(1);
    if (reseller) {
      const creds = await resolveResellerCreds(reseller.id);
      rId = creds.resellerId;
      key = creds.apiKey;
    }
  }

  if (!rId || !key) {
    throw new Error("Reseller ID dan API Key Resellercamp belum dikonfigurasi.");
  }

  const { LiquidClient } = await import("../../lib/liquid");
  const liquid = new LiquidClient(rId, key);
  const balance = await liquid.getBalance();
  return {
    success: true,
    message: "Koneksi Resellercamp Liquid API Berhasil!",
    resellerId: rId,
    balance,
  };
}

/** Uji koneksi Duitku: getpaymentmethod dengan amount kecil.
 *  Kredensial dari payload (frontend mengirim yang baru diketik) dengan
 *  fallback ke settings tersimpan. */
export async function testDuitkuConnection(payload?: {
  merchant_code?: string;
  api_key?: string;
  environment?: string;
}) {
  const settings = await getSystemSettings();
  const merchantCode = String(payload?.merchant_code || settings.duitku_merchant_code || "").trim();
  const apiKey = String(payload?.api_key || settings.duitku_api_key || "").trim();
  const envSel = String(payload?.environment || "sandbox").trim();

  if (!merchantCode || !apiKey) {
    throw new AppError("Merchant Code dan API Key Duitku wajib diisi.", 400);
  }

  const baseUrl = envSel === "production"
    ? "https://passport.duitku.com"
    : "https://sandbox.duitku.com";

  // Panggil getpaymentmethod amount minimum (Rp 10.000) langsung dengan kredensial uji
  const { hmacSha256Hex } = await import("../../lib/duitku");
  const datetime = formatDuitkuDatetimeNow();
  const signature = hmacSha256Hex(`${merchantCode}10000${datetime}`, apiKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${baseUrl}/webapi/api/merchant/paymentmethod/getpaymentmethod`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantcode: merchantCode,
        amount: 10000,
        datetime,
        signature,
      }),
      signal: controller.signal,
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok || !json || json.responseCode !== "00") {
      const msg = json?.responseMessage || `HTTP ${res.status}`;
      throw new AppError(`Koneksi Duitku gagal: ${msg}`, 400);
    }
    return {
      success: true,
      message: "Koneksi Duitku berhasil!",
      merchantCode,
      environment: envSel,
      channelCount: Array.isArray(json.paymentFee) ? json.paymentFee.length : 0,
    };
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    if (err?.name === "AbortError") throw new AppError("Timeout koneksi ke Duitku", 504);
    throw new AppError(`Koneksi Duitku gagal: ${err?.message || err}`, 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatDuitkuDatetimeNow(): string {
  const now = new Date();
  const jakarta = new Date(now.getTime() + 7 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${jakarta.getUTCFullYear()}-${pad(jakarta.getUTCMonth() + 1)}-${pad(jakarta.getUTCDate())} ` +
    `${pad(jakarta.getUTCHours())}:${pad(jakarta.getUTCMinutes())}:${pad(jakarta.getUTCSeconds())}`;
}

/** Sinkronkan channel pembayaran Duitku → app_settings.duitku_channels.
 *  Channel baru dari Duitku otomatis enabled di posisi terakhir; urutan & status
 *  toggle channel lama dipertahankan; channel yang hilang dari Duitku ditandai stale. */
export async function syncDuitkuChannels() {
  const { DuitkuClient } = await import("../../lib/duitku");
  const client = new DuitkuClient();
  // amount 10.000 (min) cukup untuk menarik daftar channel aktif + fee
  const live = await client.getPaymentMethods(10000);

  const settings = await getSystemSettings();
  let prev: Array<any> = [];
  try {
    const parsed: any = settings.duitku_channels ? JSON.parse(settings.duitku_channels) : [];
    prev = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.channels) ? parsed.channels : []);
  } catch {
    prev = [];
  }
  const prevByCode = new Map<string, any>();
  for (const c of prev) prevByCode.set(String(c.code), c);

  const merged = live.map((ch, idx) => {
    const old = prevByCode.get(ch.paymentMethod);
    const feeNum = Number(ch.totalFee || "0");
    return {
      code: ch.paymentMethod,
      name: ch.paymentName,
      image: ch.paymentImage,
      fee_flat: feeNum,
      fee_percent: 0, // Duitku v2 mengirim fee flat per channel pada getpaymentmethod
      enabled: old ? old.enabled !== false : true,
      stale: false,
      order: old?.order ?? idx + 1,
    };
  });

  // channel yang ada di setting lama tapi tidak lagi dikembalikan Duitku → stale
  const liveCodes = new Set(live.map((c) => c.paymentMethod));
  let maxOrder = merged.reduce((m, c) => Math.max(m, c.order), 0);
  for (const old of prev) {
    if (!liveCodes.has(String(old.code))) {
      maxOrder += 1;
      merged.push({ ...old, stale: true, order: maxOrder });
    }
  }
  merged.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const payload = JSON.stringify({
    synced_at: new Date().toISOString(),
    channels: merged,
  });
  await db.insert(appSettings).values({
    key: "duitku_channels",
    value: payload,
    category: "payment_gateway",
  }).onDuplicateKeyUpdate({ set: { value: payload } });

  return {
    success: true,
    message: `Sinkronisasi berhasil: ${merged.length} channel (${merged.filter((c) => !c.stale).length} aktif, ${merged.filter((c) => c.stale).length} stale)`,
    channels: merged,
  };
}

/** Simpan urutan & toggle channel (hasil drag-and-drop admin). */
export async function updateDuitkuChannelOrder(channels: Array<{ code: string; enabled?: boolean; order?: number }>) {
  const settings = await getSystemSettings();
  let current: any = { synced_at: "", channels: [] };
  try {
    current = settings.duitku_channels ? JSON.parse(settings.duitku_channels) : current;
  } catch {}
  const list: Array<any> = Array.isArray(current.channels) ? current.channels : [];
  const byCode = new Map(list.map((c: any) => [String(c.code), c]));

  for (const ch of channels) {
    const row = byCode.get(String(ch.code));
    if (!row) continue;
    if (typeof ch.enabled === "boolean") row.enabled = ch.enabled;
    if (typeof ch.order === "number") row.order = ch.order;
  }
  list.sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999));

  const payload = JSON.stringify({ ...current, channels: list });
  await db.insert(appSettings).values({
    key: "duitku_channels",
    value: payload,
    category: "payment_gateway",
  }).onDuplicateKeyUpdate({ set: { value: payload } });

  return { success: true, message: "Urutan channel disimpan", channels: list };
}

/** Helper: baca channel aktif (enabled, non-stale) untuk checkout, urut sesuai admin. */
export async function getActiveDuitkuChannels(): Promise<Array<any>> {
  const settings = await getSystemSettings();
  if (!settings.duitku_channels) return [];
  try {
    const parsed = JSON.parse(settings.duitku_channels);
    const list: Array<any> = Array.isArray(parsed?.channels) ? parsed.channels : [];
    return list
      .filter((c: any) => c.enabled !== false && !c.stale)
      .sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999));
  } catch {
    return [];
  }
}
