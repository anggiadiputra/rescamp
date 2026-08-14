import { verifyToken, type JwtPayload } from "../lib/jwt";

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
    ctx.store.user = payload;
  } catch (err: any) {
    ctx.set.status = 401;
    return { error: err.message, statusCode: 401 };
  }
}

export async function resellerGuard(ctx: any) {
  if (ctx.store?.user?.role !== "reseller") {
    ctx.set.status = 403;
    return { error: "Reseller access required", statusCode: 403 };
  }
}
