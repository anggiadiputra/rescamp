/**
 * Simple in-memory rate limiter using token bucket algorithm
 * ponytail: in-memory only; for production with multiple instances, use Redis
 */

interface RateLimitStore {
  tokens: number;
  lastRefill: number;
}

const store = new Map<string, RateLimitStore>();

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { maxRequests, windowMs } = options;

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

/**
 * Get client IP from request with reverse proxy header support
 */
export function getClientIP(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    if (first && first.trim()) {
      return first.trim();
    }
  }

  return "127.0.0.1";
}

