import { prisma } from "@/lib/db/client";
import { redactCardNumbers, redactPii } from "./pii-patterns";

export { redactCardNumbers, redactPii };

/**
 * PII redaction for stored data (orchestration plan, Phase 10).
 *
 *   redactCardNumbers  always applied to tool output and stored events: Luhn-valid 13–19 digit numbers
 *   redactPii          applied when the org turns on "Redact personal data": email addresses and phone numbers
 *
 * Redaction happens before storage, so it covers the event log, replays, the public API and webhooks. It is not
 * applied to what the model sees in the current turn (the agent may need an address to do its job).
 */

// ── Org setting, cached briefly (it is read on every stored event) ───────────

const cache = new Map<string, { value: boolean; until: number }>();

export async function orgRedactsPii(orgId: string): Promise<boolean> {
  const hit = cache.get(orgId);
  if (hit && hit.until > Date.now()) return hit.value;
  const policy = await prisma.policy.findFirst({ where: { organizationId: orgId, agentId: null }, select: { redactPii: true } });
  const value = policy?.redactPii ?? false;
  cache.set(orgId, { value, until: Date.now() + 30_000 });
  return value;
}

export function forgetPiiSetting(orgId: string) {
  cache.delete(orgId);
}

/** What to store for an org: card numbers always removed, other personal data when the org asked for it. */
export async function redactForStorage(orgId: string, text: string): Promise<string> {
  return (await orgRedactsPii(orgId)) ? redactPii(text) : redactCardNumbers(text);
}

/** Apply `redact` to every string inside a JSON-like value (keys and numbers are left alone). */
export function redactStrings<T>(value: T, redact: (text: string) => string): T {
  if (typeof value === "string") return redact(value) as T;
  if (Array.isArray(value)) return value.map((item) => redactStrings(item, redact)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, redactStrings(v, redact)])) as T;
  }
  return value;
}

/** A JSON-like value prepared for storage under the org's redaction setting. */
export async function redactValueForStorage<T>(orgId: string, value: T): Promise<T> {
  const full = await orgRedactsPii(orgId);
  return redactStrings(value, full ? redactPii : redactCardNumbers);
}
