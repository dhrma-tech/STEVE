import { prisma } from "@/lib/db/client";

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

export class DbJobQueue implements JobQueue {
  async enqueue(job: JobInput) {
    if (job.dedupeKey) {
      const existing = await prisma.job.findFirst({ where: { dedupeKey: job.dedupeKey, status: "queued" } });
      if (existing) return { id: existing.id, created: false };
    }
    const row = await prisma.job.create({
      data: {
        type: job.type,
        runId: job.runId ?? null,
        payloadJson: JSON.stringify(job.payload ?? {}),
        dedupeKey: job.dedupeKey ?? null,
        runAt: job.runAt ?? new Date(),
        ...(job.maxAttempts ? { maxAttempts: job.maxAttempts } : {})
      }
    });
    return { id: row.id, created: true };
  }

  async claim(workerId: string, options: { leaseMs: number; types?: string[] }): Promise<ClaimedJob | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const now = new Date();
      const candidate = await prisma.job.findFirst({
        where: { status: "queued", runAt: { lte: now }, ...(options.types ? { type: { in: options.types } } : {}) },
        orderBy: [{ runAt: "asc" }, { createdAt: "asc" }]
      });
      if (!candidate) return null;

      // The conditional update is the claim: only one worker can flip queued -> active.
      const claimed = await prisma.job.updateMany({
        where: { id: candidate.id, status: "queued" },
        data: {
          status: "active",
          lockedBy: workerId,
          lockedUntil: new Date(now.getTime() + options.leaseMs),
          attempts: { increment: 1 }
        }
      });
      if (claimed.count === 1) {
        return {
          id: candidate.id,
          type: candidate.type,
          runId: candidate.runId,
          payload: parsePayload(candidate.payloadJson),
          attempts: candidate.attempts + 1,
          maxAttempts: candidate.maxAttempts
        };
      }
    }
    return null;
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

export function getQueue(): JobQueue {
  return (g._steveJobQueue ??= new DbJobQueue());
}

/** Test hook. */
export function setQueue(queue: JobQueue | undefined): void {
  g._steveJobQueue = queue;
}
