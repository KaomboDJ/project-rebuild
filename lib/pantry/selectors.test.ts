import { describe, expect, it } from "vitest";
import { countAvailable, countExpiringSoon, countTotalRegistered, type PantryCountable } from "./selectors";

const ITEMS: PantryCountable[] = [
  { quantity: 3, expires_on: null },
  { quantity: 0, expires_on: null },
  { quantity: 2, expires_on: "2026-07-30" },
  { quantity: 0, expires_on: "2026-07-29" },
];

describe("pantry count selectors (docs/17_UX_AUDIT.md, N2)", () => {
  it("countTotalRegistered counts every row regardless of stock", () => {
    expect(countTotalRegistered(ITEMS)).toBe(4);
  });

  it("countAvailable only counts rows with quantity > 0", () => {
    expect(countAvailable(ITEMS)).toBe(2);
  });

  it("countExpiringSoon only counts available items expiring on/before today", () => {
    // The quantity-0 row with an earlier expiry date must NOT be counted -
    // it isn't "available", regardless of its expiry date. This is exactly
    // the confusion the audit found: a zero-stock item should never be
    // described as available or as something at risk of going to waste.
    expect(countExpiringSoon(ITEMS, "2026-07-30")).toBe(1);
  });

  it("countExpiringSoon returns 0 when nothing available is due yet", () => {
    expect(countExpiringSoon(ITEMS, "2026-07-01")).toBe(0);
  });

  it("handles an empty pantry", () => {
    expect(countTotalRegistered([])).toBe(0);
    expect(countAvailable([])).toBe(0);
    expect(countExpiringSoon([], "2026-07-30")).toBe(0);
  });
});
