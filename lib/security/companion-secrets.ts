import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { requireCompanionSecurityEnvironment } from "@/lib/env/server";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PAIRING_LENGTH = 16;
const DEVICE_TOKEN_PREFIX = "rbd_v1_";

function encodeCrockford(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += CROCKFORD[(value << (5 - bits)) & 31];
  return output;
}

export function normalizePairingCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

export function formatPairingCode(value: string): string {
  const normalized = normalizePairingCode(value);
  return normalized.match(/.{1,4}/g)?.join("-") ?? normalized;
}

export function isValidPairingCode(value: string): boolean {
  const normalized = normalizePairingCode(value);
  return normalized.length === PAIRING_LENGTH && [...normalized].every((char) => CROCKFORD.includes(char));
}

export function generatePairingCode(): string {
  return formatPairingCode(encodeCrockford(randomBytes(10)).slice(0, PAIRING_LENGTH));
}

export function generateDeviceToken(): string {
  return `${DEVICE_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function isValidDeviceToken(value: string): boolean {
  return /^rbd_v1_[A-Za-z0-9_-]{43}$/.test(value);
}

export function hmacCompanionSecret(value: string, key: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

export function hashPairingCode(code: string): string {
  const { COMPANION_HMAC_KEY } = requireCompanionSecurityEnvironment();
  return hmacCompanionSecret(`pair:${normalizePairingCode(code)}`, COMPANION_HMAC_KEY);
}

export function hashDeviceToken(token: string): string {
  const { COMPANION_HMAC_KEY } = requireCompanionSecurityEnvironment();
  return hmacCompanionSecret(`device:${token}`, COMPANION_HMAC_KEY);
}

