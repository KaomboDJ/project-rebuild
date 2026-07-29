import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getServerEnvironment } from "@/lib/env/server";

// Encrypts calendar_connections access/refresh tokens at rest (Milestone 3,
// docs/09_TECHNICAL_ARCHITECTURE.md). AES-256-GCM: TOKEN_ENCRYPTION_KEY is a
// base64-encoded 32-byte key (see .env.example). Packed format is
// "v1:<ivBase64>:<authTagBase64>:<ciphertextBase64>" so the algorithm/version
// can change later without breaking decryption of already-stored rows.

const ALGORITHM = "aes-256-gcm";
const PACK_VERSION = "v1";

function getKey(): Buffer {
  const { TOKEN_ENCRYPTION_KEY } = getServerEnvironment();
  if (!TOKEN_ENCRYPTION_KEY) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required to encrypt/decrypt calendar tokens.");
  }
  const key = Buffer.from(TOKEN_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).");
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [PACK_VERSION, iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

export function decryptToken(packed: string): string {
  const [version, ivB64, authTagB64, ciphertextB64] = packed.split(":");
  if (version !== PACK_VERSION || !ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted token payload.");
  }
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
