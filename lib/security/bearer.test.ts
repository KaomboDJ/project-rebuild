import { describe, expect, it } from "vitest";
import { hasValidBearerToken } from "./bearer";

describe("hasValidBearerToken", () => {
  it("accepts only the exact bearer token", () => {
    expect(hasValidBearerToken("Bearer correct-secret", "correct-secret")).toBe(true);
    expect(hasValidBearerToken("Bearer wrong-secret", "correct-secret")).toBe(false);
  });

  it("rejects malformed and absent headers", () => {
    expect(hasValidBearerToken(null, "secret")).toBe(false);
    expect(hasValidBearerToken("secret", "secret")).toBe(false);
    expect(hasValidBearerToken("Basic secret", "secret")).toBe(false);
  });
});
