import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { assertTrustedBrowserOrigin, readBoundedJson, RequestSecurityError } from "./request";

describe("request security", () => {
  it("rejects declared and actual oversized bodies", async () => {
    const declared = new NextRequest("https://rebuild.test/api", {
      method: "POST",
      headers: { "content-length": "100" },
      body: "{}",
    });
    await expect(readBoundedJson(declared, 10)).rejects.toMatchObject({ code: "body-too-large" });

    const actual = new NextRequest("https://rebuild.test/api", { method: "POST", body: JSON.stringify({ x: "123456" }) });
    await expect(readBoundedJson(actual, 5)).rejects.toMatchObject({ code: "body-too-large" });
  });

  it("rejects malformed JSON", async () => {
    const request = new NextRequest("https://rebuild.test/api", { method: "POST", body: "{" });
    await expect(readBoundedJson(request)).rejects.toMatchObject({ code: "invalid-json" });
  });

  it("allows same-origin browser mutations and blocks cross-origin ones", () => {
    expect(() => assertTrustedBrowserOrigin(new NextRequest("https://rebuild.test/api", { headers: { origin: "https://rebuild.test" } }))).not.toThrow();
    expect(() => assertTrustedBrowserOrigin(new NextRequest("https://rebuild.test/api", { headers: { origin: "https://evil.test" } }))).toThrow(RequestSecurityError);
  });
});
