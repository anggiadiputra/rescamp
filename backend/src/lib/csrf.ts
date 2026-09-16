// CSRF defense for the cookie-based session.
//
// Model: Origin-header verification (OWASP-recommended for modern SPAs) —
// every state-changing request (POST/PUT/PATCH/DELETE) MUST carry an Origin
// (or Referer, as fallback) that matches the CORS allowlist. Browsers always
// attach Origin/Referer on cross-site fetch/form submissions and cannot be
// forged by page JS, so a forged request from a third-party site is rejected
// before it ever reaches business logic.
//
// Why not a double-submit token: the session is an httpOnly cookie and the
// frontend never reads it; an Origin check gives equivalent protection without
// a second round-trip or FE changes. SameSite=Strict (set on the auth cookie)
// already blocks most CSRF vectors — this guard is the second layer for
// legacy browsers and SameSite edge cases.

import type { Context } from "elysia";
import { env } from "../config/env";
import { isOriginAllowed, parseAllowedOrigins } from "./cors-policy";

const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = parseAllowedOrigins(env.CORS_ORIGIN || "");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Server-to-server POST endpoints never carry a browser Origin header; they
// authenticate with their own credentials (HMAC signature / token) and must be
// exempt from the browser-CSRF guard.
const CSRF_EXEMPT_PATHS = new Set([
  "/api/payments/webhook/sumopod", // Sumopod webhook: verified via Svix HMAC / token, fail-closed
  "/api/payments/callback/duitku", // Duitku callback: verified via HMAC-SHA256 + amount match, fail-closed
]);

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.has(pathname);
}

export function csrfOriginGuard(ctx: Context) {
  const request = ctx.request as Request;
  const method = request.method;
  if (SAFE_METHODS.has(method)) return;

  const pathname = new URL(request.url).pathname;
  if (isCsrfExempt(pathname)) return;

  // Read headers from the Request object (Web Headers API) — never bracket
  // access on a Headers instance, which is always undefined.
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // No Origin AND no Referer on a state-changing request: browsers always send
  // one of them (fetch same-origin sends Origin on POST; forms send Referer).
  // Absence of both is abnormal — reject rather than guess.
  if (!origin && !referer) {
    ctx.set.status = 403;
    return { error: "CSRF check failed: missing origin", statusCode: 403 };
  }

  if (origin) {
    if (isOriginAllowed(origin, allowedOrigins, isProduction)) return;
    // Origin present but not allowed — reject regardless of Referer.
    ctx.set.status = 403;
    console.warn(`[CSRF] Rejected origin: ${origin} (${method} ${pathname})`);
    return { error: "CSRF check failed: invalid origin", statusCode: 403 };
  }

  // Only Referer present (rare): compare its origin portion against the allowlist.
  try {
    const refererOrigin = new URL(referer!).origin;
    if (isOriginAllowed(refererOrigin, allowedOrigins, isProduction)) return;
  } catch {
    // malformed Referer — fall through to reject
  }
  ctx.set.status = 403;
  console.warn(`[CSRF] Rejected referer: ${referer} (${method} ${pathname})`);
  return { error: "CSRF check failed: invalid referer", statusCode: 403 };
}
