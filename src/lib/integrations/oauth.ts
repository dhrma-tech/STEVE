import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { appUrl } from "@/lib/agents/policy/one-tap";
import { decryptSecret, encryptSecret, randomToken, safeEqual } from "@/lib/security/crypto";
import { readOrgCredential, setOrgCredential, publicConfig } from "@/lib/security/vault";
import { audit } from "@/lib/security/audit";

/**
 * OAuth connect flows for integrations (orchestration plan, Phase 10): GitHub, Vercel, Stripe Connect, Supabase.
 *
 *   1. GET /api/orgs/:orgId/integrations/:provider/oauth   (owner/admin) → redirect to the provider
 *   2. GET /api/oauth/:provider/callback                    → exchange the code, store tokens in the vault
 *
 * The `state` parameter is encrypted (org, user, provider, PKCE verifier, nonce, expiry) and the nonce is also set as
 * an http-only cookie, so a callback only completes in the browser that started it, for the user who started it,
 * within ten minutes. PKCE (S256) is used where the provider supports it. Tokens never leave the server.
 *
 * Each provider is enabled by its client id and secret in the environment; without them the UI keeps the manual
 * (paste a key) connect.
 */

export type OAuthProvider = "github" | "vercel" | "stripe" | "supabase";

type ProviderConfig = {
  label: string;
  clientId: (env: NodeJS.ProcessEnv) => string | undefined;
  clientSecret: (env: NodeJS.ProcessEnv) => string | undefined;
  authorizeUrl: (env: NodeJS.ProcessEnv) => string;
  tokenUrl: string;
  scope?: string;
  pkce: boolean;
  /** Send the client credentials as HTTP Basic auth (otherwise in the form body). */
  basicAuth?: boolean;
  /** Vault field for the access token (what the provider's tools read). */
  tokenField: string;
  /** Non-secret settings to keep from the token response. */
  settingsFrom?: (response: Record<string, unknown>) => Record<string, unknown>;
};

const str = (value: unknown) => (typeof value === "string" ? value : undefined);

export const OAUTH_PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
  github: {
    label: "GitHub",
    clientId: (env) => env.GITHUB_INTEGRATION_CLIENT_ID ?? env.GITHUB_CLIENT_ID,
    clientSecret: (env) => env.GITHUB_INTEGRATION_CLIENT_SECRET ?? env.GITHUB_CLIENT_SECRET,
    authorizeUrl: () => "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "repo read:user",
    pkce: true,
    tokenField: "token"
  },
  vercel: {
    label: "Vercel",
    clientId: (env) => env.VERCEL_CLIENT_ID,
    clientSecret: (env) => env.VERCEL_CLIENT_SECRET,
    // Vercel connects through the integration's install page, which redirects back with a code.
    authorizeUrl: (env) => `https://vercel.com/integrations/${env.VERCEL_INTEGRATION_SLUG ?? "steve"}/new`,
    tokenUrl: "https://api.vercel.com/v2/oauth/access_token",
    pkce: false,
    tokenField: "token",
    settingsFrom: (r) => ({ teamId: str(r.team_id) ?? null, installationId: str(r.installation_id) ?? null })
  },
  stripe: {
    label: "Stripe",
    clientId: (env) => env.STRIPE_CONNECT_CLIENT_ID,
    // Stripe Connect authenticates the token exchange with the platform's secret key.
    clientSecret: (env) => env.STRIPE_SECRET_KEY,
    authorizeUrl: () => "https://connect.stripe.com/oauth/authorize",
    tokenUrl: "https://connect.stripe.com/oauth/token",
    scope: "read_write",
    pkce: false,
    tokenField: "secretKey",
    settingsFrom: (r) => ({ stripeUserId: str(r.stripe_user_id) ?? null, livemode: r.livemode === true })
  },
  supabase: {
    label: "Supabase",
    clientId: (env) => env.SUPABASE_OAUTH_CLIENT_ID,
    clientSecret: (env) => env.SUPABASE_OAUTH_CLIENT_SECRET,
    authorizeUrl: () => "https://api.supabase.com/v1/oauth/authorize",
    tokenUrl: "https://api.supabase.com/v1/oauth/token",
    pkce: true,
    basicAuth: true,
    tokenField: "accessToken"
  }
};

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value in OAUTH_PROVIDERS;
}

export function oauthAvailable(provider: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isOAuthProvider(provider)) return false;
  const config = OAUTH_PROVIDERS[provider];
  return !!config.clientId(env)?.trim() && !!config.clientSecret(env)?.trim();
}

export const OAUTH_NONCE_COOKIE = "steve_oauth_nonce";
const STATE_TTL_MS = 10 * 60 * 1000;

export function redirectUri(provider: OAuthProvider): string {
  return `${appUrl()}/api/oauth/${provider}/callback`;
}

type State = { orgId: string; userId: string; provider: OAuthProvider; verifier: string | null; nonce: string; exp: number };

const challenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

