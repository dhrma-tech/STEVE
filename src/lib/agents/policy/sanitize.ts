const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g, //                                   Anthropic
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, //                           OpenAI
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g, //                  GitHub tokens
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g, //                              GitHub fine-grained
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, //                              Slack
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/g, //                  Stripe
  /\bwhsec_[A-Za-z0-9]{10,}/g, //                                    Stripe webhook
  /\bAKIA[0-9A-Z]{16}\b/g, //                                        AWS access key id
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g // JWT
];
const BEARER = /(Bearer\s+)[A-Za-z0-9._~+/=-]{20,}/gi;

/** Environment variables whose values must never reach a model, the event stream or the audit log. */
const SECRET_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GITHUB_TOKEN",
  "GITHUB_CLIENT_SECRET",
  "VERCEL_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "BRAVE_SEARCH_API_KEY",
  "AUTH_SECRET"
];

export const REDACTED = "[REDACTED]";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace anything that looks like a credential, and any configured secret value, with a marker. */
export function redactSecrets(text: string, env: NodeJS.ProcessEnv = process.env): string {
  let out = text;
  for (const key of SECRET_ENV_KEYS) {
    const value = env[key]?.trim();
    if (value && value.length >= 8) out = out.replace(new RegExp(escapeRegExp(value), "g"), REDACTED);
  }
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, REDACTED);
  return out.replace(BEARER, `$1${REDACTED}`);
}

export const DEFAULT_TOOL_OUTPUT_LIMIT = 12_000;

/** Keep tool output from flooding the model context or the database. */
export function capOutput(text: string, max = DEFAULT_TOOL_OUTPUT_LIMIT): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[output truncated: ${text.length - max} more characters]`;
}

/** What is safe to hand back to the model and store: redacted first, then capped. */
export function sanitizeToolOutput(text: string): string {
  return capOutput(redactSecrets(text));
}
