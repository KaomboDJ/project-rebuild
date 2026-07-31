import { describe, expect, it } from "vitest";
import { DEFAULT_AUTHENTICATED_PATH, isSafeRedirectPath, safeRedirectPath } from "./safe-redirect";

describe("isSafeRedirectPath", () => {
  it("accepts the root path", () => {
    expect(isSafeRedirectPath("/")).toBe(true);
  });

  it("accepts allowlisted app prefixes and their sub-paths", () => {
    expect(isSafeRedirectPath("/today")).toBe(true);
    expect(isSafeRedirectPath("/settings")).toBe(true);
    expect(isSafeRedirectPath("/settings/memory")).toBe(true);
    expect(isSafeRedirectPath("/onboarding")).toBe(true);
    expect(isSafeRedirectPath("/history")).toBe(true);
  });

  it("rejects paths outside the allowlist", () => {
    expect(isSafeRedirectPath("/api/account")).toBe(false);
    expect(isSafeRedirectPath("/random")).toBe(false);
  });

  it("rejects protocol-relative and absolute-URL open-redirect attempts", () => {
    expect(isSafeRedirectPath("//evil.com")).toBe(false);
    expect(isSafeRedirectPath("//evil.com/today")).toBe(false);
    expect(isSafeRedirectPath("https://evil.com")).toBe(false);
    expect(isSafeRedirectPath("http://evil.com/today")).toBe(false);
  });

  it("rejects backslash and encoded scheme-smuggling attempts", () => {
    expect(isSafeRedirectPath("/\\evil.com")).toBe(false);
    expect(isSafeRedirectPath("/%2F%2Fevil.com")).toBe(false);
    expect(isSafeRedirectPath("/today%2F..%2F%2Fevil.com")).toBe(false);
  });

  it("rejects empty/null/undefined", () => {
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
    expect(isSafeRedirectPath("")).toBe(false);
  });

  it("does not throw on malformed percent-encoding", () => {
    expect(isSafeRedirectPath("/today%")).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("passes through a safe path unchanged", () => {
    expect(safeRedirectPath("/settings")).toBe("/settings");
  });

  it("falls back to the default for anything unsafe", () => {
    expect(safeRedirectPath("https://evil.com")).toBe(DEFAULT_AUTHENTICATED_PATH);
    expect(safeRedirectPath(null)).toBe(DEFAULT_AUTHENTICATED_PATH);
    expect(safeRedirectPath("//evil.com")).toBe(DEFAULT_AUTHENTICATED_PATH);
  });
});
