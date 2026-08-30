import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env";
import { AppError } from "./error";

const SECRET = new TextEncoder().encode(env.JWT_SECRET);

export interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
  sv: number;
}

export async function signToken(payload: { sub: number; email: string; role?: string; sessionVersion?: number }): Promise<string> {
  const expSeconds = getJwtExpirySeconds();
  return new SignJWT({
    sub: String(payload.sub),
    email: payload.email,
    role: payload.role || "customer",
    sv: payload.sessionVersion ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expSeconds}s`)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as JwtPayload;
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }
}

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 86400;
  const val = parseInt(match[1]!);
  switch (match[2]) {
    case "s": return val;
    case "m": return val * 60;
    case "h": return val * 3600;
    case "d": return val * 86400;
    default: return 86400;
  }
}

// V2-08: shared by signToken and the auth-cookie handler so cookie Max-Age
// always matches the token exp derived from JWT_EXPIRY.
export function getJwtExpirySeconds(): number {
  return parseExpiry(env.JWT_EXPIRY);
}
