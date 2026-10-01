import type { ApiKey } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { randomToken, safeEqual, sha256Hex } from "@/lib/security/crypto";

/**
 * Keys for the public API (/api/v1, orchestration plan Phase 9).
 *
 * A key looks like `stv_<10-char id><32-char secret>`. Only its SHA-256 is stored; the first 14 characters
 * (`stv_` + id) are kept in clear to find the row and to tell keys apart in the UI. A key is shown once.
 */

export const API_SCOPES = ["runs:read", "runs:write"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

const PREFIX_LENGTH = 14;

function scopesOf(key: Pick<ApiKey, "scopesJson">): ApiScope[] {
  try {
    const value = JSON.parse(key.scopesJson) as unknown;
    return Array.isArray(value) ? value.filter((s): s is ApiScope => (API_SCOPES as readonly string[]).includes(s as string)) : [];
  } catch {
    return [];
  }
}

export async function createApiKey(orgId: string, userId: string | null, name: string, scopes: string[] = [...API_SCOPES]) {
  const valid = scopes.filter((s): s is ApiScope => (API_SCOPES as readonly string[]).includes(s));
  if (valid.length === 0) throw new Error("Choose at least one scope.");
  const id = randomToken(8).replace(/[-_]/g, "x").slice(0, 10);
  const key = `stv_${id}${randomToken(24).slice(0, 32)}`;
  const row = await prisma.apiKey.create({
    data: {
      organizationId: orgId,
      name: name.trim().slice(0, 80) || "API key",
      prefix: key.slice(0, PREFIX_LENGTH),
      keyHash: sha256Hex(key),
      scopesJson: JSON.stringify(valid),
      createdByUserId: userId
    }
  });
  return { key, apiKey: serializeApiKey(row) };
}

export async function revokeApiKey(orgId: string, keyId: string): Promise<boolean> {
  const { count } = await prisma.apiKey.updateMany({ where: { id: keyId, organizationId: orgId, revokedAt: null }, data: { revokedAt: new Date() } });
  return count > 0;
}

export function serializeApiKey(key: ApiKey) {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    scopes: scopesOf(key),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString()
  };
}

export type SerializedApiKey = ReturnType<typeof serializeApiKey>;

export async function listApiKeys(orgId: string) {
  const keys = await prisma.apiKey.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" } });
  return keys.map(serializeApiKey);
}

export type ApiAuth = { orgId: string; keyId: string; scopes: ApiScope[] };

export class ApiAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403
  ) {
    super(message);
  }
}

/** Authenticate a public API request by its `Authorization: Bearer stv_...` header and check a scope. */
export async function authenticateApiRequest(request: Request, scope: ApiScope): Promise<ApiAuth> {
  const header = request.headers.get("authorization") ?? "";
  const key = header.replace(/^Bearer\s+/i, "").trim();
  if (!key.startsWith("stv_") || key.length < PREFIX_LENGTH + 16) throw new ApiAuthError("Send an API key as `Authorization: Bearer stv_...`.", 401);
  const row = await prisma.apiKey.findUnique({ where: { prefix: key.slice(0, PREFIX_LENGTH) } });
  if (!row || row.revokedAt || !safeEqual(row.keyHash, sha256Hex(key))) throw new ApiAuthError("Invalid or revoked API key.", 401);
  const scopes = scopesOf(row);
  if (!scopes.includes(scope)) throw new ApiAuthError(`This key does not have the ${scope} scope.`, 403);
  // At most one write a minute per key for the last-used time.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return { orgId: row.organizationId, keyId: row.id, scopes };
}
