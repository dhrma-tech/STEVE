/**
 * Auth policy helpers — gate previewable / preview-only flows so they
 * never expose themselves in a real production install.
 */

function hasGitHubOAuth(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

/**
 * Preview-mode (sandbox) login is intended for local development and
 * demo deploys. It must be off whenever a real GitHub OAuth app is
 * configured in production.
 *
 * Override with `ENABLE_SANDBOX_LOGIN=1` for staging environments that
 * have GitHub creds but still want the preview path available.
 */
export function isSandboxLoginEnabled(): boolean {
  if (process.env.ENABLE_SANDBOX_LOGIN === "1") return true;
  if (process.env.NODE_ENV === "production" && hasGitHubOAuth()) return false;
  return true;
}

export function isGitHubOAuthConfigured(): boolean {
  return hasGitHubOAuth();
}
