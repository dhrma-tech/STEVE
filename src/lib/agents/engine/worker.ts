import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { expireDueApprovals } from "../policy/approvals";
import { advanceRun, failRunById, repairUnclosedRuns } from "./advance";
import { getQueue, type ClaimedJob, type JobQueue } from "./queue";
import { ADVANCE_JOB, enqueueAdvance, onWake } from "./wake";
import { advancePlan } from "../plans/scheduler";
import { enqueuePlanAdvance, PLAN_JOB } from "../plans/wake";
import { ensureDailyBriefings } from "@/lib/briefings/briefings";
import { reportError } from "@/lib/observability/log";
import { deliverChannelJob, DELIVER_JOB } from "@/lib/automations/channels";
import { fireDueSchedules } from "@/lib/automations/schedules";

/** Plans that are moving (or waiting on a run) and could miss a wake-up. */
const LIVE_PLAN_STATUSES = ["drafting", "running", "replanning", "reporting"];

export type WorkerOptions = {
  queue?: JobQueue;
  id?: string;
  /** Jobs handled at the same time. */
  concurrency?: number;
  /** How often to look for due jobs when nothing wakes the worker. */
  pollMs?: number;
  /** How long a claimed job is held before another worker may take it. Renewed while the job runs. */
  leaseMs?: number;
  sweepMs?: number;
  /** A queued/running run untouched this long, with no job behind it, is re-queued. */
  runningStaleMs?: number;
  /** A run waiting on an approval or child is re-checked this often, in case a wake-up was lost. */
  waitingStaleMs?: number;
  /**
   * Keep the Node process alive while the worker is started. A standalone worker process needs this, since its
   * timers are otherwise all that is left on the event loop; inside the web server or a test it would only get in the way.
   */
  keepProcessAlive?: boolean;
  log?: (message: string) => void;
};

export type SweepStats = {
  requeuedJobs: number;
  failedJobs: number;
  expiredApprovals: number;
  reawakenedRuns: number;
  closedOutRuns: number;
  reawakenedPlans: number;
  /** Schedules that came due and were fired (started or recorded as skipped/failed). */
  firedSchedules: number;
};

/** AGENT_WORKER_CONCURRENCY, or 4. Blank or invalid falls back to the default instead of a worker that never claims a job. */
export function workerConcurrency(env: NodeJS.ProcessEnv = process.env): number {
  const value = Math.floor(Number(env.AGENT_WORKER_CONCURRENCY));
  return Number.isFinite(value) && value >= 1 ? value : 4;
}

export function backoffMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, attempt - 1));
}

export class Worker {
  readonly id: string;
  private readonly queue: JobQueue;
  private readonly concurrency: number;
  private readonly pollMs: number;
  private readonly leaseMs: number;
  private readonly sweepMs: number;
  private readonly runningStaleMs: number;
  private readonly waitingStaleMs: number;
  private readonly keepProcessAlive: boolean;
  private readonly log: (message: string) => void;

  private running = false;
  private pumping = false;
  private readonly active = new Set<Promise<void>>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private unwake: (() => void) | null = null;

