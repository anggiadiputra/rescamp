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
    set.headers["strict-transport-security"] = "max-age=31536000; includeSubDomains";
    // CSP removed: this is a REST API, not a web page.
    // Sending CSP on JSON responses can cause browser-side fetch failures
    // on the frontend. The frontend should manage its own CSP.
  });
