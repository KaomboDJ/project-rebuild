import { describe, expect, it } from "vitest";
import { titleFrom } from "./conversations";

describe("titleFrom - conversation list titles", () => {
  it("uses the first message verbatim when it's short", () => {
    expect(titleFrom("O que faço para o jantar?")).toBe("O que faço para o jantar?");
  });

  it("truncates long messages to ~60 chars with an ellipsis", () => {
    const long = "a".repeat(120);
    const title = titleFrom(long);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("...")).toBe(true);
  });

  it("collapses internal whitespace/newlines and trims the ends", () => {
    expect(titleFrom("  olá   \n\n como estás?  ")).toBe("olá como estás?");
  });

  it("falls back to a default title for an empty or whitespace-only message", () => {
    expect(titleFrom("   ")).toBe("Nova conversa");
  });
});
