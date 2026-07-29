import { Elysia } from "elysia";
import { getSystemSettings, updateSystemSettings, testKirisanConnection } from "./settings.service";
import { AppError } from "../../lib/error";
import { authGuard } from "../../middleware/auth";

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

export const settingsRoutes = new Elysia({ prefix: "/settings" })
  .get("/", handleGetSettings as any, { beforeHandle: authGuard })
  .get("", handleGetSettings as any, { beforeHandle: authGuard })
  .put("/", handlePutSettings as any, { beforeHandle: authGuard })
  .put("", handlePutSettings as any, { beforeHandle: authGuard })
  .post("/test-kirisan", handleTestKirisan as any, { beforeHandle: authGuard });

