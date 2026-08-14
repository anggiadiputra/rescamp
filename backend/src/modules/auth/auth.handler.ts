import * as svc from "./auth.service";
import { checkWhatsApp } from "../../lib/fonnte";
import type { JwtPayload } from "../../lib/jwt";
import { verifyTurnstileToken } from "../../lib/turnstile";
import { AppError } from "../../lib/error";

// H8: JWT rides in an httpOnly cookie instead of frontend localStorage.
// Bearer header still accepted for non-browser clients.
function setAuthCookie(ctx: any, token: string) {
  const secure = (process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true") ? "; Secure" : "";
  ctx.set.headers["Set-Cookie"] = `token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400${secure}`;
}

function clearAuthCookie(ctx: any) {
  const secure = (process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true") ? "; Secure" : "";
  ctx.set.headers["Set-Cookie"] = `token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

export async function register(ctx: any) {
  if (!ctx.body?.code) {
    await verifyTurnstileToken(ctx.body?.cfTurnstileResponse || ctx.headers?.["cf-turnstile-response"]);
  }
  const result = await svc.register(ctx.body);
  setAuthCookie(ctx, result.token);
  ctx.set.status = 201;
  return { data: result };
}

export async function registerCustomer(ctx: any) {
  if (!ctx.body?.code) {
    await verifyTurnstileToken(ctx.body?.cfTurnstileResponse || ctx.headers?.["cf-turnstile-response"]);
  }
  const result = await svc.register({ ...ctx.body, api_key: undefined });
  setAuthCookie(ctx, result.token);
  ctx.set.status = 201;
  return { data: result };
}

export async function login(ctx: any) {
  await verifyTurnstileToken(ctx.body?.cfTurnstileResponse || ctx.headers?.["cf-turnstile-response"]);
  const result = await svc.login(ctx.body);
  setAuthCookie(ctx, result.token);
  return { data: result };
}

export async function logout(ctx: any) {
  clearAuthCookie(ctx);
  return { success: true, message: "Logged out" };
}

export async function me(ctx: any) {
  const result = await svc.me(Number(ctx.store.user?.sub));
  return { data: result };
}

export async function getProfile(ctx: any) {
  const userId = Number(ctx.store.user?.sub);
  const result = await svc.getProfile(userId);
  return { data: result };
}

export async function updateProfile(ctx: any) {
  const userId = Number(ctx.store.user?.sub);
  const result = await svc.updateProfile(userId, ctx.body);
  return { data: result, message: "Profile updated successfully" };
}

export async function resellerData(ctx: any) {
  const userId = Number(ctx.store?.user?.sub);
  if (!userId || isNaN(userId)) throw new AppError("Unauthorized", 401);
  const result = await svc.getResellerData(userId);
  return { data: result };
}

export async function sendOtp(ctx: any) {
  await verifyTurnstileToken(ctx.body?.cfTurnstileResponse || ctx.headers?.["cf-turnstile-response"]);
  const { email, password } = ctx.body;
  const result = await svc.sendLoginOtp(email, password);
  return { data: result };
}

export async function sendRegisterOtp(ctx: any) {
  await verifyTurnstileToken(ctx.body?.cfTurnstileResponse || ctx.headers?.["cf-turnstile-response"]);
  const { email } = ctx.body;
  const result = await svc.sendRegisterOtp(email);
  return { data: result };
}

export async function verifyOtp(ctx: any) {
  const { email, code } = ctx.body;
  const result = await svc.verifyLoginOtp(email, code);
  setAuthCookie(ctx, result.token);
  return { data: result };
}

export async function forgotPassword(ctx: any) {
  const { email } = ctx.body;
  const result = await svc.forgotPassword(email);
  return { data: result };
}

export async function resetPassword(ctx: any) {
  const { token, password } = ctx.body;
  const result = await svc.resetPassword(token, password);
  return { data: result };
}

export async function checkWa(ctx: any) {
  const { phone } = ctx.body;
  if (!phone) return { data: { registered: false } };
  const result = await checkWhatsApp(phone);
  return { data: result };
}
