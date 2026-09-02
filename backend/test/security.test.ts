import { describe, expect, it } from "bun:test";
import { createRateLimiter, getClientIP } from "../src/lib/rate-limit";
import { securityHeaders } from "../src/lib/security-headers";
import { Elysia } from "elysia";
import { authRoutes } from "../src/modules/auth/auth.route";

describe("Security Rate Limiter & Headers", () => {
  it("does not expose a password-only login route that bypasses OTP", () => {
    const routePaths = authRoutes.routes.map((route) => route.path);
    expect(routePaths).not.toContain("/auth/login");
  });

  it("requires authentication for WhatsApp number checks", async () => {
    const app = new Elysia().use(authRoutes);
    const response = await app.handle(new Request("http://localhost/auth/check-whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "628123456789" }),
    }));
    expect(response.status).toBe(401);
  });

  it("should enforce rate limits when token bucket is exhausted", () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60 * 1000 });
    const key = "test-ip-123";

    expect(limiter.isAllowed(key)).toBe(true);
    expect(limiter.isAllowed(key)).toBe(true);
    expect(limiter.isAllowed(key)).toBe(true);
    // 4th request should be blocked
    expect(limiter.isAllowed(key)).toBe(false);
  });

  it("isolates token buckets belonging to different limiters", () => {
    const otp = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    const webhook = createRateLimiter({ maxRequests: 100, windowMs: 60_000 });
    const key = "shared-client-ip";

    expect(otp.isAllowed(key)).toBe(true);
    expect(otp.isAllowed(key)).toBe(false);
    expect(webhook.isAllowed(key)).toBe(true);
    expect(otp.isAllowed(key)).toBe(false);
  });

  it("should extract client IP from proxy headers only when TRUST_PROXY=true", () => {
    const prev = process.env.TRUST_PROXY;
    delete process.env.TRUST_PROXY;

    // H5: without TRUST_PROXY, spoofable headers are ignored and the socket IP is used
    const req0 = new Request("http://localhost/api", {
      headers: { "cf-connecting-ip": "203.0.113.195" },
    });
    const fakeServer = { requestIP: () => ({ address: "10.9.9.9" }) };
    expect(getClientIP(req0, fakeServer)).toBe("10.9.9.9");

    process.env.TRUST_PROXY = "true";
    try {
      const req1 = new Request("http://localhost/api", {
        headers: { "cf-connecting-ip": "203.0.113.195" },
      });
      expect(getClientIP(req1)).toBe("203.0.113.195");

      // nginx overwrites X-Real-IP from its trusted real-ip chain. It must win
      // over a client-supplied CF-Connecting-IP header when both are present.
      const reqFromNginx = new Request("http://localhost/api", {
        headers: {
          "x-real-ip": "198.51.100.77",
          "cf-connecting-ip": "203.0.113.250",
        },
      });
      expect(getClientIP(reqFromNginx)).toBe("198.51.100.77");

      const req2 = new Request("http://localhost/api", {
        headers: { "x-forwarded-for": "198.51.100.1, 10.0.0.1" },
      });
      expect(getClientIP(req2)).toBe("198.51.100.1");
    } finally {
      if (prev === undefined) delete process.env.TRUST_PROXY; else process.env.TRUST_PROXY = prev;
    }

    const req3 = new Request("http://localhost/api");
    expect(getClientIP(req3)).toBe("unknown");
  });

  it("should attach OWASP security headers to HTTP responses", async () => {
    const app = new Elysia()
      .use(securityHeaders)
      .get("/test", () => ({ status: "ok" }));

    const res = await app.handle(new Request("http://localhost/test"));
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-XSS-Protection")).toBe("1; mode=block");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
});
