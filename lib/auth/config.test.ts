import { afterEach, describe, expect, it, vi } from "vitest";
import { isEmailOtpEnabled } from "./config";

describe("email OTP feature gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off by default so the UI never promises an unverified email flow", () => {
    vi.stubEnv("AUTH_EMAIL_OTP_ENABLED", "");
    expect(isEmailOtpEnabled()).toBe(false);
  });

  it("only enables after an explicit true flag", () => {
    vi.stubEnv("AUTH_EMAIL_OTP_ENABLED", "true");
    expect(isEmailOtpEnabled()).toBe(true);
  });

  it("stays disabled for an explicit false flag", () => {
    vi.stubEnv("AUTH_EMAIL_OTP_ENABLED", "false");
    expect(isEmailOtpEnabled()).toBe(false);
  });
});
