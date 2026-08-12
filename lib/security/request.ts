import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEFAULT_MAX_BODY_BYTES = 512 * 1024;

export class RequestSecurityError extends Error {
  constructor(public readonly code: "body-too-large" | "invalid-json" | "untrusted-origin") {
    super(code);
    this.name = "RequestSecurityError";
  }
}

export async function readBoundedJson(request: NextRequest, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestSecurityError("body-too-large");
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new RequestSecurityError("body-too-large");
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestSecurityError("invalid-json");
  }
}

export function assertTrustedBrowserOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  if (origin !== request.nextUrl.origin) throw new RequestSecurityError("untrusted-origin");
}

export function privateJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

