import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { scriptedModel } from "@/lib/agents/testing/scripted-anthropic";
import { ORG, rawExec, resetDb, seedAgent, seedTask, testWorker } from "@/lib/agents/testing/test-db";
import { startAgentRun } from "@/lib/agents/run-service";
import { getRunBySession, getRun } from "@/lib/agents/engine/run-store";
import { getQueue } from "@/lib/agents/engine/queue";
import { ADVANCE_JOB, enqueueAdvance } from "@/lib/agents/engine/wake";
import { backoffMs, Worker, workerConcurrency } from "@/lib/agents/engine/worker";
import { retryBaseMs } from "@/lib/agents/engine/models";
import type * as AdvanceModule from "@/lib/agents/engine/advance";

/** When set, replaces the real step machine so a test can make a job fail or report "busy". */
const control = vi.hoisted(() => ({ advance: null as null | ((runId: string) => Promise<string>) }));

vi.mock("@/lib/agents/engine/advance", async (importOriginal) => {
  const real = await importOriginal<typeof AdvanceModule>();
  return {
    ...real,
    advanceRun: (runId: string, options: Parameters<typeof real.advanceRun>[1]) =>
      control.advance ? control.advance(runId) : real.advanceRun(runId, options)
  };
});
vi.mock("@anthropic-ai/sdk", async () => (await import("@/lib/agents/testing/scripted-anthropic")).anthropicModuleMock);
vi.mock("@/lib/agents/prompt", () => ({
  buildPrompt: () => ({ system: "SYSTEM PROMPT", user: "USER PROMPT" }),
  loadOrgContext: async () => ({ businessPlan: "", brandKit: "" }),
  maybeExtractAndSaveBrandKit: async () => undefined
}));

async function queuedRun() {
  const agent = await seedAgent({ slug: "eng", name: "Engineering Agent", departmentSlug: "engineering" });
  const task = await seedTask({ agentId: agent.id, departmentId: agent.departmentId });
  const session = (await startAgentRun({ orgId: ORG, taskId: task.id }))!;
  const run = (await getRunBySession(session.id))!;
  return { agent, task, session, run };
}

const jobsOf = (runId: string) => prisma.job.findMany({ where: { runId }, orderBy: { createdAt: "asc" } });
/** Make every queued job due now, as if its backoff had passed. */
const makeDue = () => rawExec("UPDATE Job SET runAt = ? WHERE status = 'queued'", Date.now() - 1);

let started: Worker[] = [];

beforeEach(async () => {
  await resetDb();
  control.advance = null;
  scriptedModel.load([]);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("AGENTS_PAUSED", "");
  vi.stubEnv("MODEL_RETRY_BASE_MS", "0");
});
afterEach(async () => {
  await Promise.all(started.map((w) => w.stop()));
  started = [];
  vi.unstubAllEnvs();
});

describe("backoffMs", () => {
  it("doubles from one second and caps at thirty", () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16_000, 30_000, 30_000]);
    expect(backoffMs(0)).toBe(1000);
  });
});

describe("settings from the environment", () => {
  const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv;

  it("falls back to 4 workers when AGENT_WORKER_CONCURRENCY is blank or invalid, instead of 0", () => {
    expect(workerConcurrency(env({}))).toBe(4);
    expect(workerConcurrency(env({ AGENT_WORKER_CONCURRENCY: "" }))).toBe(4);
    expect(workerConcurrency(env({ AGENT_WORKER_CONCURRENCY: "0" }))).toBe(4);
    expect(workerConcurrency(env({ AGENT_WORKER_CONCURRENCY: "lots" }))).toBe(4);
    expect(workerConcurrency(env({ AGENT_WORKER_CONCURRENCY: "8" }))).toBe(8);
  });

  it("keeps an explicit zero retry delay but ignores a blank one", () => {
    expect(retryBaseMs(env({}))).toBe(500);
    expect(retryBaseMs(env({ MODEL_RETRY_BASE_MS: "" }))).toBe(500);
    expect(retryBaseMs(env({ MODEL_RETRY_BASE_MS: "x" }))).toBe(500);
    expect(retryBaseMs(env({ MODEL_RETRY_BASE_MS: "0" }))).toBe(0);
    expect(retryBaseMs(env({ MODEL_RETRY_BASE_MS: "250" }))).toBe(250);
  });
});

