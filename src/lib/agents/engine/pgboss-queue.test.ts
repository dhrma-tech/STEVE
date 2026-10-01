import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PgBossJobQueue } from "@/lib/agents/engine/pgboss-queue";

// Same contract as queue.test.ts (DbJobQueue), against pg-boss in the test database. Each test uses its own job
// type so tests do not see each other's jobs.
let queue: PgBossJobQueue;
const lease = { leaseMs: 30_000 };
let n = 0;
const type = () => `t${++n}`;

beforeAll(async () => {
  queue = new PgBossJobQueue({ connectionString: process.env.DATABASE_URL!, types: [] });
}, 60_000);

afterAll(async () => {
  await queue.close();
});

describe("pg-boss queue", () => {
  it("stores a job that can be claimed", async () => {
    const t = type();
    const { id, created } = await queue.enqueue({ type: t, runId: "r1", payload: { runId: "r1" } });
    expect(created).toBe(true);
    const job = await queue.claim("w1", { ...lease, types: [t] });
    expect(job).toMatchObject({ id, type: t, runId: "r1", payload: { runId: "r1" }, attempts: 1, maxAttempts: 5 });
  });

  it("does not create a second job while one with the same key is queued, but does once it is claimed", async () => {
    const t = type();
    const first = await queue.enqueue({ type: t, dedupeKey: "k" });
    const second = await queue.enqueue({ type: t, dedupeKey: "k" });
    expect(second).toEqual({ id: first.id, created: false });

    await queue.claim("w1", { ...lease, types: [t] });
    expect((await queue.enqueue({ type: t, dedupeKey: "k" })).created).toBe(true);
  });

  it("keeps jobs without a key apart", async () => {
    const t = type();
    const a = await queue.enqueue({ type: t });
    const b = await queue.enqueue({ type: t });
    expect(a.id).not.toBe(b.id);
    expect(b.created).toBe(true);
  });

  it("gives every job to exactly one of many workers claiming at once", async () => {
    const t = type();
    for (let i = 0; i < 5; i++) await queue.enqueue({ type: t, payload: i });
    const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => queue.claim(`w${i}`, { ...lease, types: [t] })));
    const claimed = claims.filter((c): c is NonNullable<typeof c> => c !== null);
    expect(claimed).toHaveLength(5);
    expect(new Set(claimed.map((c) => c.id)).size).toBe(5);
  });

  it("skips jobs scheduled for later", async () => {
    const t = type();
    await queue.enqueue({ type: t, runAt: new Date(Date.now() + 60_000) });
    expect(await queue.claim("w1", { ...lease, types: [t] })).toBeNull();
  });

  it("complete finishes a job; only the holder can extend its lease", async () => {
    const t = type();
    const { id } = await queue.enqueue({ type: t, runId: "r-complete" });
    await queue.claim("w1", { ...lease, types: [t] });
    expect(await queue.extendLease(id, "w1")).toBe(true);
    expect(await queue.extendLease(id, "someone-else")).toBe(false);
    expect(await queue.hasPending("r-complete")).toBe(true);
    await queue.complete(id);
    expect(await queue.state(id)).toBe("completed");
    expect(await queue.hasPending("r-complete")).toBe(false);
  });

  it("retry hands the job back for another attempt; fail is final", async () => {
    const t = type();
    const { id } = await queue.enqueue({ type: t });
    await queue.claim("w1", { ...lease, types: [t] });
    await queue.retry(id, "boom");
    expect(await queue.state(id)).toBe("retry");

    const other = await queue.enqueue({ type: t, maxAttempts: 3 });
    await queue.claim("w1", { ...lease, types: [t] });
    await queue.fail(other.id, "nope");
    expect(["failed", "cancelled"]).toContain(await queue.state(other.id));
  });
});
