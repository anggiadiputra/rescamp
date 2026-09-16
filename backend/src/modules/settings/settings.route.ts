import { Elysia } from "elysia";
import {
  getSystemSettings, updateSystemSettings,
  testKirisanConnection, testEmailConnection, testLiquidConnection,
  testDuitkuConnection, syncDuitkuChannels, updateDuitkuChannelOrder,
} from "./settings.service";
import { AppError } from "../../lib/error";
import { adminGuard, authGuard } from "../../middleware/auth";
import { settingsRateLimiter, rateLimit } from "../../lib/rate-limit";

// Field yang aman untuk publik (tidak ada secret/API key)
const PUBLIC_SETTINGS_FIELDS = [
  "brand_name",
  "site_tagline",
  "seo_title",
  "seo_description",
  "seo_keywords",
  "og_image_url",
  "primary_color",
  "header_color",
  "sidebar_color",
  "theme_preset",
  "email_provider",
  "turnstile_enabled",
  "turnstile_site_key",
] as const;

// Fields yang berisi secret — di-mask sebelum dikembalikan ke client
const MASKED_SETTINGS_FIELDS = [
  "sumopod_api_key",
  "sumopod_webhook_secret",
  "sumopod_webhook_token",
  "kirisan_token",
  "kirisan_channel_key",
  "fonnte_token",
  "smtp_pass",
  "s3_access_key",
  "s3_secret_key",
  "turnstile_secret_key",
  "reseller_api_key",
  "liquid_api_key",
  "duitku_api_key",
];

function maskSettingsSecrets(settings: Record<string, string>): Record<string, string> {
  const masked = { ...settings };
  for (const field of MASKED_SETTINGS_FIELDS) {
    if (masked[field] && masked[field].length > 0) {
      const val = masked[field];
      masked[field] = val.length > 8
        ? val.slice(0, 4) + "••••" + val.slice(-4)
        : "••••••••";
    }
  }
  return masked;
}

// Endpoint PUBLIK — hanya field aman, tanpa auth
async function handleGetPublicSettings() {
  const all = await getSystemSettings();
  const pub: Record<string, string> = {};
  for (const key of PUBLIC_SETTINGS_FIELDS) {
    if (key in all) pub[key] = all[key] ?? "";
  }
  return { data: pub };
}

// Endpoint ADMIN — semua field (secret di-mask), wajib auth
async function handleGetSettings() {
  const settings = await getSystemSettings();
  return { data: maskSettingsSecrets(settings) };
}

async function handlePutSettings({ body }: any) {
  if (!body || typeof body !== "object") {
    throw new AppError("Data pengaturan tidak valid", 400);
  }
  const updated = await updateSystemSettings(body);
  return { success: true, message: "Pengaturan berhasil disimpan", data: maskSettingsSecrets(updated) };
}

async function handleTestKirisan({ body }: any) {
  if (!body || !body.recipient_email) {
    throw new AppError("Email penerima (recipient_email) wajib diisi", 400);
  }
  const res = await testKirisanConnection(body);
  return res;
}

async function handleTestEmail({ body }: any) {
  if (!body || !body.recipient_email) {
    throw new AppError("Email penerima (recipient_email) wajib diisi", 400);
  }
  const res = await testEmailConnection(body);
  return res;
}

async function handleTestLiquid(ctx: any) {
  const body = ctx?.body || {};
  const rId = body?.reseller_id;
  const key = body?.api_key;
  const res = await testLiquidConnection(rId, key);
  return res;
}

export const settingsRoutes = new Elysia({ prefix: "/settings" })
  // Endpoint publik — tidak butuh login
  .get("/public", handleGetPublicSettings as any)
  // Semua endpoint lain mengelola konfigurasi global dan hanya boleh diakses admin.
  .guard({ beforeHandle: [authGuard, adminGuard, rateLimit(settingsRateLimiter, "Terlalu banyak permintaan pengaturan.")] }, (app) =>
    app
      .get("/", handleGetSettings as any)
      .get("", handleGetSettings as any)
      .put("/", handlePutSettings as any)
      .put("", handlePutSettings as any)
      .post("/test-kirisan", handleTestKirisan as any)
      .post("/test-email", handleTestEmail as any)
      .get("/test-liquid", handleTestLiquid as any)
      .post("/test-liquid", handleTestLiquid as any)
      // ── Duitku payment gateway (admin) ──
      .post("/payment-gateways/duitku/test", handleTestDuitku as any)
      .post("/payment-gateways/duitku/sync-channels", handleSyncDuitkuChannels as any)
      .put("/payment-gateways/duitku/channels", handleUpdateDuitkuChannels as any)
      .get("/payment-gateways/duitku/channels", handleGetDuitkuChannels as any)
  );

// ── Handlers Duitku ──

async function handleTestDuitku({ body }: any) {
  const res = await testDuitkuConnection({
    merchant_code: body?.merchant_code,
    api_key: body?.api_key,
    environment: body?.environment,
  });
  return res;
}

async function handleSyncDuitkuChannels() {
  return await syncDuitkuChannels();
}

async function handleUpdateDuitkuChannels({ body }: any) {
  if (!Array.isArray(body?.channels)) {
    throw new AppError("Body harus berisi { channels: [{ code, enabled?, order? }] }", 400);
  }
  return await updateDuitkuChannelOrder(body.channels);
}

async function handleGetDuitkuChannels() {
  const { getActiveDuitkuChannels, getSystemSettings } = await import("./settings.service");
  const settings = await getSystemSettings();
  let all: Array<any> = [];
  let syncedAt = "";
  try {
    const parsed = settings.duitku_channels ? JSON.parse(settings.duitku_channels) : null;
    all = Array.isArray(parsed?.channels) ? parsed.channels : [];
    syncedAt = String(parsed?.synced_at || "");
  } catch {}
  return {
    data: {
      enabled: settings.duitku_enabled === "true",
      configured: Boolean(settings.duitku_merchant_code && settings.duitku_api_key),
      synced_at: syncedAt,
      channels: all,
      active: await getActiveDuitkuChannels(),
    },
  };
}
