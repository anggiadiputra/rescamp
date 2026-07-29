import { describe, it, expect } from "bun:test";

process.env.JWT_SECRET = "test-secret-at-least-16-chars-long";

// Reload env after setting
const { env } = await import("../src/config/env");
// Force re-evaluation of SECRET by re-importing jwt
const mod = await import("../src/lib/jwt");
const { signToken, verifyToken } = mod;

describe("jwt", () => {
  it("sign and verify round-trip", async () => {
    const token = await signToken({ sub: 1, email: "test@test.com" });
    expect(token).toBeString();
    const payload = await verifyToken(token);
    expect(payload.sub).toBe("1");
    expect(payload.email).toBe("test@test.com");
  });
});
