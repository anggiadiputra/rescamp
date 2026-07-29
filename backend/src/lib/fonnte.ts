import { db } from "../db";
import { appSettings } from "../db/schema";

async function getFonnteToken(): Promise<string> {
  const rows = await db.select().from(appSettings);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value || "";
  return map.fonnte_token || "";
}

export async function checkWhatsApp(phone: string): Promise<{ registered: boolean }> {
  const token = await getFonnteToken();
  if (!token) {
    console.warn("[fonnte] Token not configured, skipping WA check");
    return { registered: false };
  }

  // Normalize: remove +, spaces, dashes; ensure starts with country code
  let normalized = phone.replace(/[+\s\-\(\)]/g, "");
  if (normalized.startsWith("0")) normalized = "62" + normalized.slice(1);
  if (!normalized.startsWith("62")) normalized = "62" + normalized;

  try {
    const res = await fetch("https://api.fonnte.com/device", {
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
