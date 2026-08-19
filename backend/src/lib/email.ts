import { db } from "../db";
import { appSettings } from "../db/schema";
import { env } from "../config/env";

async function getEmailConfig() {
  const rows = await db.select().from(appSettings);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value || "";

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
  type: "login_otp" | "register_otp" | "reset_password" | "register_success",
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

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; color: #111827;">
      <h2 style="margin-top: 0; font-size: 20px; font-weight: 700; color: #111827;">Selamat Datang di ${brandName}!</h2>
      <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">Akun Anda telah berhasil dibuat. Anda dapat langsung mengelola domain, DNS, dan layanan hosting Anda melalui dashboard.</p>
    </div>
  `;
}

export async function sendEmail(
  to: string,
  type: "login_otp" | "register_otp" | "reset_password" | "register_success",
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
    return;
  }

  const subjectMap = {
    login_otp: `[${cfg.brandName}] Kode OTP Login Anda`,
    register_otp: `[${cfg.brandName}] Kode OTP Pendaftaran Anda`,
    reset_password: `[${cfg.brandName}] Petunjuk Reset Password`,
    register_success: `Selamat Datang di ${cfg.brandName}!`,
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
  } else {
    console.log(`[email] Successfully sent ${type} email via Brevo API to ${to}`);
  }
}
