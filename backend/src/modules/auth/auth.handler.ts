import * as svc from "./auth.service";
import { checkWhatsApp } from "../../lib/fonnte";
import type { JwtPayload } from "../../lib/jwt";
import { getJwtExpirySeconds, verifyToken } from "../../lib/jwt";
import { verifyTurnstileToken } from "../../lib/turnstile";
import { AppError } from "../../lib/error";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";

// Shared cookie reader (httpOnly session cookie) — same parsing rules as
// the authGuard in middleware/auth.ts.
function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name && rest.length) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

// H8: JWT rides in an httpOnly cookie instead of frontend localStorage.
// Bearer header still accepted for non-browser clients.
// V2-08: Max-Age derived from JWT_EXPIRY so cookie expiry always matches token exp.
function setAuthCookie(ctx: any, token: string) {
  const secure = (process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true") ? "; Secure" : "";
  const maxAge = getJwtExpirySeconds();
  ctx.set.headers["Set-Cookie"] = `token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function clearAuthCookie(ctx: any) {
  const secure = (process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true") ? "; Secure" : "";
  ctx.set.headers["Set-Cookie"] = `token=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure}`;
}

// Sliding-session: stamp last_active_at at login so the inactivity clock starts
// from the moment the session is created (not from a stale/old value).
async function touchLastActive(userId: number) {
  await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId)).catch(() => {});
}

export async function register(ctx: any) {
  if (!ctx.body?.code) {
    await verifyTurnstileToken(ctx.body?.cfTurnstileResponse || ctx.headers?.["cf-turnstile-response"]);
  }
  const result = await svc.register(ctx.body);
  setAuthCookie(ctx, result.token);
  touchLastActive(result.user.id);
  ctx.set.status = 201;
  // V2-04: token stays out of the response body — the httpOnly cookie is the
  // only browser session channel; body export would negate httpOnly's benefit.
  return { data: { user: result.user } };
}

export async function registerCustomer(ctx: any) {
  if (!ctx.body?.code) {
    await verifyTurnstileToken(ctx.body?.cfTurnstileResponse || ctx.headers?.["cf-turnstile-response"]);
  }
  const result = await svc.register({ ...ctx.body, api_key: undefined });
  setAuthCookie(ctx, result.token);
  touchLastActive(result.user.id);
  ctx.set.status = 201;
  return { data: { user: result.user } };
}

export async function login(ctx: any) {
  await verifyTurnstileToken(ctx.body?.cfTurnstileResponse || ctx.headers?.["cf-turnstile-response"]);
  const result = await svc.login(ctx.body);
  setAuthCookie(ctx, result.token);
  touchLastActive(result.user.id);
  // V2-04: session flows only through the httpOnly cookie.
  return { data: { user: result.user } };
}

export async function logout(ctx: any) {
  const userId = Number(ctx.store?.user?.sub);
  if (userId) await svc.revokeSessions(userId);
  clearAuthCookie(ctx);
  return { success: true, message: "Logged out" };
}

export async function me(ctx: any) {
  const result = await svc.me(Number(ctx.store.user?.sub));
  return { data: result };
}

/**
 * Bootstrap session probe for the SPA: ALWAYS 200.
 * - No session  -> { data: { authenticated: false } } (no user data leaked)
 * - Valid token -> { data: { authenticated: true, user: ... } }
 * Unlike /auth/me it never answers 401, so a public page load produces no
 * console noise. Short-circuits anonymous requests BEFORE token verification
 * and DB access, so it cannot become a cheap DoS vector.
 * Same security posture as /auth/me: httpOnly cookie/Bearer session,
 * sessionVersion revocation applies, and it is idempotent (read-only).
 */
export async function session(ctx: any) {
  const header = ctx.headers?.["authorization"] || ctx.headers?.["Authorization"];
  let token: string | null = null;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    token = header.slice(7).trim();
  } else {
    const cookieHeader = ctx.headers?.["cookie"];
    if (typeof cookieHeader === "string") {
      token = readCookie(cookieHeader, "token") || null;
    }
  }

  // Anonymous short-circuit: no token -> never 401, never touch the DB.
  if (!token) {
    return { data: { authenticated: false } };
  }

  try {
    const payload = await verifyToken(token);
    const userId = Number(payload.sub);
    const [user] = await db.select({ sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.sessionVersion !== Number(payload.sv ?? 0)) {
      return { data: { authenticated: false } };
    }
    const result = await svc.me(userId);
    return { data: { authenticated: true, user: (result as any).user } };
  } catch (err: any) {
    // Invalid/expired/revoked token is indistinguishable from "no session":
    // same 200 false envelope, no session oracle beyond what status codes exposed.
    if (process.env.SESSION_PROBE_DEBUG === '1') {
      console.error('[session probe] swallowed:', err?.message || err)
    }
    return { data: { authenticated: false } };
  }
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
  touchLastActive(result.user.id);
  // V2-04: session flows only through the httpOnly cookie.
  return { data: { user: result.user } };
}

export async function forgotPassword(ctx: any) {
  await verifyTurnstileToken(ctx.body?.cfTurnstileResponse || ctx.headers?.["cf-turnstile-response"]);
  const { email } = ctx.body;
  const result = await svc.forgotPassword(email);
  return { data: result };
}

export async function resetPassword(ctx: any) {
  await verifyTurnstileToken(ctx.body?.cfTurnstileResponse || ctx.headers?.["cf-turnstile-response"]);
  const { token, password, email } = ctx.body;
  const result = await svc.resetPassword(token, password, email);
  return { data: result };
}

export async function checkWa(ctx: any) {
  const { phone } = ctx.body;
  if (!phone) return { data: { registered: false } };
  const result = await checkWhatsApp(phone);
  return { data: result };
}
