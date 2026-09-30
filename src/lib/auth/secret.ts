const DEV_FALLBACK_SECRET = "cofounder-local-dev-session-secret";
const PLACEHOLDER_SECRETS = new Set(["", "replace-me-for-provider-mode"]);
const MIN_PRODUCTION_SECRET_LENGTH = 32;

/**
 * Secret used to sign session cookies.
 *
 * Development keeps a fallback so a fresh clone works. Production refuses to
 * start signing with a missing, placeholder or short secret, because a known
 * secret lets anyone forge a session cookie.
 */
export function getAuthSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.AUTH_SECRET?.trim() ?? "";

  if (env.NODE_ENV === "production") {
    if (PLACEHOLDER_SECRETS.has(secret) || secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
      throw new Error(
        `AUTH_SECRET must be set to a random value of at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production.`
      );
    }
    return secret;
  }

  return PLACEHOLDER_SECRETS.has(secret) ? DEV_FALLBACK_SECRET : secret;
}
