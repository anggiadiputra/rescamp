import { verifyToken, type JwtPayload } from "../lib/jwt";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { hasAdminCapabilities, hasResellerCapabilities } from "../lib/roles";
import { env } from "../config/env";

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name && rest.length) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export async function authGuard(ctx: any) {
  const header = ctx.headers["authorization"] || ctx.headers["Authorization"];
  let token: string | null = null;
  if (header?.startsWith("Bearer ")) {
    token = header.slice(7).trim();
  } else {
    // H8: fallback to httpOnly auth cookie for browser clients
    token = readCookie(ctx.headers["cookie"], "token") || null;
  }
  if (!token) {
    ctx.set.status = 401;
    return { error: "Authorization header required", statusCode: 401 };
  }
  try {
    const payload = await verifyToken(token);
    const userId = Number(payload.sub);
    const [user] = await db.select({ sessionVersion: users.sessionVersion, lastActiveAt: users.lastActiveAt }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.sessionVersion !== Number(payload.sv ?? 0)) {
      throw new Error("Session revoked");
    }

    // Sliding-session inactivity timeout: if the user has been idle longer than
    // SESSION_TIMEOUT_MIN, force logout (401) even though the JWT itself is still
    // within its absolute expiry. This prevents a forgotten session on a shared
    // device from staying alive for the full JWT_EXPIRY.
    const timeoutMs = env.SESSION_TIMEOUT_MIN * 60 * 1000;
    if (user.lastActiveAt) {
      const lastActive = new Date(user.lastActiveAt).getTime();
      if (Date.now() - lastActive > timeoutMs) {
        throw new Error("Session expired due to inactivity");
      }
    }

    // Sliding: refresh the activity timestamp. Throttle to at most one write per
    // 60s per user so a busy session doesn't hammer the DB on every request.
    const now = new Date();
    const shouldTouch = !user.lastActiveAt || (now.getTime() - new Date(user.lastActiveAt).getTime()) > 60_000;
    if (shouldTouch) {
      await db.update(users).set({ lastActiveAt: now }).where(eq(users.id, userId)).catch(() => {});
    }

    ctx.store.user = payload;
  } catch (err: any) {
    ctx.set.status = 401;
    return { error: err.message, statusCode: 401 };
  }
}

export async function resellerGuard(ctx: any) {
  if (!hasResellerCapabilities(ctx.store?.user?.role)) {
    ctx.set.status = 403;
    return { error: "Reseller access required", statusCode: 403 };
  }
}

export async function adminGuard(ctx: any) {
  if (!hasAdminCapabilities(ctx.store?.user?.role)) {
    ctx.set.status = 403;
    return { error: "Administrator access required", statusCode: 403 };
  }
}
