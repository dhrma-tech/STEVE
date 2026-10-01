import { prisma } from "@/lib/db/client";
import { databaseUrl } from "@/lib/db/url";
import { PgBossJobQueue } from "./pgboss-queue";

/**
 * Durable job queue. Everything the engine needs from a queue is in this interface, so the database-backed
 * implementation below can be replaced (for example by pg-boss on Postgres) without touching the engine.
 */

export type JobInput = {
  type: string;
  runId?: string | null;
  payload?: unknown;
  /** Earliest time the job may run. Default: now. */
  runAt?: Date;
  /** While a job with this key is queued, enqueueing another is a no-op. */
  dedupeKey?: string;
  maxAttempts?: number;
};

export type ClaimedJob = {
  id: string;
  type: string;
  runId: string | null;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
};

export interface JobQueue {
  enqueue(job: JobInput): Promise<{ id: string; created: boolean }>;
  /** Atomically take the next due job and hold it for `leaseMs`. Null when nothing is due. */
  claim(workerId: string, options: { leaseMs: number; types?: string[] }): Promise<ClaimedJob | null>;
  extendLease(jobId: string, workerId: string, leaseMs: number): Promise<boolean>;
  complete(jobId: string): Promise<void>;
  /** Put a failed job back to try again after `delayMs`. */
  retry(jobId: string, error: string, delayMs: number): Promise<void>;
  /** Give up on a job. */
  fail(jobId: string, error: string): Promise<void>;
  /** Return jobs whose worker vanished (lease expired) to the queue. */
  requeueExpired(): Promise<{ requeued: number; failed: number }>;
  /** True when the run has a queued or active job. */
  hasPending(runId: string): Promise<boolean>;
}

function parsePayload(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Prisma stores DateTime as UTC `timestamp(3)`; raw SQL gets times as ISO strings converted the same way. */
const utc = (date: Date) => date.toISOString();

type ClaimRow = { id: string; type: string; runId: string | null; payloadJson: string; attempts: number; maxAttempts: number };

/** The default queue: the `Job` table in the app's own Postgres. */
export class DbJobQueue implements JobQueue {
  async enqueue(job: JobInput) {
    const data = {
      type: job.type,
      runId: job.runId ?? null,
      payloadJson: JSON.stringify(job.payload ?? {}),
      dedupeKey: job.dedupeKey ?? null,
      runAt: job.runAt ?? new Date(),
      ...(job.maxAttempts ? { maxAttempts: job.maxAttempts } : {})
    };
    if (!job.dedupeKey) {
      const row = await prisma.job.create({ data });
      return { id: row.id, created: true };
    }
    const dedupeKey = job.dedupeKey;
    // A transaction-scoped advisory lock on the key makes "look for a queued twin, else insert" atomic across
    // processes, so two wake-ups at the same moment cannot both queue a job.
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dedupeKey}))`;
      const existing = await tx.job.findFirst({ where: { dedupeKey, status: "queued" }, select: { id: true } });
      if (existing) return { id: existing.id, created: false };
      const row = await tx.job.create({ data });
      return { id: row.id, created: true };
    });
  }

  async claim(workerId: string, options: { leaseMs: number; types?: string[] }): Promise<ClaimedJob | null> {
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + options.leaseMs);
    const types = options.types ?? null;
    // SKIP LOCKED lets any number of workers claim at once: each takes a different row, none waits on another.
    const rows = await prisma.$queryRaw<ClaimRow[]>`
      UPDATE "Job"
         SET "status" = 'active',
             "lockedBy" = ${workerId},
             "lockedUntil" = (${utc(lockedUntil)}::timestamptz AT TIME ZONE 'UTC'),
             "attempts" = "attempts" + 1,
             "updatedAt" = (${utc(now)}::timestamptz AT TIME ZONE 'UTC')
       WHERE "id" = (
         SELECT "id" FROM "Job"
          WHERE "status" = 'queued'
            AND "runAt" <= (${utc(now)}::timestamptz AT TIME ZONE 'UTC')
            AND (${types}::text[] IS NULL OR "type" = ANY(${types}::text[]))
          ORDER BY "runAt" ASC, "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
      RETURNING "id", "type", "runId", "payloadJson", "attempts", "maxAttempts"`;
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      type: row.type,
      runId: row.runId,
      payload: parsePayload(row.payloadJson),
      attempts: row.attempts,
      maxAttempts: row.maxAttempts
    };
  }

  async extendLease(jobId: string, workerId: string, leaseMs: number) {
    const result = await prisma.job.updateMany({
      where: { id: jobId, lockedBy: workerId, status: "active" },
      data: { lockedUntil: new Date(Date.now() + leaseMs) }
    });
    return result.count === 1;
  }

  async complete(jobId: string) {
    await prisma.job.updateMany({
      where: { id: jobId },
      data: { status: "done", finishedAt: new Date(), lockedBy: null, lockedUntil: null }
    });
  }

  async retry(jobId: string, error: string, delayMs: number) {
    await prisma.job.updateMany({
      where: { id: jobId },
      data: { status: "queued", runAt: new Date(Date.now() + delayMs), lastError: error.slice(0, 2000), lockedBy: null, lockedUntil: null }
    });
  }

  async fail(jobId: string, error: string) {
    await prisma.job.updateMany({
      where: { id: jobId },
      data: { status: "failed", lastError: error.slice(0, 2000), finishedAt: new Date(), lockedBy: null, lockedUntil: null }
    });
  }

  async requeueExpired() {
    const now = new Date();
    const expired = await prisma.job.findMany({ where: { status: "active", lockedUntil: { lt: now } } });
    let requeued = 0;
    let failed = 0;
    for (const job of expired) {
      if (job.attempts >= job.maxAttempts) {
        const result = await prisma.job.updateMany({
          where: { id: job.id, status: "active" },
          data: { status: "failed", lastError: "Worker stopped responding and the retry limit was reached.", finishedAt: now, lockedBy: null, lockedUntil: null }
        });
        failed += result.count;
      } else {
        const result = await prisma.job.updateMany({
          where: { id: job.id, status: "active", lockedUntil: { lt: now } },
          data: { status: "queued", lockedBy: null, lockedUntil: null, lastError: "Worker stopped responding; retrying." }
        });
        requeued += result.count;
      }
    }
    return { requeued, failed };
  }

  async hasPending(runId: string) {
    const count = await prisma.job.count({ where: { runId, status: { in: ["queued", "active"] } } });
    return count > 0;
  }
}

const g = globalThis as typeof globalThis & { _steveJobQueue?: JobQueue };

/** AGENT_QUEUE: `db` (default, the `Job` table) or `pg-boss`. */
export function queueKind(env: NodeJS.ProcessEnv = process.env): "db" | "pg-boss" {
  const value = env.AGENT_QUEUE?.trim().toLowerCase();
  if (!value || value === "db") return "db";
  if (value === "pg-boss" || value === "pgboss") return "pg-boss";
  throw new Error(`AGENT_QUEUE must be "db" or "pg-boss", got "${env.AGENT_QUEUE}"`);
}

export function getQueue(): JobQueue {
  if (!g._steveJobQueue) {
    if (queueKind() === "pg-boss") {
      // pg-boss connects on first use, so the default setup never opens a connection for it.
      g._steveJobQueue = new PgBossJobQueue({ connectionString: databaseUrl() });
    } else {
      g._steveJobQueue = new DbJobQueue();
    }
  }
  return g._steveJobQueue;
}

/** Test hook. */
export function setQueue(queue: JobQueue | undefined): void {
  g._steveJobQueue = queue;
}
