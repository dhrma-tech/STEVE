import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { getAuthSecret } from "@/lib/auth/secret";

/**
 * Encryption for stored values the app must read back (channel URLs, webhook signing secrets).
 *
 * AES-256-GCM with a key from SECRETS_ENCRYPTION_KEY (32 bytes, base64 or hex), or derived from AUTH_SECRET with HKDF
 * when that is not set. Ciphertext format: "v1:<iv>:<tag>:<data>" (base64url). Phase 10 replaces the key source with
 * a KMS-backed master key and rotation; the format carries a version so old values can be re-encrypted.
 */

const VERSION = "v1";

function encryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.SECRETS_ENCRYPTION_KEY?.trim();
  if (raw) {
    const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (key.length !== 32) throw new Error("SECRETS_ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64).");
    return key;
  }
  return Buffer.from(hkdfSync("sha256", getAuthSecret(env), "steve-secrets", "steve:stored-secrets:v1", 32));
}

export function encryptSecret(plaintext: string, env: NodeJS.ProcessEnv = process.env): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(env), iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

export function decryptSecret(ciphertext: string, env: NodeJS.ProcessEnv = process.env): string {
  const [version, iv, tag, data] = ciphertext.split(":");
  if (version !== VERSION || !iv || !tag || data === undefined) throw new Error("Unrecognised encrypted value.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(env), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** A random token for URLs and keys (base64url, no padding). */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256Hex(secret: string | Buffer, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Constant-time comparison of two strings (false when the lengths differ). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
