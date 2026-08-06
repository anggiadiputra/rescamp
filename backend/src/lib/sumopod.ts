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
  if (!baseUrl) baseUrl = env.SUMOPOD_PAYMENT_URL;

  console.log(`[sumopod config] apiKey source=${apiKeySource} length=${apiKey.length} prefix=${apiKey.slice(0, 8)}…`);

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

    try {
      const response = await fetch(`${cfg.baseUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": cfg.apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Sumopod Payment Creation Error:", response.status, errorText);
        throw new AppError(`Sumopod API Error (${response.status}): ${errorText}`, 502);
      }

      const raw = await response.json() as any;
      const data: SumopodPaymentResponse = {
        payment_id: raw.payment_id || raw.paymentId || "",
        order_id: raw.order_id || raw.orderId || "",
        amount: raw.amount || 0,
        fee: raw.fee || 0,
        net_amount: raw.net_amount || raw.netAmount || 0,
        payment_link_url: raw.payment_link_url || raw.paymentLinkUrl || "",
        status: raw.status || "",
        expires_at: raw.expires_at || raw.expiresAt || "",
      };
      return data;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      if (err.name === "AbortError") {
        console.error("Sumopod Payment Gateway request timed out after 30s");
        throw new AppError("Payment Gateway request timed out. Silakan coba lagi.", 504);
      }
      console.error("Failed to connect to Sumopod Payment Gateway:", err);
      throw new AppError(`Payment Gateway Connection Failed: ${err.message}`, 503);
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
    if (!cfg.webhookToken) {
      // If no token is configured (DB nor env), permit in sandbox/development mode
      return true;
    }
    return receivedToken === cfg.webhookToken;
  }
}

export const sumopodClient = new SumopodClient();
