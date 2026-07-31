import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask-email";

describe("maskEmail", () => {
  it("masks most of the local part while keeping the domain readable", () => {
    expect(maskEmail("marco.silva@gmail.com")).toBe("ma*********@g****.com");
  });

  it("handles a very short local part without throwing or negative repeat counts", () => {
    expect(maskEmail("ab@example.com")).toBe("a*@e******.com");
    expect(maskEmail("a@example.com")).toBe("a*@e******.com");
  });

  it("returns the input unchanged if it has no @ (defensive, should not happen)", () => {
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });

  it("never returns the full local part for a realistic email", () => {
    const masked = maskEmail("baratapk@gmail.com");
    expect(masked).not.toBe("baratapk@gmail.com");
    expect(masked.startsWith("ba")).toBe(true);
  });
});
