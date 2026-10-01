import { prisma } from "@/lib/db/client";
import { decryptSecret, encryptSecret, isEncryptedValue, needsRewrap } from "./crypto";

/**
 * Per-org credential vault (orchestration plan, Phase 10).
 *
 * Integration credentials (API tokens, OAuth tokens, service keys) are stored encrypted in the `Secret` table under
 * environment "integration" with keys like GITHUB_TOKEN, SUPABASE_SERVICE_ROLE_KEY, STRIPE_OAUTH. Values are never
 * returned to the browser; tools read them server-side with `getOrgCredential`.
 *
 * Global environment variables (GITHUB_TOKEN, STRIPE_SECRET_KEY, ...) are a development convenience: they are used
 * only when no org credential exists and either NODE_ENV is not production or ALLOW_GLOBAL_TOOL_CREDENTIALS=1.
 * In production every org brings its own credentials.
 */

export const VAULT_ENVIRONMENT = "integration";

/** `serviceRoleKey` → `SERVICE_ROLE_KEY`; `github` + `token` → `GITHUB_TOKEN`. */
export function credentialKey(provider: string, field: string): string {
  const snake = (text: string) =>
    text
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();
  return `${snake(provider)}_${snake(field)}`;
}

/** Field names that hold credentials. Anything matching is stored in the vault, never in plain config. */
export function isSecretField(field: string): boolean {
  return /(token|secret|password|passwd|api[_-]?key|private[_-]?key|service[_-]?role|credential|^key$|Key$)/i.test(field);
}

export function globalCredentialsAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ALLOW_GLOBAL_TOOL_CREDENTIALS === "1" || env.NODE_ENV !== "production";
}

export async function setOrgCredential(params: {
  orgId: string;
  provider: string;
  field: string;
  value: string;
  integrationId?: string | null;
  userId?: string | null;
}): Promise<void> {
  const key = credentialKey(params.provider, params.field);
  const valueCiphertext = encryptSecret(params.value);
  await prisma.secret.upsert({
    where: { organizationId_environment_key: { organizationId: params.orgId, environment: VAULT_ENVIRONMENT, key } },
    update: { valueCiphertext, integrationId: params.integrationId ?? undefined, isWriteOnly: true, rotatedAt: new Date() },
    create: {
      organizationId: params.orgId,
      integrationId: params.integrationId ?? null,
      environment: VAULT_ENVIRONMENT,
      key,
      valueCiphertext,
      isWriteOnly: true,
      createdByUserId: params.userId ?? null
    }
  });
}

export async function deleteOrgCredentials(orgId: string, provider: string): Promise<number> {
  const { count } = await prisma.secret.deleteMany({
    where: { organizationId: orgId, environment: VAULT_ENVIRONMENT, key: { startsWith: `${credentialKey(provider, "x").slice(0, -1)}` } }
  });
  return count;
}

/** The org's credential, or null. Reads only the vault. */
export async function readOrgCredential(orgId: string, provider: string, field: string): Promise<string | null> {
  const row = await prisma.secret.findUnique({
    where: { organizationId_environment_key: { organizationId: orgId, environment: VAULT_ENVIRONMENT, key: credentialKey(provider, field) } },
    select: { valueCiphertext: true }
  });
  if (!row || !isEncryptedValue(row.valueCiphertext)) return null;
  try {
    return decryptSecret(row.valueCiphertext);
  } catch {
    return null;
  }
}

/**
 * The credential a tool should use: the org's own, else (outside production, or when explicitly allowed) the global
 * environment variable.
 */
export async function getOrgCredential(orgId: string, provider: string, field: string, envVar?: string): Promise<string | null> {
  const own = await readOrgCredential(orgId, provider, field);
  if (own) return own;
  const name = envVar ?? credentialKey(provider, field);
  return globalCredentialsAllowed() ? process.env[name]?.trim() || null : null;
}