/** The provider's authorize URL and the nonce to set as a cookie. */
export function startOAuth(params: { orgId: string; userId: string; provider: OAuthProvider; now?: number }): { url: string; nonce: string } {
  const config = OAUTH_PROVIDERS[params.provider];
  const clientId = config.clientId(process.env);
  if (!clientId || !oauthAvailable(params.provider)) throw new OAuthError(`${config.label} sign-in is not set up on this server.`);
  const nonce = randomToken(16);
  const verifier = config.pkce ? randomToken(48) : null;
  const state: State = { orgId: params.orgId, userId: params.userId, provider: params.provider, verifier, nonce, exp: (params.now ?? Date.now()) + STATE_TTL_MS };
  const url = new URL(config.authorizeUrl(process.env));
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri(params.provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", encryptSecret(JSON.stringify(state)));
  if (config.scope) url.searchParams.set("scope", config.scope);
  if (verifier) {
    url.searchParams.set("code_challenge", challenge(verifier));
    url.searchParams.set("code_challenge_method", "S256");
  }
  return { url: url.toString(), nonce };
}

export class OAuthError extends Error {}

function readState(raw: string | null, provider: OAuthProvider, nonce: string | undefined, userId: string, now: number): State {
  if (!raw) throw new OAuthError("The sign-in response had no state.");
  let state: State;
  try {
    state = JSON.parse(decryptSecret(raw)) as State;
  } catch {
    throw new OAuthError("The sign-in response could not be verified.");
  }
  if (state.provider !== provider) throw new OAuthError("The sign-in response was for a different service.");
  if (!nonce || !safeEqual(nonce, state.nonce)) throw new OAuthError("Finish the connection in the same browser you started it in.");
  if (state.userId !== userId) throw new OAuthError("The connection was started by a different user.");
  if (state.exp < now) throw new OAuthError("The sign-in took too long. Start again.");
  return state;
}

type TokenResponse = Record<string, unknown> & { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };

async function tokenRequest(provider: OAuthProvider, form: Record<string, string>, fetchImpl: typeof fetch): Promise<TokenResponse> {
  const config = OAUTH_PROVIDERS[provider];
  const clientId = config.clientId(process.env)!;
  const clientSecret = config.clientSecret(process.env)!;
  const body = new URLSearchParams(config.basicAuth ? form : { ...form, client_id: clientId, client_secret: clientSecret });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (config.basicAuth) headers.authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  const response = await fetchImpl(config.tokenUrl, { method: "POST", headers, body, signal: AbortSignal.timeout(15_000) });
  const data = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || data.error || !data.access_token) {
    throw new OAuthError(`${config.label} refused the connection: ${data.error_description ?? data.error ?? `HTTP ${response.status}`}`);
  }
  return data;
}

async function storeTokens(orgId: string, provider: OAuthProvider, data: TokenResponse, userId: string | null) {
  const config = OAUTH_PROVIDERS[provider];
  const integration = await prisma.integration.findFirst({ where: { organizationId: orgId, provider } });
  const integrationId = integration?.id ?? null;
  await setOrgCredential({ orgId, provider, field: config.tokenField, value: data.access_token!, integrationId, userId });
  if (data.refresh_token) await setOrgCredential({ orgId, provider, field: "refreshToken", value: data.refresh_token, integrationId, userId });
  const settings = {
    ...publicConfig(integration?.configJson ?? null),
    ...(config.settingsFrom?.(data) ?? {}),
    oauth: true,
    connectedAt: new Date().toISOString(),
    sandbox: false,
    accessExpiresAt: typeof data.expires_in === "number" ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null
  };
  if (integration) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "connected", mode: "live", configJson: JSON.stringify(settings), lastCheckedAt: new Date(), errorMessage: null }
    });
  } else {
    await prisma.integration.create({
      data: { organizationId: orgId, provider, status: "connected", mode: "live", displayName: config.label, configJson: JSON.stringify(settings) }
    });
  }
}

/** Complete the callback: verify state, exchange the code, store the tokens. Returns the org to send the user back to. */
export async function completeOAuth(params: {
  provider: OAuthProvider;
  code: string | null;
  state: string | null;
  nonceCookie: string | undefined;
  userId: string;
  isOrgAdmin: (orgId: string) => Promise<boolean>;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<{ orgId: string }> {
  const state = readState(params.state, params.provider, params.nonceCookie, params.userId, params.now ?? Date.now());
  if (!(await params.isOrgAdmin(state.orgId))) throw new OAuthError("Only owners and admins can connect integrations.");
  if (!params.code) throw new OAuthError("The service did not return an authorization code.");
  const data = await tokenRequest(
    params.provider,
    {
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: redirectUri(params.provider),
      ...(state.verifier ? { code_verifier: state.verifier } : {})
    },
    params.fetchImpl ?? fetch
  );
  await storeTokens(state.orgId, params.provider, data, params.userId);
  await audit({ orgId: state.orgId, actorUserId: params.userId, action: "integration.oauth_connected", targetType: "integration", targetId: params.provider });
  return { orgId: state.orgId };
}

/**
 * The provider's access token, refreshed first when it expires within two minutes and a refresh token is stored.
 * Null when there is no token.
 */
export async function getOAuthAccessToken(orgId: string, provider: OAuthProvider, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const config = OAUTH_PROVIDERS[provider];
  const token = await readOrgCredential(orgId, provider, config.tokenField);
  if (!token) return null;
  const integration = await prisma.integration.findFirst({ where: { organizationId: orgId, provider }, select: { configJson: true } });
  const settings = publicConfig(integration?.configJson ?? null);
  const expiresAt = typeof settings.accessExpiresAt === "string" ? Date.parse(settings.accessExpiresAt) : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt - Date.now() > 2 * 60 * 1000) return token;
  const refreshToken = await readOrgCredential(orgId, provider, "refreshToken");
  if (!refreshToken || !oauthAvailable(provider)) return token;
  const data = await tokenRequest(provider, { grant_type: "refresh_token", refresh_token: refreshToken }, fetchImpl);
  await storeTokens(orgId, provider, data, null);
  return data.access_token!;
}
