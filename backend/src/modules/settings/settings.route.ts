import { Elysia } from "elysia";
import { getSystemSettings, updateSystemSettings, testKirisanConnection, testEmailConnection, testLiquidConnection } from "./settings.service";
import { AppError } from "../../lib/error";
import { authGuard, resellerGuard } from "../../middleware/auth";
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
  // Semua endpoint lain wajib auth reseller + rate limit
  .guard({ beforeHandle: [authGuard, resellerGuard, rateLimit(settingsRateLimiter, "Terlalu banyak permintaan pengaturan.")] }, (app) =>
    app
      .get("/", handleGetSettings as any)
      .get("", handleGetSettings as any)
      .put("/", handlePutSettings as any)
      .put("", handlePutSettings as any)
      .post("/test-kirisan", handleTestKirisan as any)
      .post("/test-email", handleTestEmail as any)
      .get("/test-liquid", handleTestLiquid as any)
      .post("/test-liquid", handleTestLiquid as any)
  );
