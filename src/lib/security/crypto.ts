import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { getAuthSecret } from "@/lib/auth/secret";

/**
 * Encryption for stored secrets (orchestration plan, Phases 9–10).
 *
 * Envelope encryption: every value gets its own random data key (AES-256-GCM); the data key is wrapped with a
 * master key from the key ring. Format:
 *
 *   v2:<keyId>:<wrapped data key>:<iv>:<tag>:<data>        (base64url parts)
 *
 * Key ring, first key active, the rest kept to decrypt older values:
 *   SECRETS_MASTER_KEYS="k2:<32 bytes base64 or hex>,k1:<...>"
 * Without it: SECRETS_ENCRYPTION_KEY (key id "k0"), or a key derived from AUTH_SECRET (key id "auth").
 *
 * Rotation: put a new key first in SECRETS_MASTER_KEYS and run `pnpm secrets:rotate`, which re-wraps every stored
 * value with the active key (see src/lib/security/vault.ts); then the old key can be removed.
 * The wrap step is the seam for a cloud KMS: `wrapKey` / `unwrapKey` are the only places a master key is used.
 *
 * "v1:" values (Phase 9: one key, no envelope) are still decrypted and are upgraded by rotation.
 */

type MasterKey = { id: string; key: Buffer };

function parseKey(raw: string, name: string): Buffer {
  const value = raw.trim();
  const key = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error(`${name} must be 32 bytes (64 hex characters or base64).`);
  return key;
}

/** The key ring, active key first. */
export function masterKeys(env: NodeJS.ProcessEnv = process.env): MasterKey[] {
  const ring = env.SECRETS_MASTER_KEYS?.trim();
  if (ring) {
    const keys = ring.split(",").map((entry) => {
      const [id, material] = entry.split(":");
      if (!id || !material || !/^[A-Za-z0-9_-]{1,16}$/.test(id)) throw new Error("SECRETS_MASTER_KEYS entries look like <id>:<key>, e.g. k2:BASE64.");
      return { id, key: parseKey(material, `SECRETS_MASTER_KEYS (${id})`) };
    });
    if (new Set(keys.map((k) => k.id)).size !== keys.length) throw new Error("SECRETS_MASTER_KEYS has a repeated key id.");
    return keys;
  }
  if (env.SECRETS_ENCRYPTION_KEY?.trim()) return [{ id: "k0", key: parseKey(env.SECRETS_ENCRYPTION_KEY, "SECRETS_ENCRYPTION_KEY") }];
  return [{ id: "auth", key: legacyKey(env) }];
}

/** The single key used by v1 values. */
function legacyKey(env: NodeJS.ProcessEnv): Buffer {
  if (env.SECRETS_ENCRYPTION_KEY?.trim()) return parseKey(env.SECRETS_ENCRYPTION_KEY, "SECRETS_ENCRYPTION_KEY");
  return Buffer.from(hkdfSync("sha256", getAuthSecret(env), "steve-secrets", "steve:stored-secrets:v1", 32));
}

export function activeKeyId(env: NodeJS.ProcessEnv = process.env): string {
  return masterKeys(env)[0].id;
}

function seal(key: Buffer, plaintext: Buffer): { iv: Buffer; tag: Buffer; data: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), data };
}

function open(key: Buffer, iv: Buffer, tag: Buffer, data: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

const b64 = (buffer: Buffer) => buffer.toString("base64url");
const unb64 = (text: string) => Buffer.from(text, "base64url");

/** Wrap a data key with a master key (the KMS seam). */
function wrapKey(master: MasterKey, dataKey: Buffer): string {
  const { iv, tag, data } = seal(master.key, dataKey);
  return [b64(iv), b64(tag), b64(data)].join(".");
}

function unwrapKey(master: MasterKey, wrapped: string): Buffer {
  const [iv, tag, data] = wrapped.split(".");
  if (!iv || !tag || !data) throw new Error("Malformed wrapped key.");
  return open(master.key, unb64(iv), unb64(tag), unb64(data));
}

export function encryptSecret(plaintext: string, env: NodeJS.ProcessEnv = process.env): string {
  const master = masterKeys(env)[0];
  const dataKey = randomBytes(32);
  const { iv, tag, data } = seal(dataKey, Buffer.from(plaintext, "utf8"));
  return ["v2", master.id, wrapKey(master, dataKey), b64(iv), b64(tag), b64(data)].join(":");
}

export function decryptSecret(ciphertext: string, env: NodeJS.ProcessEnv = process.env): string {
  const parts = ciphertext.split(":");
  if (parts[0] === "v1" && parts.length === 4) {
    return open(legacyKey(env), unb64(parts[1]), unb64(parts[2]), unb64(parts[3])).toString("utf8");
  }
  if (parts[0] === "v2" && parts.length === 6) {
    const [, keyId, wrapped, iv, tag, data] = parts;
    const master = masterKeys(env).find((k) => k.id === keyId);
    if (!master) throw new Error(`The key "${keyId}" this value was encrypted with is not in the key ring.`);
    return open(unwrapKey(master, wrapped), unb64(iv), unb64(tag), unb64(data)).toString("utf8");
  }
  throw new Error("Unrecognised encrypted value.");
}

/** True when the value is not encrypted with the active key (an older key, or the v1 format). */
export function needsRewrap(ciphertext: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const parts = ciphertext.split(":");
  return !(parts[0] === "v2" && parts[1] === activeKeyId(env));
}

export function isEncryptedValue(value: string | null | undefined): value is string {
  return !!value && (value.startsWith("v1:") || value.startsWith("v2:"));
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
