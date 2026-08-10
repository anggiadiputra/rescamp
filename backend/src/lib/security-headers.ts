import { Elysia } from "elysia";

/**
 * Security headers middleware to enforce OWASP HTTP security header standards
 */
export const securityHeaders = new Elysia({ name: "security-headers" })
  .onAfterHandle({ as: "global" }, ({ set }) => {
    set.headers["x-content-type-options"] = "nosniff";
    set.headers["x-frame-options"] = "DENY";
    set.headers["x-xss-protection"] = "1; mode=block";
    set.headers["referrer-policy"] = "strict-origin-when-cross-origin";
    set.headers["content-security-policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'";
  });
