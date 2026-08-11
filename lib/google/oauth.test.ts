import { describe, expect, it } from "vitest";
import {
  GOOGLE_CALENDAR_READ_SCOPE,
  GOOGLE_CALENDAR_WRITE_SCOPE,
  googleCalendarScopes,
} from "./oauth";

describe("Google Calendar least-privilege scopes", () => {
  it("uses read-only event access by default", () => {
    const scopes = googleCalendarScopes("read");
    expect(scopes).toContain(GOOGLE_CALENDAR_READ_SCOPE);
    expect(scopes).not.toContain(GOOGLE_CALENDAR_WRITE_SCOPE);
  });

  it("requests write access only in the explicit upgrade flow", () => {
    const scopes = googleCalendarScopes("write");
    expect(scopes).toContain(GOOGLE_CALENDAR_WRITE_SCOPE);
    expect(scopes).not.toContain(GOOGLE_CALENDAR_READ_SCOPE);
  });
});
