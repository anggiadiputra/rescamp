import { db } from "../db";
import { appSettings } from "../db/schema";
import { env } from "../config/env";

async function getFonnteConfig(): Promise<{ token: string; apiUrl: string }> {
  const rows = await db.select().from(appSettings);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value || "";
  return {
    token: map.fonnte_token || "",
    apiUrl: map.fonnte_api_url || env.FONNTE_API_URL,
  };
}

export async function checkWhatsApp(phone: string): Promise<{ registered: boolean }> {
  const { token, apiUrl } = await getFonnteConfig();
  if (!token) {
    console.warn("[fonnte] Token not configured, skipping WA check");
    return { registered: false };
  }

  // Normalize: remove +, spaces, dashes; ensure starts with country code
  let normalized = phone.replace(/[+\s\-\(\)]/g, "");
  if (normalized.startsWith("0")) normalized = "62" + normalized.slice(1);
  if (!normalized.startsWith("62")) normalized = "62" + normalized;

  try {
    const res = await fetch(`${apiUrl}/device`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_token: normalized }),
    });

    const data = await res.json();
    // Fonnte device endpoint returns device status; if status is true, number is on WA
    return { registered: data.status === true || data.registered === true };
  } catch (e) {
    console.error("[fonnte] check failed:", e);
    return { registered: false };
  }
}
