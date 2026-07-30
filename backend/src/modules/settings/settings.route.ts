import { Elysia } from "elysia";
import { getSystemSettings, updateSystemSettings, testKirisanConnection, testLiquidConnection } from "./settings.service";
import { AppError } from "../../lib/error";
import { authGuard, resellerGuard } from "../../middleware/auth";

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

// Endpoint PUBLIK — hanya field aman, tanpa auth
async function handleGetPublicSettings() {
  const all = await getSystemSettings();
  const pub: Record<string, string> = {};
  for (const key of PUBLIC_SETTINGS_FIELDS) {
    if (key in all) pub[key] = all[key] ?? "";
  }
  return { data: pub };
}

// Endpoint ADMIN — semua field, wajib auth
async function handleGetSettings() {
  const settings = await getSystemSettings();
  return { data: settings };
}

async function handlePutSettings({ body }: any) {
  if (!body || typeof body !== "object") {
    throw new AppError("Data pengaturan tidak valid", 400);
  }
  const updated = await updateSystemSettings(body);
  return { success: true, message: "Pengaturan berhasil disimpan", data: updated };
}

async function handleTestKirisan({ body }: any) {
  if (!body || !body.recipient_email) {
    throw new AppError("Email penerima (recipient_email) wajib diisi", 400);
  }
  const res = await testKirisanConnection(body);
  return res;
}

async function handleTestLiquid() {
  const res = await testLiquidConnection();
  return res;
}

export const settingsRoutes = new Elysia({ prefix: "/settings" })
  // Endpoint publik — tidak butuh login
  .get("/public", handleGetPublicSettings as any)
  // Semua endpoint lain wajib auth reseller
  .guard({ beforeHandle: [authGuard, resellerGuard] }, (app) =>
    app
      .get("/", handleGetSettings as any)
      .get("", handleGetSettings as any)
      .put("/", handlePutSettings as any)
      .put("", handlePutSettings as any)
      .post("/test-kirisan", handleTestKirisan as any)
      .get("/test-liquid", handleTestLiquid as any)
  );

