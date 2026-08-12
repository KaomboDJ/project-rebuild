import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };
const nextConfig = createRequire(import.meta.url)("../../next.config.js") as {
  headers: () => Promise<HeaderRule[]>;
};

describe("security headers", () => {
  it("denies framing, cleartext downgrades and ambient browser capabilities", async () => {
    const rules = await nextConfig.headers();
    const headers = new Map(rules[0].headers.map(({ key, value }) => [key, value]));
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Strict-Transport-Security")).toContain("includeSubDomains");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(headers.get("Content-Security-Policy")).toContain("upgrade-insecure-requests");
  });
});
