import { env } from "../config/env";
import { getSystemSettings } from "../modules/settings/settings.service";

async function getFonnteConfig(): Promise<{ token: string; apiUrl: string }> {
  // Read through the settings service so the ENCRYPTED fonnte_token stored in
  // app_settings (v2:ciphertext) is DECRYPTED before use. Same bug class as the
  // Turnstile/Brevo fixes: reading app_settings directly submits raw ciphertext
  // as the provider credential, which the provider always rejects.
  const settings = await getSystemSettings();
  return {
    token: settings.fonnte_token?.trim() || "",
    apiUrl: settings.fonnte_api_url || env.FONNTE_API_URL,
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
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_token: normalized }),
    });

    const data: any = await res.json();
    // Fonnte device endpoint returns device status; if status is true, number is on WA
    return { registered: data?.status === true || data?.registered === true };
  } catch (e) {
    console.error("[fonnte] check failed:", e);
    return { registered: false };
  }
}
