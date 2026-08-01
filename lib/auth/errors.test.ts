import { describe, expect, it } from "vitest";
import { classifyOAuthCallbackError, mapOtpRequestError, mapOtpVerifyError } from "./errors";

describe("mapOtpVerifyError", () => {
  it("maps an expired-token signal to the expired copy", () => {
    expect(mapOtpVerifyError({ code: "otp_expired", message: "Token has expired or is invalid" })).toBe(
      "Este código expirou. Pede um novo."
    );
  });

  it("maps an invalid-token signal (wrong code) to the incorrect-code copy", () => {
    expect(mapOtpVerifyError({ message: "Invalid token" })).toBe(
      "O código não está correto. Confirma e tenta novamente."
    );
  });

  it("never leaks the raw provider message", () => {
    const message = mapOtpVerifyError({ message: "duplicate key value violates unique constraint" });
    expect(message).not.toContain("constraint");
    expect(message).not.toContain("duplicate key");
  });

  it("falls back to the generic message for an unrecognized/network error", () => {
    expect(mapOtpVerifyError(new TypeError("fetch failed"))).toBe(
      "Não foi possível entrar agora. Tenta novamente dentro de momentos."
    );
    expect(mapOtpVerifyError(new Error("something unexpected"))).toBe(
      "Não foi possível entrar agora. Tenta novamente dentro de momentos."
    );
  });
});

describe("mapOtpRequestError", () => {
  it("maps a rate-limit signal to a resend-cooldown message", () => {
    expect(mapOtpRequestError({ code: "over_email_send_rate_limit", status: 429 })).toBe(
      "Pediste um código há pouco tempo. Espera um pouco antes de pedir outro."
    );
  });

  it("falls back to the generic message for anything else", () => {
    expect(mapOtpRequestError(new Error("SMTP connection refused"))).toBe(
      "Não foi possível entrar agora. Tenta novamente dentro de momentos."
    );
  });

  it("never leaks the raw provider message", () => {
    const message = mapOtpRequestError({ message: "SMTP connection refused by relay 10.0.0.5" });
    expect(message).not.toContain("SMTP");
    expect(message).not.toContain("10.0.0.5");
  });
});

describe("classifyOAuthCallbackError", () => {
  it("classifies access_denied as a cancellation", () => {
    expect(classifyOAuthCallbackError("access_denied", null)).toBe("oauth-cancelled");
  });

  it("classifies any other provider error as a generic failure", () => {
    expect(classifyOAuthCallbackError("server_error", "unexpected_failure")).toBe("oauth-failed");
  });

  it("returns null when there is no error at all", () => {
    expect(classifyOAuthCallbackError(null, null)).toBeNull();
  });
});
