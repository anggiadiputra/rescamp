import { env } from "../config/env";
import { getSystemSettings } from "../modules/settings/settings.service";
import { AppError } from "./error";

async function getEmailConfig() {
  // Read through the settings service so encrypted provider credentials are
  // decrypted before they are sent to Kirisan or Brevo.
  const map = await getSystemSettings();

  return {
    provider: (map.email_provider || "kirisan").toLowerCase(),
    brandName: map.brand_name || "Ekstensi.id",
    // Kirisan
    kirisanApiUrl: map.kirisan_api_url || env.KIRISAN_API_URL,
    kirisanToken: map.kirisan_token || "",
    kirisanChannelKey: map.kirisan_channel_key || "",
    kirisanTemplateId: map.kirisan_template_id || "",
    kirisanLoginOtpTemplateId: map.kirisan_login_otp_template_id || map.kirisan_template_id || "",
    kirisanRegisterOtpTemplateId: map.kirisan_register_otp_template_id || map.kirisan_template_id || "",
    kirisanResetPasswordTemplateId: map.kirisan_reset_password_template_id || map.kirisan_template_id || "",
    kirisanRegisterSuccessTemplateId: map.kirisan_register_success_template_id || map.kirisan_template_id || "",
    // SMTP / Brevo
    smtpHost: map.smtp_host || "smtp-relay.brevo.com",
    smtpPort: map.smtp_port || "587",
    smtpUser: map.smtp_user || "",
    smtpPass: map.smtp_pass || "",
    smtpFromEmail: map.smtp_from_email || "noreply@ekstensi.id",
    smtpFromName: map.smtp_from_name || map.brand_name || "Ekstensi.id Support",
    brevoApiKey: map.brevo_api_key || map.smtp_pass || "",
  };
}

