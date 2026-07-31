import { describe, expect, it } from "vitest";
import { isMicrosoftReauthorizationRequired, MICROSOFT_CALENDAR_SCOPE } from "./oauth";

describe("MICROSOFT_CALENDAR_SCOPE", () => {
  it("never requests a calendar write scope", () => {
    expect(MICROSOFT_CALENDAR_SCOPE).not.toContain("Calendars.ReadWrite");
    expect(MICROSOFT_CALENDAR_SCOPE).toContain("Calendars.Read");
  });
});

describe("isMicrosoftReauthorizationRequired", () => {
  it("recognizes an invalid_grant error as requiring reauthorization", () => {
    expect(isMicrosoftReauthorizationRequired(new Error("Microsoft token refresh failed: 400 invalid_grant"))).toBe(
      true
    );
  });

  it("recognizes an AADSTS700082 (expired refresh token) error", () => {
    expect(isMicrosoftReauthorizationRequired(new Error("AADSTS700082: refresh token has expired"))).toBe(true);
  });

  it("recognizes an AADSTS70008 (expired/revoked) error", () => {
    expect(isMicrosoftReauthorizationRequired(new Error("AADSTS70008: expired or revoked"))).toBe(true);
  });

  it("does not treat a generic network error as requiring reauthorization", () => {
    expect(isMicrosoftReauthorizationRequired(new Error("fetch failed: ECONNRESET"))).toBe(false);
  });

  it("handles non-Error values without throwing", () => {
    expect(isMicrosoftReauthorizationRequired("invalid_grant")).toBe(true);
    expect(isMicrosoftReauthorizationRequired(null)).toBe(false);
  });
});