  constructor(options: WorkerOptions = {}) {
    this.id = options.id ?? `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
    this.queue = options.queue ?? getQueue();
    this.concurrency = options.concurrency ?? workerConcurrency();
    this.pollMs = options.pollMs ?? 500;
    this.leaseMs = options.leaseMs ?? 30_000;
    this.sweepMs = options.sweepMs ?? 30_000;
    this.runningStaleMs = options.runningStaleMs ?? 60_000;
    this.waitingStaleMs = options.waitingStaleMs ?? 5 * 60_000;
    this.keepProcessAlive = options.keepProcessAlive ?? false;
    this.log = options.log ?? (() => undefined);
  }

  // ── Long-running mode ───────────────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;
    this.unwake = onWake(() => void this.pump());
    this.pollTimer = setInterval(() => void this.pump(), this.pollMs);
    this.sweepTimer = setInterval(() => void this.sweep().catch((e) => this.log(`sweep failed: ${String(e)}`)), this.sweepMs);
    if (!this.keepProcessAlive) {
      this.pollTimer.unref?.();
      this.sweepTimer.unref?.();
    }
    this.log(`worker ${this.id} started (concurrency ${this.concurrency})`);
    void this.sweep().catch((e) => this.log(`sweep failed: ${String(e)}`));
    void this.pump();
  }

  /** Stop taking new jobs and wait for the ones in flight. */
  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.unwake?.();
    await Promise.allSettled([...this.active]);
    this.log(`worker ${this.id} stopped`);
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.running && this.active.size < this.concurrency) {
        const job = await this.queue.claim(this.id, { leaseMs: this.leaseMs });
        if (!job) return;
        const task: Promise<void> = this.handle(job).finally(() => {
          this.active.delete(task);
          void this.pump();
        });
        this.active.add(task);
      }
    } catch (error) {
      this.log(`claim failed: ${String(error)}`);
    } finally {
      this.pumping = false;
    }
  }

  // ── One-shot mode (tests and serverless ticks) ──────────────────────────────

  /** Claim and handle a single due job. Returns false when nothing was due. */
  async runOnce(): Promise<boolean> {
    const job = await this.queue.claim(this.id, { leaseMs: this.leaseMs });
    if (!job) return false;
    await this.handle(job);
    return true;
  }

  /** Handle due jobs until none are left, or a limit is reached. Returns how many were handled. */
  async drain(options: { maxJobs?: number; maxMs?: number } = {}): Promise<number> {
    const maxJobs = options.maxJobs ?? 1000;
    const deadline = Date.now() + (options.maxMs ?? 30_000);
    let handled = 0;
    while (handled < maxJobs && Date.now() < deadline) {
      if (!(await this.runOnce())) break;
      handled += 1;
    }
    return handled;
  }

  // ── Handling ────────────────────────────────────────────────────────────────

  private async handle(job: ClaimedJob): Promise<void> {
    const beat = setInterval(() => void this.queue.extendLease(job.id, this.id, this.leaseMs), Math.max(1000, this.leaseMs / 3));
    beat.unref?.();
    try {
      if (job.type === ADVANCE_JOB) await this.handleAdvance(job);
      else if (job.type === PLAN_JOB) await this.handlePlan(job);
      else if (job.type === DELIVER_JOB) await deliverChannelJob(job.payload, job.attempts, job.maxAttempts);
      else throw new Error(`Unknown job type: ${job.type}`);
      await this.queue.complete(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`job ${job.id} (${job.type}) failed on attempt ${job.attempts}: ${message}`);
      if (job.attempts >= job.maxAttempts) {
        await this.queue.fail(job.id, message);
        await reportError(error, { jobId: job.id, jobType: job.type, runId: job.runId ?? undefined, attempts: job.attempts, workerId: this.id });
        if (job.runId) await failRunById(job.runId, `The run stopped after ${job.attempts} failed attempts: ${message}`).catch(() => undefined);
      } else {
        await this.queue.retry(job.id, message, backoffMs(job.attempts));
      }
    } finally {
      clearInterval(beat);
    }
  }

  private async handleAdvance(job: ClaimedJob): Promise<void> {
    const payload = job.payload as { runId?: string } | null;
    const runId = job.runId ?? payload?.runId;
    if (!runId) return;

    // The lease holder is this job, not this worker: a worker handles several jobs at once, and two jobs for the
    // same run must not both get in (a holder may re-take its own lease).
    const result = await advanceRun(runId, { workerId: `${this.id}/${job.id}`, leaseMs: this.leaseMs });
    if (result === "more") await enqueueAdvance(runId);
    // Another worker is on it. Look again shortly so a wake-up that arrived meanwhile is not lost.
    else if (result === "busy") await enqueueAdvance(runId, { delayMs: 1000 });
  }

  private async handlePlan(job: ClaimedJob): Promise<void> {
    const planId = (job.payload as { planId?: string } | null)?.planId;
    if (!planId) return;
    const result = await advancePlan(planId, { workerId: `${this.id}/${job.id}` });
    // Another worker is on it; look again shortly so this wake-up is not lost.
    if (result === "busy") await enqueuePlanAdvance(planId, { delayMs: 1000 });
  }

  // ── Recovery ────────────────────────────────────────────────────────────────

  /**
   * Housekeeping that makes the system self-healing: give back jobs whose worker vanished, expire unanswered
   * approvals, and wake runs that should be moving but have no job behind them.
   */
  async sweep(): Promise<SweepStats> {
    const { requeued, failed } = await this.queue.requeueExpired();
    const expiredApprovals = await expireDueApprovals();

    const now = Date.now();
    const stale = await prisma.run.findMany({
      where: {
        AND: [
          {
            OR: [
              { status: { in: ["queued", "running"] }, updatedAt: { lt: new Date(now - this.runningStaleMs) } },
              { status: { in: ["waiting_approval", "waiting_children"] }, updatedAt: { lt: new Date(now - this.waitingStaleMs) } }
            ]
          },
          { OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date(now) } }] }
        ]
      },
      take: 100
    });
    let reawakened = 0;
    for (const run of stale) {
      if (await this.queue.hasPending(run.id)) continue;
      await enqueueAdvance(run.id);
      reawakened += 1;
    }

    const closedOutRuns = await repairUnclosedRuns(this.runningStaleMs);

    // A plan normally moves when one of its runs finishes. Look again at any that has been still for a while.
    const stalePlans = await prisma.plan.findMany({
      where: { status: { in: LIVE_PLAN_STATUSES }, updatedAt: { lt: new Date(now - this.waitingStaleMs) } },
      select: { id: true },
      take: 100
    });
    for (const plan of stalePlans) await enqueuePlanAdvance(plan.id);

    // Daily briefings once the briefing hour has passed, and finishing any whose writer never came back.
    await ensureDailyBriefings().catch((error) => this.log(`briefings failed: ${String(error)}`));

    // Schedules that are due (Phase 9).
    const firedSchedules = await fireDueSchedules().catch((error) => {
      this.log(`schedules failed: ${String(error)}`);
      return 0;
    });

    const stats = {
      requeuedJobs: requeued,
      failedJobs: failed,
      expiredApprovals,
      reawakenedRuns: reawakened,
      closedOutRuns,
      reawakenedPlans: stalePlans.length,
      firedSchedules
    };
    if (requeued || failed || expiredApprovals || reawakened || closedOutRuns || stalePlans.length || firedSchedules) this.log(`sweep: ${JSON.stringify(stats)}`);
    return stats;
  }
}

// ── In-process worker (default for `next dev` and single-server deployments) ──

const g = globalThis as typeof globalThis & { _steveInlineWorker?: Worker };

/** Start one worker inside the web server process. Safe to call repeatedly. */
export function startInlineWorker(log: (message: string) => void = console.log): Worker {
  if (!g._steveInlineWorker) {
    g._steveInlineWorker = new Worker({ log });
    g._steveInlineWorker.start();
  }
  return g._steveInlineWorker;
}
