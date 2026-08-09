import { describe, it, expect } from "bun:test";
import { parsePrivacyProtectionStatus, extractAuthCode } from "../src/modules/domains/domains.service";

describe("parsePrivacyProtectionStatus", () => {
  it("parses boolean values", () => {
    expect(parsePrivacyProtectionStatus(true)).toBe(true);
    expect(parsePrivacyProtectionStatus(false)).toBe(false);
  });

  it("parses string values", () => {
    expect(parsePrivacyProtectionStatus("true")).toBe(true);
    expect(parsePrivacyProtectionStatus("active")).toBe(true);
    expect(parsePrivacyProtectionStatus("enabled")).toBe(true);
    expect(parsePrivacyProtectionStatus("1")).toBe(true);
    expect(parsePrivacyProtectionStatus("false")).toBe(false);
    expect(parsePrivacyProtectionStatus("disabled")).toBe(false);
  });

  it("parses object responses with different key structures", () => {
    expect(parsePrivacyProtectionStatus({ privacy_protection: "true" })).toBe(true);
    expect(parsePrivacyProtectionStatus({ privacy_protection_enabled: true })).toBe(true);
    expect(parsePrivacyProtectionStatus({ status: "active" })).toBe(true);
    expect(parsePrivacyProtectionStatus({ data: { privacy_protection: "true" } })).toBe(true);
    expect(parsePrivacyProtectionStatus({ privacy_protection: { status: "active" } })).toBe(true);
    expect(parsePrivacyProtectionStatus({ privacy_protection: "false" })).toBe(false);
  });
});

describe("extractAuthCode", () => {
  it("extracts primitive strings", () => {
    expect(extractAuthCode("AUTH123KEY")).toBe("AUTH123KEY");
    expect(extractAuthCode("-")).toBe(null);
    expect(extractAuthCode("")).toBe(null);
  });

  it("extracts from object formats", () => {
    expect(extractAuthCode({ auth_code: "KEY123" })).toBe("KEY123");
    expect(extractAuthCode({ authcode: "KEY123" })).toBe("KEY123");
    expect(extractAuthCode({ epp_code: "KEY123" })).toBe("KEY123");
    expect(extractAuthCode({ secret: "KEY123" })).toBe("KEY123");
    expect(extractAuthCode({ data: { auth_code: "KEY123" } })).toBe("KEY123");
    expect(extractAuthCode({ data: "KEY123" })).toBe("KEY123");
  });
});
