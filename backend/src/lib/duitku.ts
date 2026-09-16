/**
 * Duitku Payment Gateway Adapter (API v2.0)
 *
 * Referensi: duitku.md di root proyek (dokumentasi resmi Duitku v2.0).
 * - Inquiry:       POST /webapi/api/merchant/v2/inquiry         (JSON)
 * - Callback:      POST dari Duitku, x-www-form-urlencoded
 * - CheckStatus:   POST /webapi/api/merchant/transactionStatus  (JSON)
 * - PaymentMethod: POST /webapi/api/merchant/paymentmethod/getpaymentmethod (JSON)
 *
 * Signature: HMAC-SHA256 hex lowercase. Formula per operasi:
 * - Inquiry:        merchantCode + merchantOrderId + paymentAmount
 * - Callback verif: merchantCode + amount + merchantOrderId
 * - CheckStatus:    merchantCode + merchantOrderId
 * - PaymentMethod:  merchantCode + amount + datetime
 *
 * Kredensial: app_settings (duitku_*) dengan fallback env DUITKU_*.
 * Secret di app_settings tersimpan terenkripsi via encodeSettingValue().
 */

import crypto from "node:crypto";
import { AppError } from "./error";
import { env } from "../config/env";

const INQUIRY_PATH = "/webapi/api/merchant/v2/inquiry";
const STATUS_PATH = "/webapi/api/merchant/transactionStatus";
const PMETHOD_PATH = "/webapi/api/merchant/paymentmethod/getpaymentmethod";

const DEFAULT_TIMEOUT_MS = 30000;

// ── Kredensial ────────────────────────────────────────────────────────────

export interface DuitkuConfig {
  merchantCode: string;
  apiKey: string;
  baseUrl: string; // https://passport.duitku.com | https://sandbox.duitku.com
}

/** Baca kredensial dari app_settings (duitku_merchant_code / duitku_api_key /
 *  duitku_base_url) dengan fallback env DUITKU_*. Secret di DB sudah didekripsi
 *  oleh getSystemSettings (decodeSettingValue). */
export async function getDuitkuConfig(): Promise<DuitkuConfig> {
  let merchantCode = "";
  let apiKey = "";
  let baseUrl = "";
  let environment = "";

  try {
    const { getSystemSettings } = await import("../modules/settings/settings.service");
    const settings = await getSystemSettings();
    merchantCode = String(settings.duitku_merchant_code || "").trim();
    apiKey = String(settings.duitku_api_key || "").trim();
    baseUrl = String(settings.duitku_base_url || "").trim();
    environment = String(settings.duitku_environment || "").trim();
  } catch {
    // fall through to env
  }

  if (!merchantCode) merchantCode = (env.DUITKU_MERCHANT_CODE || "").trim();
  if (!apiKey) apiKey = (env.DUITKU_API_KEY || "").trim();
  if (!baseUrl) baseUrl = (env.DUITKU_BASE_URL || "").trim();
  if (!environment) environment = (env.DUITKU_ENV || "sandbox").trim();

  if (!merchantCode || !apiKey) {
    throw new AppError(
      "Duitku belum dikonfigurasi. Isi Merchant Code & API Key di halaman Settings (Payment Gateways).",
      400,
    );
  }

  const defaultBase = environment === "production"
    ? "https://passport.duitku.com"
    : "https://sandbox.duitku.com";
  return {
    merchantCode,
    apiKey,
    baseUrl: (baseUrl || defaultBase).replace(/\/$/, ""),
  };
}

/** Cek ketersediaan konfigurasi tanpa throw (untuk health/registry) */
export async function isDuitkuConfigured(): Promise<boolean> {
  try {
    await getDuitkuConfig();
    return true;
  } catch {
    return false;
  }
}

// ── Signature helpers ────────────────────────────────────────────────────