describe("job failures", () => {
  it("puts a failed job back with a backoff and the error, and leaves the run alone", async () => {
    const { run } = await queuedRun();
    control.advance = async () => {
      throw new Error("database hiccup");
    };

    const before = Date.now();
    expect(await testWorker().runOnce()).toBe(true);

    const [job] = await jobsOf(run.id);
    expect(job).toMatchObject({ status: "queued", attempts: 1, lastError: "database hiccup", lockedBy: null });
    expect(job!.runAt.getTime()).toBeGreaterThanOrEqual(before + 1000);
    expect((await getRun(run.id))?.status).toBe("queued");
    expect(await testWorker().runOnce()).toBe(false); // not due until the backoff passes
  });

  it("succeeds on a later attempt once the problem clears", async () => {
    const { run } = await queuedRun();
    let calls = 0;
    control.advance = async () => {
      calls += 1;
      if (calls === 1) throw new Error("transient");
      return "finished";
    };

    await testWorker().runOnce();
    makeDue();
    await testWorker().runOnce();

    expect(await jobsOf(run.id)).toEqual([expect.objectContaining({ status: "done", attempts: 2 })]);
  });

  it("fails the job and the run once the job has used all its attempts", async () => {
    const { run, session, task } = await queuedRun();
    rawExec("UPDATE Job SET maxAttempts = 2 WHERE runId = ?", run.id);
    control.advance = async () => {
      throw new Error("always broken");
    };

    await testWorker().runOnce();
    makeDue();
    await testWorker().runOnce();

    expect(await jobsOf(run.id)).toEqual([
      expect.objectContaining({ status: "failed", attempts: 2, lastError: "always broken" })
    ]);
    const failed = (await getRun(run.id))!;
    expect(failed.status).toBe("failed");
    expect(failed.errorMessage).toMatch(/after 2 failed attempts: always broken/);
    expect((await prisma.taskSession.findUnique({ where: { id: session.id } }))?.status).toBe("error");
    expect((await prisma.task.findUnique({ where: { id: task.id } }))?.status).not.toBe("running");
  });

  it("fails an unknown job type without touching any run", async () => {
    const { id } = await getQueue().enqueue({ type: "mystery", maxAttempts: 1 });

    await testWorker().runOnce();

    expect(await prisma.job.findUnique({ where: { id } })).toMatchObject({ status: "failed", lastError: "Unknown job type: mystery" });
  });
});

describe("advance results", () => {
  it("queues the next step at once when the run has more to do", async () => {
    const { run } = await queuedRun();
    control.advance = async () => "more";

    await testWorker().runOnce();

    const jobs = await jobsOf(run.id);
    expect(jobs.map((j) => j.status)).toEqual(["done", "queued"]);
    expect(jobs[1]!.runAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("looks again shortly when another worker holds the run", async () => {
    const { run } = await queuedRun();
    control.advance = async () => "busy";

    const before = Date.now();
    await testWorker().runOnce();

    const jobs = await jobsOf(run.id);
    expect(jobs.map((j) => j.status)).toEqual(["done", "queued"]);
    expect(jobs[1]!.runAt.getTime()).toBeGreaterThanOrEqual(before + 1000);
  });

  it("does nothing more for a finished run", async () => {
    const { run } = await queuedRun();
    control.advance = async () => "finished";

    await testWorker().runOnce();

    expect((await jobsOf(run.id)).map((j) => j.status)).toEqual(["done"]);
  });
});

describe("long-running mode", () => {
  it("picks up a new run as soon as it is queued and carries it to the end", async () => {
    const worker = new Worker({ id: "loop-worker", concurrency: 2, pollMs: 50, sweepMs: 60_000 });
    started.push(worker);
    worker.start();
    scriptedModel.load([{ text: "All done." }]);

    const { run, session } = await queuedRun();

    await vi.waitFor(async () => expect((await getRun(run.id))?.status).toBe("completed"), { timeout: 10_000, interval: 50 });
    expect((await prisma.taskSession.findUnique({ where: { id: session.id } }))?.status).toBe("completed");
    expect(await getQueue().hasPending(run.id)).toBe(false);
  });

  it("finishes the job in hand when stopped, then takes no more", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const seen: string[] = [];
    control.advance = async (runId) => {
      seen.push(runId);
      await gate;
      return "finished";
    };
    const { run } = await queuedRun();
    const worker = new Worker({ id: "stopping-worker", concurrency: 1, pollMs: 20, sweepMs: 60_000 });
    worker.start();
    await vi.waitFor(() => expect(seen).toEqual([run.id]));

    const stopping = worker.stop();
    release();
    await stopping;
    expect((await jobsOf(run.id)).map((j) => j.status)).toEqual(["done"]);

    await enqueueAdvance(run.id);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(seen).toHaveLength(1);
    expect((await jobsOf(run.id)).map((j) => j.status)).toEqual(["done", "queued"]);
  });

  it("start is idempotent", async () => {
    const worker = new Worker({ id: "twice", pollMs: 1000, sweepMs: 60_000 });
    started.push(worker);
    worker.start();
    worker.start();
    await worker.stop();
  });
});

describe("sweep", () => {
  it("returns a job whose worker vanished to the queue", async () => {
    const { run } = await queuedRun();
    rawExec("UPDATE Job SET status = 'active', lockedBy = 'dead', lockedUntil = ?, attempts = 1 WHERE runId = ?", Date.now() - 1000, run.id);

    const stats = await testWorker().sweep();

    expect(stats.requeuedJobs).toBe(1);
    expect(await jobsOf(run.id)).toEqual([expect.objectContaining({ status: "queued", lockedBy: null, type: ADVANCE_JOB })]);
  });
});
