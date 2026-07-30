import { db } from "../db";
import { appSettings } from "../db/schema";

async function getKirisanConfig() {
  const rows = await db.select().from(appSettings);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value || "";
  return {
    token: map.kirisan_token || "",
    channelKey: map.kirisan_channel_key || "",
    templateId: map.kirisan_template_id || "",
    loginOtpTemplateId: map.kirisan_login_otp_template_id || map.kirisan_template_id || "",
    registerOtpTemplateId: map.kirisan_register_otp_template_id || map.kirisan_template_id || "",
    resetPasswordTemplateId: map.kirisan_reset_password_template_id || map.kirisan_template_id || "",
  };
}

export async function sendEmail(to: string, type: "login_otp" | "register_otp" | "reset_password", variables: Record<string, any>) {
  // Always log email dispatch details to console for development visibility
  console.log(`\n=================================================`);
  console.log(`[EMAIL DISPATCH] Type: ${type} | To: ${to}`);
  if (variables.reset_link) console.log(`🔗 RESET LINK: ${variables.reset_link}`);
  if (variables.code || variables.otp) console.log(`🔑 OTP CODE  : ${variables.code || variables.otp}`);
  console.log(`=================================================\n`);

  const cfg = await getKirisanConfig();
  if (!cfg.token || !cfg.channelKey) {
    console.warn("[email] Kirisan not configured, skipped external API send to", to);
    return;
  }

  let templateId = cfg.templateId;
  if (type === "login_otp") templateId = cfg.loginOtpTemplateId;
  else if (type === "register_otp") templateId = cfg.registerOtpTemplateId;
  else if (type === "reset_password") templateId = cfg.resetPasswordTemplateId;
  if (!templateId) {
    console.warn("[email] No template ID for", type);
    return;
  }

  const body = {
    keys: { email: { token: cfg.channelKey } },
    target: { email: to, variables },
    content: { email: { template: Number(templateId) || 1 } },
  };

  const res = await fetch("https://api.kirisan.com/v1/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[email] Kirisan send failed:", text);
  }
}