export function hmacSha256Hex(data: string, key: string): string {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

/** Verifikasi callback: merchantCode + amount + merchantOrderId (timing-safe) */
export function verifyCallbackSignature(params: {
  merchantCode: string;
  amount: string | number;
  merchantOrderId: string;
  signature: string;
  apiKey: string;
}): boolean {
  const expected = hmacSha256Hex(
    `${params.merchantCode}${params.amount}${params.merchantOrderId}`,
    params.apiKey,
  );
  const got = String(params.signature || "").toLowerCase().trim();
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── HTTP core ─────────────────────────────────────────────────────────────

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const msg = parsed?.Message || parsed?.statusMessage || text?.slice(0, 200) || `HTTP ${res.status}`;
      throw new AppError(`Duitku API Error (${res.status}): ${msg}`, 502);
    }
    return parsed as T;
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    if (err?.name === "AbortError") throw new AppError("Duitku API request timeout", 504);
    throw new AppError(`Duitku API Error: ${err?.message || err}`, 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatDuitkuDatetime(d = new Date()): string {
  // Duitku expects "yyyy-MM-dd HH:mm:ss" in WIB (UTC+7)
  const jakarta = new Date(d.getTime() + 7 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${jakarta.getUTCFullYear()}-${pad(jakarta.getUTCMonth() + 1)}-${pad(jakarta.getUTCDate())} ` +
    `${pad(jakarta.getUTCHours())}:${pad(jakarta.getUTCMinutes())}:${pad(jakarta.getUTCSeconds())}`;
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface DuitkuInquiryParams {
  orderId: string; // merchantOrderId (max 50 chars)
  amount: number; // IDR bulat, min 10000
  paymentMethod: string; // kode channel: BC, SP, IR, ...
  productDetails: string;
  email: string;
  customerVaName: string; // max 20 chars
  callbackUrl: string;
  returnUrl: string;
  expiryPeriod?: number; // menit
  phoneNumber?: string;
  itemDetails?: Array<{ name: string; price: number; quantity: number }>;
}

export interface DuitkuInquiryResult {
  reference: string;
  paymentUrl: string;
  vaNumber: string;
  qrString: string;
  appUrl: string;
  amount: number;
  statusCode: string;
  statusMessage: string;
}

export interface DuitkuPaymentMethod {
  paymentMethod: string;
  paymentName: string;
  paymentImage: string;
  totalFee: string;
}

// ── Client ────────────────────────────────────────────────────────────────

export class DuitkuClient {
  /** Inquiry — buat transaksi baru (VA/QRIS/redirect). */
  async inquiry(params: DuitkuInquiryParams): Promise<DuitkuInquiryResult> {
    const cfg = await getDuitkuConfig();
    const amount = Math.round(params.amount);
    const signature = hmacSha256Hex(`${cfg.merchantCode}${params.orderId}${amount}`, cfg.apiKey);

    // itemDetails default: 1 item dengan total = paymentAmount (aturan Duitku)
    const itemDetails = params.itemDetails && params.itemDetails.length > 0
      ? params.itemDetails
      : [{ name: params.productDetails.slice(0, 120), price: amount, quantity: 1 }];

    const payload = {
      merchantCode: cfg.merchantCode,
      paymentAmount: amount,
      paymentMethod: params.paymentMethod,
      merchantOrderId: params.orderId.slice(0, 50),
      productDetails: params.productDetails.slice(0, 255),
      customerVaName: params.customerVaName.slice(0, 20),
      email: params.email,
      callbackUrl: params.callbackUrl,
      returnUrl: params.returnUrl,
      signature,
      expiryPeriod: params.expiryPeriod || 60,
      itemDetails,
      ...(params.phoneNumber ? { phoneNumber: params.phoneNumber } : {}),
    };

    const data = await postJson<any>(`${cfg.baseUrl}${INQUIRY_PATH}`, payload);

    if (!data || data.statusCode !== "00") {
      throw new AppError(
        `Duitku inquiry gagal: ${data?.statusMessage || "response tidak valid"}`,
        502,
      );
    }

    return {
      reference: String(data.reference || ""),
      paymentUrl: String(data.paymentUrl || ""),
      vaNumber: String(data.vaNumber || ""),
      qrString: String(data.qrString || ""),
      appUrl: String(data.appUrl || ""),
      amount,
      statusCode: String(data.statusCode),
      statusMessage: String(data.statusMessage || ""),
    };
  }

  /** transactionStatus — rekonsiliasi / polling manual. */
  async checkStatus(orderId: string): Promise<{ statusCode: string; statusMessage: string; reference: string; amount: number }> {
    const cfg = await getDuitkuConfig();
    const signature = hmacSha256Hex(`${cfg.merchantCode}${orderId}`, cfg.apiKey);
    const data = await postJson<any>(`${cfg.baseUrl}${STATUS_PATH}`, {
      merchantCode: cfg.merchantCode,
      merchantOrderId: orderId.slice(0, 50),
      signature,
    });
    return {
      statusCode: String(data?.statusCode ?? ""),
      statusMessage: String(data?.statusMessage ?? ""),
      reference: String(data?.reference || ""),
      amount: Number(data?.amount || 0),
    };
  }

  /** getpaymentmethod — channel aktif + fee (dipakai admin: Uji Koneksi & Sinkronkan). */
  async getPaymentMethods(amount: number): Promise<DuitkuPaymentMethod[]> {
    const cfg = await getDuitkuConfig();
    const rounded = Math.round(amount);
    const datetime = formatDuitkuDatetime();
    const signature = hmacSha256Hex(`${cfg.merchantCode}${rounded}${datetime}`, cfg.apiKey);
    const data = await postJson<any>(`${cfg.baseUrl}${PMETHOD_PATH}`, {
      merchantcode: cfg.merchantCode,
      amount: rounded,
      datetime,
      signature,
    });
    if (!data || data.responseCode !== "00") {
      throw new AppError(
        `Duitku getpaymentmethod gagal: ${data?.responseMessage || "response tidak valid"}`,
        502,
      );
    }
    const list = Array.isArray(data.paymentFee) ? data.paymentFee : [];
    return list.map((p: any) => ({
      paymentMethod: String(p.paymentMethod || ""),
      paymentName: String(p.paymentName || ""),
      paymentImage: String(p.paymentImage || ""),
      totalFee: String(p.totalFee || "0"),
    }));
  }
}

/**
 * Verifikasi callback Duitku (baca apiKey dari config, timing-safe).
 * Memvalidasi: signature cocok AND merchantCode milik kita.
 * Pemanggil harus juga memvalidasi amount === tx.amount (aturan duitku.md §12).
 */
export async function verifyDuitkuCallback(params: {
  merchantCode: string;
  amount: string | number;
  merchantOrderId: string;
  signature: string;
}): Promise<boolean> {
  const cfg = await getDuitkuConfig();
  if (String(params.merchantCode || "").trim() !== cfg.merchantCode) return false;
  return verifyCallbackSignature({
    merchantCode: params.merchantCode,
    amount: params.amount,
    merchantOrderId: params.merchantOrderId,
    signature: params.signature,
    apiKey: cfg.apiKey,
  });
}