function renderEmailHtml(
  type: "login_otp" | "register_otp" | "reset_password" | "register_success" | "order_invoice" | "payment_success" | "payment_failed" | "payment_expired",
  vars: Record<string, any>,
  brandName: string
): string {
  const code = vars.otp || vars.code || vars.otp_code || "";
  const resetUrl = vars.reset_url || vars.link || "#";

  if (type === "login_otp" || type === "register_otp") {
    const actionText = type === "login_otp" ? "masuk ke akun Anda" : "menyelesaikan pendaftaran akun Anda";
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; color: #111827;">
        <h2 style="margin-top: 0; font-size: 20px; font-weight: 700; color: #111827;">Kode OTP Keamanan ${brandName}</h2>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">Gunakan kode OTP di bawah ini untuk ${actionText}. Kode ini berlaku selama 10 menit dan bersifat rahasia.</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #000000;">${code}</span>
        </div>
        <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin-bottom: 0;">Jika Anda tidak merasa melakukan permintaan ini, abaikan pesan email ini.</p>
      </div>
    `;
  }

  if (type === "reset_password") {
    const otpVal = vars.code || vars.otp || vars.token || "";
    const showOtp = otpVal && String(otpVal).length <= 8;
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; color: #111827;">
        <h2 style="margin-top: 0; font-size: 20px; font-weight: 700; color: #111827;">Reset Password ${brandName}</h2>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">Kami menerima permintaan untuk mereset kata sandi akun Anda. Klik tombol di bawah ini untuk membuat kata sandi baru:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: 700; border-radius: 8px; display: inline-block;">Reset Password Sekarang</a>
        </div>
        ${showOtp ? `
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
          <p style="font-size: 12px; color: #6b7280; margin: 0 0 6px 0;">Atau masukkan Kode OTP berikut pada form reset:</p>
          <span style="font-family: monospace; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #000000;">${otpVal}</span>
        </div>
        ` : ''}
        <p style="font-size: 12px; color: #6b7280; word-break: break-all;">Atau salin tautan berikut ke browser Anda:<br/><a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a></p>
      </div>
    `;
  }

  if (type === "order_invoice") {
    const domain = vars.domainName || vars.domain || "";
    const years = vars.years || 1;
    const amount = vars.amount || 0;
    const orderId = vars.orderId || "";
    const payUrl = vars.paymentLinkUrl || vars.payment_link_url || "#";
    const typeLabel = vars.orderTypeLabel || "Domain";
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; color: #111827;">
        <h2 style="margin-top: 0; font-size: 20px; font-weight: 700; color: #111827;">Invoice ${typeLabel} — ${brandName}</h2>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">Terima kasih! Pesanan Anda telah dibuat dan menunggu pembayaran.</p>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; color: #111827;">
          <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span style="color: #6b7280;">Domain</span><strong>${domain}</strong></div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span style="color: #6b7280;">Durasi</span><strong>${years} tahun</strong></div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span style="color: #6b7280;">No. Order</span><strong>${orderId}</strong></div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0; border-top: 1px solid #e5e7eb; margin-top: 8px; padding-top: 8px;"><span style="color: #6b7280;">Total</span><strong style="font-size: 16px;">${amount}</strong></div>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${payUrl}" style="background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: 700; border-radius: 8px; display: inline-block;">Bayar Sekarang</a>
        </div>
        <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin-bottom: 0;">Link pembayaran berlaku 1 jam. Jika tidak dibayar, pesanan akan dibatalkan otomatis.</p>
      </div>
    `;
  }

  if (type === "payment_success") {
    const domain = vars.domainName || vars.domain || "";
    const orderId = vars.orderId || "";
    const amount = vars.amount || 0;
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; color: #111827;">
        <h2 style="margin-top: 0; font-size: 20px; font-weight: 700; color: #059669;">Pembayaran Berhasil — ${brandName}</h2>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">Pembayaran Anda telah kami terima. Pesanan sedang diproses.</p>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; color: #111827;">
          <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span style="color: #6b7280;">Domain</span><strong>${domain}</strong></div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span style="color: #6b7280;">No. Order</span><strong>${orderId}</strong></div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span style="color: #6b7280;">Total Dibayar</span><strong>${amount}</strong></div>
        </div>
        <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin-bottom: 0;">Detail status pesanan dapat dilihat di dashboard Anda.</p>
      </div>
    `;
  }

  if (type === "payment_failed" || type === "payment_expired") {
    const domain = vars.domainName || vars.domain || "";
    const orderId = vars.orderId || "";
    const isExpired = type === "payment_expired";
    const title = isExpired ? "Pembayaran Kedaluwarsa" : "Pembayaran Gagal";
    const color = isExpired ? "#d97706" : "#dc2626";
    const msg = isExpired
      ? "Link pembayaran Anda telah kedaluwarsa dan pesanan dibatalkan."
      : "Pembayaran Anda tidak berhasil diproses dan pesanan dibatalkan.";
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; color: #111827;">
        <h2 style="margin-top: 0; font-size: 20px; font-weight: 700; color: ${color};">${title} — ${brandName}</h2>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">${msg}</p>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; color: #111827;">
          <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span style="color: #6b7280;">Domain</span><strong>${domain}</strong></div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span style="color: #6b7280;">No. Order</span><strong>${orderId}</strong></div>
        </div>
        <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin-bottom: 0;">Anda dapat membuat pesanan baru kapan saja melalui dashboard.</p>
      </div>
    `;
  }

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; color: #111827;">
      <h2 style="margin-top: 0; font-size: 20px; font-weight: 700; color: #111827;">Selamat Datang di ${brandName}!</h2>
      <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">Akun Anda telah berhasil dibuat. Anda dapat langsung mengelola domain, DNS, dan layanan hosting Anda melalui dashboard.</p>
    </div>
  `;
}

export async function sendEmail(
  to: string,
  type: "login_otp" | "register_otp" | "reset_password" | "register_success" | "order_invoice" | "payment_success" | "payment_failed" | "payment_expired",
  variables: Record<string, any>
) {
  // H1: never log OTP codes or reset links — they are live credentials. Log destination + type.
  console.log(`[EMAIL DISPATCH] Type: ${type} | To: ${to}`);

  const cfg = await getEmailConfig();

  // 1. Send via Kirisan API
  if (cfg.provider === "kirisan") {
    if (!cfg.kirisanToken || !cfg.kirisanChannelKey) {
      console.warn("[email] Kirisan not configured, skipped external API send to", to);
      return;
    }

    let templateId = cfg.kirisanTemplateId;
    if (type === "login_otp") templateId = cfg.kirisanLoginOtpTemplateId;
    else if (type === "register_otp") templateId = cfg.kirisanRegisterOtpTemplateId;
    else if (type === "reset_password") templateId = cfg.kirisanResetPasswordTemplateId;
    else if (type === "register_success") templateId = cfg.kirisanRegisterSuccessTemplateId;
    if (!templateId) {
      console.warn("[email] No Kirisan template ID for", type);
      return;
    }

    const body = {
      keys: { email: { token: cfg.kirisanChannelKey } },
      target: { email: to, variables },
      content: { email: { template: Number(templateId) || 1 } },
    };

    const res = await fetch(`${cfg.kirisanApiUrl}/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.kirisanToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[email] Kirisan send failed:", text);
    }
    return;
  }

  // 2. Send via Brevo API / SMTP Relay
  const apiKey = cfg.brevoApiKey || cfg.smtpPass;
  if (!apiKey) {
    console.warn("[email] Brevo API Key / SMTP Password not configured, skipped send to", to);
    throw new AppError("Gagal mengirim email. Silakan coba lagi.", 503);
  }

  const subjectMap = {
    login_otp: `[${cfg.brandName}] Kode OTP Login Anda`,
    register_otp: `[${cfg.brandName}] Kode OTP Pendaftaran Anda`,
    reset_password: `[${cfg.brandName}] Petunjuk Reset Password`,
    register_success: `Selamat Datang di ${cfg.brandName}!`,
    order_invoice: `[${cfg.brandName}] Invoice Pesanan — Menunggu Pembayaran`,
    payment_success: `[${cfg.brandName}] Pembayaran Berhasil`,
    payment_failed: `[${cfg.brandName}] Pembayaran Gagal`,
    payment_expired: `[${cfg.brandName}] Pembayaran Kedaluwarsa`,
  };

  const subject = subjectMap[type] || `[${cfg.brandName}] Notifikasi Account`;
  const htmlContent = renderEmailHtml(type, variables, cfg.brandName);

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "accept": "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: cfg.smtpFromName, email: cfg.smtpFromEmail },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[email] Brevo send failed:", text);
    throw new AppError("Gagal mengirim email. Silakan coba lagi.", 502);
  } else {
    console.log(`[email] Successfully sent ${type} email via Brevo API to ${to}`);
  }
}

/**
 * Send a transactional email to the customer who placed the order AND to every
 * operator (admin) account, so neither side misses the notification. Delivery
 * is best-effort: a failure to send must never break the order/payment flow,
 * so errors are logged and swallowed.
 *
 * `db` is imported lazily to avoid a circular import (email.ts is imported by
 * modules that also import the db module).
 */
export async function sendOrderNotification(
  type: "order_invoice" | "payment_success" | "payment_failed" | "payment_expired",
  customerEmail: string | null | undefined,
  vars: Record<string, any>,
) {
  const { db } = await import("../db");
  const { users } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const recipients = new Set<string>();
  if (customerEmail && customerEmail.trim()) recipients.add(customerEmail.trim().toLowerCase());
  try {
    const admins = await db.select({ email: users.email }).from(users).where(eq(users.role, "admin"));
    for (const a of admins) {
      if (a.email && a.email.trim()) recipients.add(a.email.trim().toLowerCase());
    }
  } catch (e) {
    console.warn("[email] sendOrderNotification: admin lookup failed:", (e as any)?.message || e);
  }
  for (const email of recipients) {
    try {
      await sendEmail(email, type, vars);
    } catch (e) {
      console.warn(`[email] ${type} to ${email} failed (non-blocking):`, (e as any)?.message || e);
    }
  }
}
