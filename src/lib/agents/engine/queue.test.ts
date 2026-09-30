import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { DbJobQueue } from "@/lib/agents/engine/queue";
import { ago, resetDb } from "@/lib/agents/testing/test-db";

const queue = new DbJobQueue();
const lease = { leaseMs: 30_000 };

beforeEach(resetDb);

describe("enqueue", () => {
  it("stores a job that can be claimed", async () => {
    const { id, created } = await queue.enqueue({ type: "run.advance", runId: "r1", payload: { runId: "r1" } });
    expect(created).toBe(true);

    const job = await queue.claim("w1", lease);
    expect(job).toMatchObject({ id, type: "run.advance", runId: "r1", payload: { runId: "r1" }, attempts: 1 });
  });

  it("does not create a second job while one with the same key is queued", async () => {
    const first = await queue.enqueue({ type: "t", dedupeKey: "k" });
    const second = await queue.enqueue({ type: "t", dedupeKey: "k" });
    expect(second).toEqual({ id: first.id, created: false });
    expect(await prisma.job.count()).toBe(1);
  });

  it("does allow a new job once the earlier one has been claimed", async () => {
    await queue.enqueue({ type: "t", dedupeKey: "k" });
    await queue.claim("w1", lease);
    const again = await queue.enqueue({ type: "t", dedupeKey: "k" });
    expect(again.created).toBe(true);
  });
});

describe("claim", () => {
  it("hands out jobs oldest first and never the same job twice", async () => {
    const a = await queue.enqueue({ type: "t", payload: 1, runAt: new Date(Date.now() - 2000) });
    const b = await queue.enqueue({ type: "t", payload: 2, runAt: new Date(Date.now() - 1000) });

    const first = await queue.claim("w1", lease);
    const second = await queue.claim("w2", lease);
    const third = await queue.claim("w3", lease);

    expect([first?.id, second?.id]).toEqual([a.id, b.id]);
    expect(third).toBeNull();
  });

  it("gives every job to exactly one of many workers claiming at once", async () => {
    for (let i = 0; i < 5; i++) await queue.enqueue({ type: "t", payload: i });

    const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => queue.claim(`w${i}`, lease)));
    const claimed = claims.filter((c): c is NonNullable<typeof c> => c !== null);

    expect(claimed).toHaveLength(5);
    expect(new Set(claimed.map((c) => c.id)).size).toBe(5);
  });

  it("skips jobs scheduled for later", async () => {
    await queue.enqueue({ type: "t", runAt: new Date(Date.now() + 60_000) });
    expect(await queue.claim("w1", lease)).toBeNull();
  });

  it("can be limited to some job types", async () => {
    await queue.enqueue({ type: "other" });
    expect(await queue.claim("w1", { ...lease, types: ["run.advance"] })).toBeNull();
    expect(await queue.claim("w1", { ...lease, types: ["other"] })).not.toBeNull();
  });
});

describe("finishing a job", () => {
  it("complete removes it from the queue", async () => {
    const { id } = await queue.enqueue({ type: "t" });
    await queue.claim("w1", lease);
    await queue.complete(id);
    expect(await prisma.job.findUnique({ where: { id } })).toMatchObject({ status: "done", lockedBy: null });
    expect(await queue.claim("w1", lease)).toBeNull();
  });

  it("retry puts it back after a delay and keeps the attempt count", async () => {
    const { id } = await queue.enqueue({ type: "t" });
    await queue.claim("w1", lease);
    await queue.retry(id, "boom", 60_000);

    const row = await prisma.job.findUnique({ where: { id } });
    expect(row).toMatchObject({ status: "queued", attempts: 1, lastError: "boom" });
    expect(row!.runAt.getTime()).toBeGreaterThan(Date.now() + 50_000);
    expect(await queue.claim("w1", lease)).toBeNull();
  });

  it("fail is final", async () => {
    const { id } = await queue.enqueue({ type: "t" });
    await queue.claim("w1", lease);
    await queue.fail(id, "nope");
    expect(await prisma.job.findUnique({ where: { id } })).toMatchObject({ status: "failed", lastError: "nope" });
  });
});

describe("leases", () => {
  it("only the holder can extend a lease", async () => {
    const { id } = await queue.enqueue({ type: "t" });
    await queue.claim("w1", lease);
    expect(await queue.extendLease(id, "w1", 60_000)).toBe(true);
    expect(await queue.extendLease(id, "someone-else", 60_000)).toBe(false);
  });

  it("returns a job to the queue when its worker's lease expires", async () => {
    const { id } = await queue.enqueue({ type: "t" });
    await queue.claim("w1", lease);
    expect(await queue.requeueExpired()).toEqual({ requeued: 0, failed: 0 }); // lease still valid

    await prisma.job.update({ where: { id }, data: { lockedUntil: ago(1000) } });
    expect(await queue.requeueExpired()).toEqual({ requeued: 1, failed: 0 });

    const again = await queue.claim("w2", lease);
    expect(again).toMatchObject({ id, attempts: 2 });
  });

  it("gives up on a job whose workers keep vanishing", async () => {
    const { id } = await queue.enqueue({ type: "t", maxAttempts: 1 });
    await queue.claim("w1", lease);
    await prisma.job.update({ where: { id }, data: { lockedUntil: ago(1000) } });

    expect(await queue.requeueExpired()).toEqual({ requeued: 0, failed: 1 });
    expect((await prisma.job.findUnique({ where: { id } }))?.status).toBe("failed");
  });
});

describe("hasPending", () => {
  it("is true for a queued or active job of the run, false once it is done", async () => {
    expect(await queue.hasPending("r1")).toBe(false);
    const { id } = await queue.enqueue({ type: "t", runId: "r1" });
    expect(await queue.hasPending("r1")).toBe(true);
    await queue.claim("w1", lease);
    expect(await queue.hasPending("r1")).toBe(true);
    await queue.complete(id);
    expect(await queue.hasPending("r1")).toBe(false);
    expect(await queue.hasPending("other")).toBe(false);
  });
});