/** Which credential fields an org has stored for a provider (names only). */
export async function listOrgCredentialFields(orgId: string, provider: string): Promise<string[]> {
  const prefix = credentialKey(provider, "x").slice(0, -1);
  const rows = await prisma.secret.findMany({
    where: { organizationId: orgId, environment: VAULT_ENVIRONMENT, key: { startsWith: prefix } },
    select: { key: true }
  });
  return rows.map((row) => row.key.slice(prefix.length).toLowerCase());
}

// ── Key rotation ──────────────────────────────────────────────────────────────

export type RotationReport = { checked: number; rewrapped: number; failed: number };

/**
 * Re-encrypt every stored secret that is not under the active master key: vault and env-file secrets, channel URLs
 * and signing secrets, trigger signing secrets. Values that cannot be decrypted (a removed key) are counted, left as
 * they are, and reported.
 */
export async function rotateStoredSecrets(): Promise<RotationReport> {
  const report: RotationReport = { checked: 0, rewrapped: 0, failed: 0 };
  const rewrap = (value: string | null): string | null => {
    if (!isEncryptedValue(value)) return null;
    report.checked += 1;
    if (!needsRewrap(value)) return null;
    try {
      const next = encryptSecret(decryptSecret(value));
      report.rewrapped += 1;
      return next;
    } catch {
      report.failed += 1;
      return null;
    }
  };

  for (const secret of await prisma.secret.findMany({ select: { id: true, valueCiphertext: true } })) {
    const next = rewrap(secret.valueCiphertext);
    if (next) await prisma.secret.update({ where: { id: secret.id }, data: { valueCiphertext: next, rotatedAt: new Date() } });
  }
  for (const channel of await prisma.notificationChannel.findMany({ select: { id: true, urlCiphertext: true, secretCiphertext: true } })) {
    const url = rewrap(channel.urlCiphertext);
    const secret = rewrap(channel.secretCiphertext);
    if (url || secret) await prisma.notificationChannel.update({ where: { id: channel.id }, data: { ...(url ? { urlCiphertext: url } : {}), ...(secret ? { secretCiphertext: secret } : {}) } });
  }
  for (const trigger of await prisma.trigger.findMany({ select: { id: true, signingSecretCiphertext: true } })) {
    const next = rewrap(trigger.signingSecretCiphertext);
    if (next) await prisma.trigger.update({ where: { id: trigger.id }, data: { signingSecretCiphertext: next } });
  }
  return report;
}

/**
 * Move credentials that older versions kept in plain `Integration.configJson` into the vault, and strip them from
 * the config. Safe to run repeatedly.
 */
export async function migratePlaintextIntegrationCredentials(): Promise<number> {
  let moved = 0;
  for (const integration of await prisma.integration.findMany({ where: { configJson: { not: null } } })) {
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(integration.configJson ?? "{}") as Record<string, unknown>;
    } catch {
      continue;
    }
    const secrets = Object.entries(config).filter(([field, value]) => isSecretField(field) && typeof value === "string" && value.trim());
    if (secrets.length === 0) continue;
    for (const [field, value] of secrets) {
      await setOrgCredential({ orgId: integration.organizationId, provider: integration.provider, field, value: String(value), integrationId: integration.id });
      delete config[field];
      moved += 1;
    }
    await prisma.integration.update({ where: { id: integration.id }, data: { configJson: JSON.stringify(config) } });
  }
  return moved;
}

/** An integration's non-secret settings (project ref, URLs, sender address). Secret-looking fields are dropped. */
export async function integrationSettings(orgId: string, provider: string): Promise<Record<string, unknown>> {
  const integration = await prisma.integration.findFirst({ where: { organizationId: orgId, provider }, select: { configJson: true } });
  return publicConfig(integration?.configJson ?? null);
}

/** Parse an integration config and drop anything that looks like a credential (for responses and settings reads). */
export function publicConfig(configJson: string | null): Record<string, unknown> {
  if (!configJson) return {};
  try {
    const config = JSON.parse(configJson) as unknown;
    if (!config || typeof config !== "object" || Array.isArray(config)) return {};
    return Object.fromEntries(Object.entries(config as Record<string, unknown>).filter(([field]) => !isSecretField(field)));
  } catch {
    return {};
  }
}
