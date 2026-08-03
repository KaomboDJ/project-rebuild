import { describe, expect, it } from "vitest";
import { normalizePhysicalLimitation } from "./types";

describe("normalizePhysicalLimitation", () => {
  it("passes through a real reported limitation", () => {
    expect(normalizePhysicalLimitation("joelho")).toBe("joelho");
    expect(normalizePhysicalLimitation("  costas  ")).toBe("costas");
  });

  it("treats empty/blank input as no limitation", () => {
    expect(normalizePhysicalLimitation(undefined)).toBeUndefined();
    expect(normalizePhysicalLimitation(null)).toBeUndefined();
    expect(normalizePhysicalLimitation("")).toBeUndefined();
    expect(normalizePhysicalLimitation("   ")).toBeUndefined();
  });

  it("treats common 'no limitation' phrases as no limitation, case-insensitively", () => {
    // This is the exact defect seen live in Histórico: a founder (or test
    // session) typing "nenhuma" into the optional field produced "Reportaste
    // uma limitação física hoje (nenhuma)" and incorrectly triggered the
    // mobility-instead-of-training rule.
    expect(normalizePhysicalLimitation("nenhuma")).toBeUndefined();
    expect(normalizePhysicalLimitation("Nenhuma")).toBeUndefined();
    expect(normalizePhysicalLimitation("NENHUM")).toBeUndefined();
    expect(normalizePhysicalLimitation("não")).toBeUndefined();
    expect(normalizePhysicalLimitation("n/a")).toBeUndefined();
    expect(normalizePhysicalLimitation("-")).toBeUndefined();
  });
});
