import { describe, expect, it } from "vitest";
import {
  formatPairingCode,
  generateDeviceToken,
  generatePairingCode,
  hmacCompanionSecret,
  isValidDeviceToken,
  isValidPairingCode,
  normalizePairingCode,
} from "./companion-secrets";

describe("Android Companion secrets", () => {
  it("creates human-readable 80-bit pairing codes without ambiguous characters", () => {
    const code = generatePairingCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    expect(isValidPairingCode(code)).toBe(true);
  });

  it("normalizes separators and ambiguous characters", () => {
    expect(normalizePairingCode("o1il-2345-6789-abcd")).toBe("011123456789ABCD");
    expect(formatPairingCode("0123456789abcdef")).toBe("0123-4567-89AB-CDEF");
  });

  it("creates 256-bit versioned device tokens", () => {
    const token = generateDeviceToken();
    expect(isValidDeviceToken(token)).toBe(true);
    expect(isValidDeviceToken(`${token}x`)).toBe(false);
  });

  it("domain-separates deterministic HMAC hashes", () => {
    const key = "a-secure-test-key-that-is-longer-than-32-characters";
    expect(hmacCompanionSecret("pair:value", key)).toHaveLength(64);
    expect(hmacCompanionSecret("pair:value", key)).not.toBe(hmacCompanionSecret("device:value", key));
  });
});

