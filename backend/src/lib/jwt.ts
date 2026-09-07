import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env";
import { AppError } from "./error";

export interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
  sv: number;
}

// JWT-ROTATION: two signing keys are supported simultaneously.
//   - JWT_SECRET      — the current key; all new tokens are signed with it.
//   - JWT_SECRET_PREVIOUS — the retired key; tokens signed with it still verify
//     during the rotation window (one JWT_EXPIRY period is a safe window).
// This lets the operator rotate the secret without killing every active
// session: deploy with the old secret in JWT_SECRET_PREVIOUS, then remove that
// variable again after the rotation window passes.
//
// Verification tries the current key first (the common case), then the previous
// key. With at most two keys this is standard practice and avoids the foot-gun
// of a `kid` header that must be re-bound to key material on every rotation.

function encodeSecret(secret: string | undefined): Uint8Array | null {
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

const currentSecret = encodeSecret(env.JWT_SECRET);
const previousSecret = encodeSecret(env.JWT_SECRET_PREVIOUS || undefined);

if (!currentSecret) {
  // env.ts already gates on length, but keep a hard guard here too.
  throw new Error("JWT_SECRET must be set");
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
    .sign(currentSecret!);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  // Current key first (the common case).
  try {
    const { payload } = await jwtVerify(token, currentSecret!, { algorithms: ["HS256"] });
    return payload as unknown as JwtPayload;
  } catch {
    // Rotation window: fall back to the previous key. A token signed with a
    // fully retired key (neither current nor previous) is rejected here.
    if (previousSecret) {
      try {
        const { payload } = await jwtVerify(token, previousSecret, { algorithms: ["HS256"] });
        return payload as unknown as JwtPayload;
      } catch {
        // fall through to reject
      }
    }
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
