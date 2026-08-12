import { timingSafeEqual } from "node:crypto";

/**
 * Compare an Authorization bearer value without leaking a useful timing
 * signal. The length check deliberately happens before timingSafeEqual,
 * because Node requires equally sized buffers.
 */
export function hasValidBearerToken(header: string | null, expected: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice("Bearer ".length), "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}
