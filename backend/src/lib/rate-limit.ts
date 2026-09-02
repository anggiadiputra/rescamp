/**
 * Simple in-memory rate limiter using token bucket algorithm
 * ponytail: in-memory only; for production with multiple instances, use Redis
 */
import { AppError } from "./error";

interface RateLimitStore {
  tokens: number;
  lastRefill: number;
}

const stores = new Set<Map<string, RateLimitStore>>();

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { maxRequests, windowMs } = options;
  const store = new Map<string, RateLimitStore>();
  stores.add(store);

  return {
    /**
     * Check if request is allowed. Returns true if allowed, false if rate limited.
     */
    isAllowed(key: string): boolean {
      const now = Date.now();
      const record = store.get(key);

      if (!record) {
        store.set(key, { tokens: maxRequests - 1, lastRefill: now });
        return true;
      }

      // Refill tokens based on time elapsed
      const elapsed = now - record.lastRefill;
      const tokensToAdd = (elapsed / windowMs) * maxRequests;
      const newTokens = Math.min(maxRequests, record.tokens + tokensToAdd);

      if (newTokens >= 1) {
        store.set(key, { tokens: newTokens - 1, lastRefill: now });
        return true;
      }

      return false;
    },

    /**
     * Get remaining requests for a key
     */
    getRemaining(key: string): number {
      const now = Date.now();
      const record = store.get(key);

      if (!record) return maxRequests;

      const elapsed = now - record.lastRefill;
      const tokensToAdd = (elapsed / windowMs) * maxRequests;
      return Math.floor(Math.min(maxRequests, record.tokens + tokensToAdd));
    },

    /**
     * Reset rate limit for a key
     */
    reset(key: string): void {
      store.delete(key);
    },
  };
}

/**
 * Pre-configured rate limiters for auth endpoints
 */
export const authRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000, // 10 requests per minute
});

export const otpRateLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 60 * 1000, // 5 requests per minute (stricter for OTP)
});

export const domainCheckRateLimiter = createRateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000, // 30 requests per minute for domain availability/WHOIS check
});

export const paymentStatusRateLimiter = createRateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000, // 60 requests per minute for status polling
});

export const webhookRateLimiter = createRateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000, // 100 requests per minute for webhooks
});

export const authenticatedRateLimiter = createRateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000, // 30 requests per minute for authenticated endpoints
});

export const settingsRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000, // 10 requests per minute for admin settings
});

/**
 * Get client IP from request.
 * H5: headers are trusted ONLY when TRUST_PROXY=true (app behind a proxy that
 * overwrites them). Otherwise the real socket IP is used via the Bun server.
 */
export function getClientIP(request: Request, server?: any): string {
  if (process.env.TRUST_PROXY === "true") {
    // nginx overwrites X-Real-IP from its trusted real-ip chain. Prefer it over
    // client-supplied forwarding headers so direct-origin callers cannot rotate
    // their rate-limit identity by spoofing CF-Connecting-IP.
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();

    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0];
      if (first && first.trim()) {
        return first.trim();
      }
    }
  }

  try {
    const ip = server?.requestIP?.(request)?.address;
    if (ip) return ip;
  } catch {}

  return "unknown";
}

/**
 * Elysia beforeHandle factory that throws 429 via AppError when the limiter
 * refuses the client IP. Accepts the message so routes can localize.
 */
export function rateLimit(
  limiter: ReturnType<typeof createRateLimiter>,
  message: string = "Terlalu banyak permintaan. Silakan coba lagi nanti.",
) {
  return ({ request, server }: { request: Request; server: any }) => {
    const ip = getClientIP(request, server);
    if (!limiter.isAllowed(ip)) {
      throw new AppError(message, 429);
    }
  };
}

// Eviction: drop stale buckets so spoofed/unbounded keys can't grow memory forever
setInterval(() => {
  const now = Date.now();
  for (const store of stores) {
    for (const [key, record] of store) {
      if (now - record.lastRefill > 30 * 60 * 1000) {
        store.delete(key);
      }
    }
  }
}, 5 * 60 * 1000);

