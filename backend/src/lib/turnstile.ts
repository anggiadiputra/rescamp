import { db } from "../db";
import { appSettings } from "../db/schema";
import { eq } from "drizzle-orm";
import { AppError } from "./error";
import { env } from "../config/env";

export async function verifyTurnstileToken(token?: string, remoteip?: string): Promise<boolean> {
  // Retrieve settings
  const settingsRows = await db.select().from(appSettings);
  const settings: Record<string, string> = {};
  for (const row of settingsRows) {
    if (row.key && row.value) settings[row.key] = row.value;
  }

  const isEnabled = settings.turnstile_enabled === "true";
  const secretKey = settings.turnstile_secret_key?.trim();
  const verifyUrl = settings.turnstile_verify_url || env.TURNSTILE_VERIFY_URL;

  // If Turnstile is not enabled or secret key is missing, bypass verification
  if (!isEnabled || !secretKey) {
    return true;
  }

  if (!token || !token.trim()) {
    throw new AppError("Verifikasi keamanan (Turnstile) wajib diisi", 400);
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteip) formData.append("remoteip", remoteip);

    const res = await fetch(verifyUrl, {
      method: "POST",
      body: formData,
    });

    const data: any = await res.json();
    if (!data?.success) {
      console.warn("[Turnstile] Siteverify failed:", data?.["error-codes"]);
      throw new AppError("Verifikasi Turnstile gagal. Silakan coba lagi.", 400);
    }

    return true;
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    console.error("[Turnstile] Verification request error:", err);
    throw new AppError("Gagal menghubungkan ke server verifikasi Turnstile", 500);
  }
}
