import { db } from "../../db";
import { appSettings, users } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { env } from "../../config/env";
import { AppError } from "../../lib/error";

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
};

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
          value,
          category: getCategoryForKey(key),
        }).catch(() => {});
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
        settingsMap[r.key] = r.value;
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
const URL_FIELD_ALLOWED_HOSTS: Record<string, string[]> = {
  kirisan_api_url: ["api.kirisan.com"],
  fonnte_api_url: ["api.fonnte.com"],
  turnstile_verify_url: ["challenges.cloudflare.com"],
  sumopod_base_url: ["api-pay.sumopod.com", "api-pay-sandbox.sumopod.com", "api.sumopod.com"],
};

function validateSettingUrl(key: string, value: string) {
  if (!key.endsWith("_url")) return; // non-URL fields unchecked
  if (!value || value.trim() === "") return; // allow empty optional URL fields
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AppError(`URL tidak valid untuk pengaturan "${key}"`, 400);
  }
  if (parsed.protocol !== "https:") {
    throw new AppError(`Pengaturan "${key}" harus menggunakan https://`, 400);
  }
  const allowed = URL_FIELD_ALLOWED_HOSTS[key];
  if (allowed && !allowed.includes(parsed.hostname)) {
    throw new AppError(`Host "${parsed.hostname}" tidak diizinkan untuk pengaturan "${key}"`, 400);
  }
}

export async function updateSystemSettings(data: Record<string, any>): Promise<Record<string, string>> {
  await ensureSettingsTableExists();
  for (const [key, value] of Object.entries(data)) {
    const stringVal = typeof value === "boolean" ? (value ? "true" : "false") : String(value ?? "");

    validateSettingUrl(key, stringVal);

    const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, key));

    if (existing) {
      await db.update(appSettings).set({ value: stringVal }).where(eq(appSettings.key, key));
    } else {
      await db.insert(appSettings).values({ key, value: stringVal, category: getCategoryForKey(key) });
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
  if (key.startsWith("tax_")) return "tax";
  return "general";
}

export async function testKirisanConnection(payload: {
  kirisan_token?: string;
  kirisan_channel_key?: string;
  kirisan_template_id?: string;
  recipient_email: string;
}) {
  const settings = await getSystemSettings();
  const token = payload.kirisan_token || settings.kirisan_token;
  const channelKey = payload.kirisan_channel_key || settings.kirisan_channel_key;
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

export async function testLiquidConnection(resellerId?: string, apiKey?: string) {
  let rId = resellerId;
  let key = apiKey;

  if (!rId || !key) {
    const { resolveResellerCreds } = await import("../../lib/reseller-creds");
    const [reseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
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
