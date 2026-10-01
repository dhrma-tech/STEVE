import { createHmac, timingSafeEqual } from "node:crypto";
import { getAuthSecret } from "@/lib/auth/secret";

/**
 * Signed links that let a founder approve or deny from an email without signing in.
 *
 * A token names one approval, one decision and the person it was sent to, and expires. It is single-use because an
 * approval can be answered only once. The signing key is derived from AUTH_SECRET for this purpose only, so a token
 * can never pass as a session cookie or the other way round. Opening the link shows a confirmation page; nothing
 * happens on a GET, so email scanners that follow links cannot approve anything.
 */

export type OneTapDecision = "approve" | "deny";
export type OneTapClaims = { approvalId: string; decision: OneTapDecision; userId: string; expiresAt: number };

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function key(env: NodeJS.ProcessEnv = process.env): Buffer {
  return createHmac("sha256", getAuthSecret(env)).update("steve:one-tap-approval:v1").digest();
}

const b64 = (value: string | Buffer) => Buffer.from(value).toString("base64url");

export function createOneTapToken(
  claims: Omit<OneTapClaims, "expiresAt">,
  options: { ttlMs?: number; now?: number; env?: NodeJS.ProcessEnv } = {}
): string {
  const expiresAt = (options.now ?? Date.now()) + (options.ttlMs ?? DEFAULT_TTL_MS);
  const body = b64(JSON.stringify({ a: claims.approvalId, d: claims.decision, u: claims.userId, e: expiresAt }));
  const signature = createHmac("sha256", key(options.env)).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export type VerifyResult = { ok: true; claims: OneTapClaims } | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyOneTapToken(token: string, options: { now?: number; env?: NodeJS.ProcessEnv } = {}): VerifyResult {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return { ok: false, reason: "malformed" };
  const expected = createHmac("sha256", key(options.env)).update(body).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad_signature" };

  let parsed: { a?: unknown; d?: unknown; u?: unknown; e?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as typeof parsed;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof parsed.a !== "string" || typeof parsed.u !== "string" || typeof parsed.e !== "number" || (parsed.d !== "approve" && parsed.d !== "deny")) {
    return { ok: false, reason: "malformed" };
  }
  if (parsed.e < (options.now ?? Date.now())) return { ok: false, reason: "expired" };
  return { ok: true, claims: { approvalId: parsed.a, decision: parsed.d, userId: parsed.u, expiresAt: parsed.e } };
}

export function appUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

export function oneTapUrl(token: string, env: NodeJS.ProcessEnv = process.env): string {
  return `${appUrl(env)}/approve/${token}`;
}
