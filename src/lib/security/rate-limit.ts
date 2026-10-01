import { prisma } from "@/lib/db/client";
import { AppError } from "@/lib/utils/error";

/**
 * Rate limits (orchestration plan, Phase 10): fixed windows counted in Postgres, so they hold across server
 * instances and restarts. One atomic upsert per request.
 *
 * Override a bucket with RATE_LIMIT_<BUCKET>=<limit>/<window seconds> (e.g. RATE_LIMIT_RUN_START=60/60), or turn
 * all limits off with RATE_LIMITS=off (tests, local load testing).
 */

export type RateLimitBucket = "auth" | "run_start" | "upload" | "approval" | "api_read" | "api_write" | "hook";

const DEFAULTS: Record<RateLimitBucket, { limit: number; windowSeconds: number }> = {
  auth: { limit: 20, windowSeconds: 15 * 60 }, //         sign-in attempts per IP
  run_start: { limit: 30, windowSeconds: 60 }, //          new runs, plans and task starts per org
  upload: { limit: 60, windowSeconds: 10 * 60 }, //        file and env uploads per org
  approval: { limit: 120, windowSeconds: 60 }, //          approval decisions and answers per user
  api_read: { limit: 600, windowSeconds: 60 }, //          public API reads per key
  api_write: { limit: 30, windowSeconds: 60 }, //          public API run starts per key
  hook: { limit: 120, windowSeconds: 60 } //               inbound webhook deliveries per endpoint
};

export function rateLimitConfig(bucket: RateLimitBucket, env: NodeJS.ProcessEnv = process.env) {
  const raw = env[`RATE_LIMIT_${bucket.toUpperCase()}`]?.trim();
  const match = raw ? /^(\d+)\/(\d+)$/.exec(raw) : null;
  if (match && Number(match[1]) > 0 && Number(match[2]) > 0) return { limit: Number(match[1]), windowSeconds: Number(match[2]) };
  return DEFAULTS[bucket];
}

export class RateLimitError extends AppError {
  constructor(public readonly retryAfterSeconds: number) {
    super(`Too many requests. Try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}.`, 429, "RATE_LIMITED", { retryAfterSeconds });
    this.name = "RateLimitError";
  }
}

export type RateLimitResult = { allowed: boolean; count: number; limit: number; retryAfterSeconds: number };

/** Count one request for `subject` in `bucket`. */
export async function hitRateLimit(bucket: RateLimitBucket, subject: string, now = new Date()): Promise<RateLimitResult> {
  const { limit, windowSeconds } = rateLimitConfig(bucket);
  if (process.env.RATE_LIMITS === "off") return { allowed: true, count: 0, limit, retryAfterSeconds: 0 };
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const key = `${bucket}:${subject}`.slice(0, 300);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
    RETURNING "count"`;
  const count = Number(rows[0]?.count ?? 1);
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000));
  return { allowed: count <= limit, count, limit, retryAfterSeconds };
}

/** Throw a RateLimitError (429) when `subject` is over the bucket's limit. */
export async function enforceRateLimit(bucket: RateLimitBucket, subject: string): Promise<void> {
  const result = await hitRateLimit(bucket, subject);
  if (!result.allowed) throw new RateLimitError(result.retryAfterSeconds);
}

/** The client's address as seen by the proxy in front of the app (first X-Forwarded-For hop), or "unknown". */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Drop windows that ended more than a day ago. Called from the worker sweep. */
export async function pruneRateLimits(now = new Date()): Promise<number> {
  const { count } = await prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } });
  return count;
}

/** For handlers that build their own responses: a 429 response when over the limit, otherwise null. */
export async function rateLimitResponse(bucket: RateLimitBucket, subject: string): Promise<Response | null> {
  const result = await hitRateLimit(bucket, subject);
  if (result.allowed) return null;
  return Response.json(
    { error: { code: "RATE_LIMITED", message: `Too many requests. Try again in ${result.retryAfterSeconds} seconds.` } },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
  );
}
