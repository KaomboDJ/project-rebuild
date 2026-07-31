import { describe, expect, it } from "vitest";
import { pluralizePt } from "./pluralize";

describe("pluralizePt", () => {
  it("uses the singular form for exactly 1", () => {
    expect(pluralizePt(1, "item", "itens")).toBe("1 item");
  });

  it("uses the plural form for 0", () => {
    expect(pluralizePt(0, "item", "itens")).toBe("0 itens");
  });

  it("uses the plural form for counts greater than 1", () => {
    expect(pluralizePt(5, "item", "itens")).toBe("5 itens");
  });
});
