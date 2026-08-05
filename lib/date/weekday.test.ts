import { describe, expect, it } from "vitest";
import { dayOfWeek } from "./weekday";

describe("dayOfWeek", () => {
  it("matches the founder-context reference date (2026-08-03 is a Monday)", () => {
    expect(dayOfWeek("2026-08-03")).toBe("monday");
    expect(dayOfWeek("2026-08-04")).toBe("tuesday");
    expect(dayOfWeek("2026-08-09")).toBe("sunday");
  });
});
