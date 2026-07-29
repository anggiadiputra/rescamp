import { describe, it, expect } from "bun:test";
import { hashPassword, verifyPassword } from "../src/lib/hash";

describe("hash", () => {
  it("hash and verify round-trip", async () => {
    const hash = await hashPassword("test123");
    expect(hash).not.toBe("test123");
    expect(await verifyPassword("test123", hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
