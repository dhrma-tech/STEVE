import { randomUUID } from "node:crypto";
import { PgBoss } from "pg-boss";
import type { ClaimedJob, JobInput, JobQueue } from "./queue";

/**
 * `JobQueue` on pg-boss (AGENT_QUEUE=pg-boss). pg-boss keeps its jobs in its own `pgboss` schema, so these jobs
 * are not rows in the app's `Job` table.
 *
 * How the interface maps:
 * - one pg-boss queue per job type, with the `short` policy: at most one queued job per singleton key, any number
 *   active. That is exactly `dedupeKey` ("while a job with this key is queued, enqueueing another is a no-op");
 *   jobs without a key get a unique one.
 * - job ids are returned as `<type>|<pg-boss id>` because pg-boss needs the queue name for every call.
 * - leases are pg-boss heartbeats (`touch`); pg-boss's own supervisor retries jobs whose heartbeat stops, so
 *   `requeueExpired` has nothing to do.
 * - `retry` hands the job back with `fail`, and pg-boss schedules the retry with exponential backoff (1 s .. 30 s),
 *   so the delay the worker asks for is approximate.
 */
export type PgBossQueueOptions = {
  connectionString: string;
  schema?: string;
  /** Job types a worker may claim when it is not told which (a fresh worker has not enqueued anything yet). */
  types?: string[];
  /** Attempts per job unless the job says otherwise. */
  maxAttempts?: number;
};

const SEP = "|";
const HEARTBEAT_SECONDS = 30;
const PENDING_STATES = new Set(["created", "retry", "active"]);

type JobData = { runId: string | null; payload: unknown };

function splitId(id: string): { name: string; jobId: string } {
  const at = id.indexOf(SEP);
  if (at < 0) throw new Error(`Not a pg-boss job id: ${id}`);
  return { name: id.slice(0, at), jobId: id.slice(at + 1) };
}

export class PgBossJobQueue implements JobQueue {
  private readonly boss: PgBoss;
  private readonly maxAttempts: number;
  private readonly types: Set<string>;
  private started: Promise<void> | null = null;
  private readonly created = new Map<string, Promise<void>>();
  /** Which worker holds each active job; pg-boss heartbeats do not carry a holder. */
  private readonly holders = new Map<string, string>();

  constructor(options: PgBossQueueOptions) {
    this.boss = new PgBoss({ connectionString: options.connectionString, schema: options.schema ?? "pgboss", max: 5 });
    this.boss.on("error", (error) => console.error("[pg-boss]", error));
    this.maxAttempts = options.maxAttempts ?? 5;
    this.types = new Set(options.types ?? ["run.advance"]);
  }

  private ready(): Promise<void> {
    return (this.started ??= this.boss.start().then(() => undefined));
  }

  private ensureQueue(name: string): Promise<void> {
    this.types.add(name);
    let pending = this.created.get(name);
    if (!pending) {
      pending = (async () => {
        await this.ready();
        if (await this.boss.getQueue(name)) return;
        try {
          await this.boss.createQueue(name, {
            policy: "short",
            retryLimit: this.maxAttempts - 1,
            retryDelay: 1,
            retryBackoff: true,
            retryDelayMax: 30,
            heartbeatSeconds: HEARTBEAT_SECONDS,
            expireInSeconds: 60 * 60
          });
        } catch (error) {
          // Another process created it first.
          if (!(await this.boss.getQueue(name))) throw error;
        }
      })();
      this.created.set(name, pending);
    }
    return pending;
  }

  async enqueue(job: JobInput) {
    await this.ensureQueue(job.type);
    const singletonKey = job.dedupeKey ?? `unique:${randomUUID()}`;
    const data: JobData = { runId: job.runId ?? null, payload: job.payload ?? {} };
    const id = await this.boss.send(job.type, data, {
      singletonKey,
      ...(job.runAt ? { startAfter: job.runAt } : {}),
      ...(job.maxAttempts ? { retryLimit: job.maxAttempts - 1 } : {})
    });
    if (id) return { id: `${job.type}${SEP}${id}`, created: true };
    const [existing] = await this.boss.findJobs(job.type, { key: singletonKey, queued: true });
    if (!existing) throw new Error(`pg-boss refused job ${job.type} (${singletonKey}) but no queued twin was found`);
    return { id: `${job.type}${SEP}${existing.id}`, created: false };
  }

  async claim(workerId: string, options: { leaseMs: number; types?: string[] }): Promise<ClaimedJob | null> {
    for (const name of options.types ?? [...this.types]) {
      await this.ensureQueue(name);
      const [job] = await this.boss.fetch<JobData>(name, { batchSize: 1, includeMetadata: true });
      if (!job) continue;
      const id = `${name}${SEP}${job.id}`;
      this.holders.set(id, workerId);
      return {
        id,
        type: name,
        runId: job.data?.runId ?? null,
        payload: job.data?.payload ?? null,
        attempts: job.retryCount + 1,
        maxAttempts: job.retryLimit + 1
      };
    }
    return null;
  }

  async extendLease(jobId: string, workerId: string) {
    if (this.holders.get(jobId) !== workerId) return false;
    const { name, jobId: id } = splitId(jobId);
    const result = await this.boss.touch(name, id);
    // The typings leave CommandResponse empty; at runtime it reports how many jobs the call touched.
    return (result as { affected?: number }).affected !== 0;
  }

  async complete(jobId: string) {
    const { name, jobId: id } = splitId(jobId);
    this.holders.delete(jobId);
    await this.boss.complete(name, id);
  }

  async retry(jobId: string, error: string) {
    const { name, jobId: id } = splitId(jobId);
    this.holders.delete(jobId);
    await this.boss.fail(name, id, { error: error.slice(0, 2000) });
  }

  async fail(jobId: string, error: string) {
    const { name, jobId: id } = splitId(jobId);
    this.holders.delete(jobId);
    await this.boss.fail(name, id, { error: error.slice(0, 2000) });
    // `fail` retries while attempts remain; giving up means no retry at all.
    const [job] = await this.boss.findJobs(name, { id });
    if (job?.state === "retry" || job?.state === "created") await this.boss.cancel(name, id);
  }

  async requeueExpired() {
    return { requeued: 0, failed: 0 };
  }

  async hasPending(runId: string) {
    for (const name of this.types) {
      await this.ensureQueue(name);
      const jobs = await this.boss.findJobs(name, { data: { runId } });
      if (jobs.some((job) => PENDING_STATES.has(job.state))) return true;
    }
    return false;
  }

  /** The state pg-boss reports for a job (tests and diagnostics). */
  async state(jobId: string): Promise<string | null> {
    const { name, jobId: id } = splitId(jobId);
    const [job] = await this.boss.findJobs(name, { id });
    return job?.state ?? null;
  }

  async close(): Promise<void> {
    if (this.started) await this.boss.stop({ graceful: false, close: true });
  }
}
