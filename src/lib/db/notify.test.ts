import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { closeNotify, listen, notify } from "@/lib/db/notify";
import { onRunEvents } from "@/lib/agents/engine/run-store";
import { onWake } from "@/lib/agents/engine/wake";

// Another process is simulated with a separate connection that sends NOTIFY directly.
async function notifyFromElsewhere(channel: string, payload: string) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("SELECT pg_notify($1, $2)", [channel, payload]);
  await client.end();
}

beforeAll(() => {
  process.env.PG_NOTIFY = "on";
});

afterAll(async () => {
  delete process.env.PG_NOTIFY;
  await closeNotify();
});

describe("Postgres LISTEN/NOTIFY", () => {
  it("delivers a notification to a subscriber and stops after unsubscribing", async () => {
    const seen: string[] = [];
    const stop = listen("steve_test_channel", (payload) => seen.push(payload));
    await vi.waitFor(async () => {
      await notify("steve_test_channel", "one");
      expect(seen).toContain("one");
    }, { timeout: 5000, interval: 100 });

    stop();
    await notify("steve_test_channel", "two");
    await new Promise((r) => setTimeout(r, 200));
    expect(seen).not.toContain("two");
  });

  it("wakes a run's listeners when another process logs an event for it, and only that run's", async () => {
    const mine = vi.fn();
    const other = vi.fn();
    const stopMine = onRunEvents("run-a", mine);
    const stopOther = onRunEvents("run-b", other);
    await vi.waitFor(async () => {
      await notifyFromElsewhere("steve_run_events", "run-a");
      expect(mine).toHaveBeenCalled();
    }, { timeout: 5000, interval: 100 });
    expect(other).not.toHaveBeenCalled();
    stopMine();
    stopOther();
  });

  it("wakes workers when another process queues a job", async () => {
    const worker = vi.fn();
    const stop = onWake(worker);
    await vi.waitFor(async () => {
      await notifyFromElsewhere("steve_jobs", "");
      expect(worker).toHaveBeenCalled();
    }, { timeout: 5000, interval: 100 });
    stop();
  });
});
