import crypto from "crypto";
import { env } from "../config/env";
import { AppError } from "./error";
import { getSystemSettings } from "../modules/settings/settings.service";

/**
 * Read Sumopod credentials from DB (app_settings) with env fallback.
 * DB values take precedence — env is fallback when DB row missing/empty.
 * ponytail: per-call DB read; if hot path shows up, wrap with TTL cache.
 */
async function getSumopodConfig(): Promise<{ apiKey: string; baseUrl: string; webhookToken: string; webhookSecret: string }> {
  let apiKey = "";
  let apiKeySource: "db" | "env" | "none" = "none";
  let baseUrl = env.SUMOPOD_PAYMENT_URL;
  let webhookToken = "";
  let webhookSecret = "";

  try {
    const settings = await getSystemSettings();
    if (settings.sumopod_api_key) {
      apiKey = String(settings.sumopod_api_key).trim();
      apiKeySource = "db";
    }
    if (settings.sumopod_base_url) baseUrl = settings.sumopod_base_url;
    if (settings.sumopod_webhook_token) webhookToken = settings.sumopod_webhook_token;
    if (settings.sumopod_webhook_secret) webhookSecret = settings.sumopod_webhook_secret;
  } catch (e) {
    // fall through to env defaults
  }

  if (!apiKey) {
    apiKey = (env.SUMOPOD_API_KEY || "").trim();
    if (apiKey) apiKeySource = "env";
  }
  if (!apiKey) {
    throw new AppError("SUMOPOD_API_KEY harus dikonfigurasi di Settings atau .env", 500);
  }
  if (!baseUrl) {
    baseUrl = env.SUMOPOD_PAYMENT_URL || "https://api-pay-sandbox.sumopod.com/api/v1";
  }

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, ""),
    webhookToken,
    webhookSecret: webhookSecret || env.SUMOPOD_WEBHOOK_SECRET || "",
  };
}

export interface CreatePaymentOptions {
  orderId: string;
  amount: number;
  currency?: string;
  expiresInHours?: number;
  successReturnUrl?: string;
  cancelReturnUrl?: string;
  paymentMethodTypeCode?: string;
}

export interface SumopodPaymentResponse {
  payment_id: string;
  order_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  payment_link_url: string;
  status: string;
  expires_at: string;
}

export class SumopodClient {
  /**
   * Create payment link via Sumopod API
   */
  async createPayment(options: CreatePaymentOptions): Promise<SumopodPaymentResponse> {
    const cfg = await getSumopodConfig();
    // Return URLs MUST point to frontend dashboard (CORS_ORIGIN e.g. https://dash.ekstensi.id), not backend API (APP_URL)
    let frontendUrl = env.CORS_ORIGIN.trim().replace(/\/$/, "");
    if (frontendUrl.startsWith("http://")) {
      frontendUrl = frontendUrl.replace(/^http:\/\//, "https://");
    } else if (!frontendUrl.startsWith("https://")) {
      frontendUrl = `https://${frontendUrl}`;
    }

    const payload = {
      order_id: options.orderId,
      amount: Math.round(options.amount),
      currency: options.currency || "IDR",
      expires_in_hours: options.expiresInHours || 24,
      success_return_url: options.successReturnUrl || `${frontendUrl}/billing?status=success&order_id=${options.orderId}`,
      cancel_return_url: options.cancelReturnUrl || `${frontendUrl}/billing?status=cancel&order_id=${options.orderId}`,
      ...(options.paymentMethodTypeCode ? { payment_method_type_code: options.paymentMethodTypeCode } : {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const cleanUrl = cfg.baseUrl.trim().replace(/\/payments$/, "").replace(/\/$/, "");

    try {
      const response = await fetch(`${cleanUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": cfg.apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (response.ok) {
        const raw = await response.json() as any;
        return {
          payment_id: raw.payment_id || raw.paymentId || "",
          order_id: raw.order_id || raw.orderId || "",
          amount: raw.amount || 0,
          fee: raw.fee || 0,
          net_amount: raw.net_amount || raw.netAmount || 0,
          payment_link_url: raw.payment_link_url || raw.paymentLinkUrl || "",
          status: raw.status || "",
          expires_at: raw.expires_at || raw.expiresAt || "",
        };
      } else {
        const lastStatus = response.status;
        const lastErrorText = await response.text();
        const maskedKey = cfg.apiKey.length > 8 ? `${cfg.apiKey.slice(0, 4)}...${cfg.apiKey.slice(-4)}` : "***";
        console.warn(`Sumopod payment attempt (${lastStatus}) failed [URL: ${cleanUrl}/payments, Key: ${maskedKey}]: ${lastErrorText}`);
        throw new AppError(`Sumopod API Error (${lastStatus}): ${lastErrorText || "Unauthorized"}`, 502);
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      if (err.name === "AbortError") throw new AppError("Sumopod API request timeout", 504);
      console.warn(`Sumopod connection attempt failed [URL: ${cleanUrl}]:`, err?.message || err);
      throw new AppError(`Sumopod API Error: ${err?.message || err}`, 502);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Verifies Svix HMAC signature
   */
  verifyWebhookSignature(
    secret: string,
    svixId: string,
    svixTimestamp: string,
    svixSignature: string,
    rawBody: string
  ): boolean {
    try {
      if (!secret || !svixId || !svixTimestamp || !svixSignature) {
        return false;
      }
      const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64");
      const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;

      const expectedSignature = crypto
        .createHmac("sha256", secretBytes)
        .update(signedContent)
        .digest("base64");

      const signatures = svixSignature.split(" ").map((s) => {
        const parts = s.split(",");
        return parts.length > 1 ? parts[1] : parts[0];
      });

      return signatures.includes(expectedSignature);
    } catch (e) {
      console.error("Webhook signature verification failed with error:", e);
      return false;
    }
  }

  /**
   * Fetch payment details by payment_id
   */
  async getPayment(paymentId: string): Promise<any> {
    const cfg = await getSumopodConfig();
    try {
      const response = await fetch(`${cfg.baseUrl}/payments/${paymentId}`, {
        headers: {
          "X-Api-Key": cfg.apiKey,
        },
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.warn("Failed to fetch payment status from Sumopod:", err);
      return null;
    }
  }

  /**
   * Verifies simple webhook token header
   */
  async verifyWebhookToken(receivedToken: string | undefined): Promise<boolean> {
    const cfg = await getSumopodConfig();
    // C2: fail closed — if no token is configured, no token is accepted
    if (!cfg.webhookToken) {
      return false;
    }
    const a = Buffer.from(receivedToken || "");
    const b = Buffer.from(cfg.webhookToken);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}

export const sumopodClient = new SumopodClient();
