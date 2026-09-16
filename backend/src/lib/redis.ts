// Redis-backed stores for rate limiting and OTP lockout.
//
// Bun ships a built-in RedisClient (`Bun.redis`) — no external dependency.
// The client is a lazy singleton and every operation degrades gracefully:
// if Redis is unavailable (down, misconfigured, or on a box without it), the
// callers fall back to their in-memory stores instead of crashing or blocking
// auth/checkout. This keeps Redis a strict availability WIN (survives deploy/
// restart, multi-instance ready) without turning it into a hard dependency.
//
// NOTE: Bun.redis is an instance, not a constructor — `typeof Bun.redis` is
// "object" on Bun 1.3.x. Operations are async and auto-connect on first use.

import { env } from "../config/env";

export interface RedisOps {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: string[]): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  exists(key: string): Promise<boolean>;
}

let cached: RedisOps | null | undefined;

function buildClient(): RedisOps | null {
  // Opt-in via REDIS_URL: when unset we use the in-memory fallbacks (dev/test).
  if (!env.REDIS_URL) return null;
  try {
    const c = (Bun as any).redis;
    if (!c || typeof c.incr !== "function") return null;
    return c as RedisOps;
  } catch {
    return null;
  }
}

export function getRedis(): RedisOps | null {
  if (cached !== undefined) return cached;
  cached = buildClient();
  return cached;
}

/**
 * Atomic fixed-window counter: INCR a key, and on the first increment (value 1)
 * set its TTL. Returns the new count, or null when Redis is unavailable so the
 * caller can fall back to in-memory accounting.
 */
export async function incrWithExpiry(key: string, ttlSeconds: number): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return count;
  } catch {
    return null;
  }
}

/**
 * Read-and-delete a lock record atomically enough for a coarse lockout check.
 * Returns the stored value, or null when Redis is down / key missing.
 */
export async function getDel(key: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const value = await redis.get(key);
    if (value !== null) await redis.del(key);
    return value;
  } catch {
    return null;
  }
}
