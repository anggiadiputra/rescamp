import crypto from "crypto";
import { env } from "../config/env";
import { AppError } from "./error";

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
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = env.SUMOPOD_PAYMENT_URL.replace(/\/$/, "");
    this.apiKey = env.SUMOPOD_API_KEY;
  }

  /**
   * Create payment link via Sumopod API
   */
  async createPayment(options: CreatePaymentOptions): Promise<SumopodPaymentResponse> {
    // Return URLs MUST point to frontend dashboard (CORS_ORIGIN e.g. https://dash.ekstensi.id), not backend API (APP_URL)
    let frontendUrl = (env.CORS_ORIGIN || "https://dash.ekstensi.id").trim().replace(/\/$/, "");
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

    try {
      const response = await fetch(`${this.baseUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Sumopod Payment Creation Error:", response.status, errorText);
        throw new AppError(`Sumopod API Error (${response.status}): ${errorText}`, 502);
      }

      const data = await response.json() as SumopodPaymentResponse;
      return data;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      console.error("Failed to connect to Sumopod Payment Gateway:", err);
      throw new AppError(`Payment Gateway Connection Failed: ${err.message}`, 503);
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
   * Verifies simple webhook token header
   */
  verifyWebhookToken(receivedToken: string | undefined): boolean {
    if (!env.SUMOPOD_WEBHOOK_TOKEN) {
      // If no token is configured in env, permit in sandbox/development mode
      return true;
    }
    return receivedToken === env.SUMOPOD_WEBHOOK_TOKEN;
  }
}

export const sumopodClient = new SumopodClient();
