import { verifyToken, type JwtPayload } from "../lib/jwt";

export async function authGuard(ctx: any) {
  const header = ctx.headers["authorization"] || ctx.headers["Authorization"];
  if (!header?.startsWith("Bearer ")) {
    ctx.set.status = 401;
    return { error: "Authorization header required", statusCode: 401 };
  }
  try {
    const payload = await verifyToken(header.slice(7));
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
