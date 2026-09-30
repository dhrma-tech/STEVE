import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import {
  acquireRunLease,
  addRunGrant,
  appendEvent,
  budgetFromRoot,
  createRun,
  emitRunEvent,
  flushBudget,
  getRun,
  listEvents,
  parseChain,
  parseGrants,
  parseLimits,
  releaseRunLease,
  extendRunLease,
  onRunEvents
} from "@/lib/agents/engine/run-store";
import { RunBudget } from "@/lib/agents/policy/limits";
import { ORG, rawExec, resetDb, seedAgent, seedSession } from "@/lib/agents/testing/test-db";

async function newRun(over: Partial<Parameters<typeof createRun>[0]> = {}) {
  const agent = await seedAgent({ slug: `a-${Math.random().toString(36).slice(2, 8)}`, name: "Agent", departmentSlug: "eng" });
  const session = await seedSession(agent.id);
  return createRun({
    organizationId: ORG, sessionId: session.id, taskId: session.taskId, agentId: agent.id, requestText: "do it", mode: "trusted", ...over
  });
}

beforeEach(resetDb);

describe("createRun", () => {
  it("makes a root run that is its own root, with the limits stored on it", async () => {
    const run = await newRun({ limits: { maxDepth: 2, maxSteps: 10, maxToolCalls: 20, budgetCents: 30 } });
    expect(run).toMatchObject({ rootRunId: run.id, depth: 0, status: "queued", parentRunId: null });
    expect(parseLimits(run)).toEqual({ maxDepth: 2, maxSteps: 10, maxToolCalls: 20, budgetCents: 30 });
    expect(parseChain(run)).toEqual([run.agentId]);
  });

  it("makes a child that points at the root and extends the delegation chain", async () => {
    const root = await newRun();
    const childAgent = await seedAgent({ slug: "child", name: "Child", departmentSlug: "eng" });
    const childSession = await seedSession(childAgent.id);
    const child = await createRun({
      organizationId: ORG, sessionId: childSession.id, taskId: childSession.taskId, agentId: childAgent.id,
      requestText: "sub", mode: "trusted", parent: { run: root, slotId: "toolu_1" }
    });

    expect(child).toMatchObject({ parentRunId: root.id, rootRunId: root.id, depth: 1, parentSlotId: "toolu_1", limitsJson: null });
    expect(parseChain(child)).toEqual([root.agentId, childAgent.id]);
  });

  it("refuses a second child for the same tool call, so retries cannot start duplicates", async () => {
    const root = await newRun();
    const make = async (slug: string) => {
      const agent = await seedAgent({ slug, name: slug, departmentSlug: "eng" });
      const session = await seedSession(agent.id);
      return createRun({
        organizationId: ORG, sessionId: session.id, taskId: session.taskId, agentId: agent.id,
        requestText: "sub", mode: "trusted", parent: { run: root, slotId: "toolu_1" }
      });
    };
    await make("c1");
    await expect(make("c2")).rejects.toThrow();
  });
});

describe("event log", () => {
  it("numbers events in order and reads them back after a cursor", async () => {
    const run = await newRun();
    await appendEvent(run.id, { type: "tool_call", tool: "web_search", input: { q: "x" } });
    await appendEvent(run.id, { type: "tool_result", tool: "web_search", output: "ok", success: true });
    await appendEvent(run.id, { type: "done", output: "finished" });

    const all = await listEvents(run.id, 0);
    expect(all.map((e) => [e.seq, e.type])).toEqual([[1, "tool_call"], [2, "tool_result"], [3, "done"]]);
    expect(all[0]?.data).toEqual({ tool: "web_search", input: { q: "x" } });

    const after = await listEvents(run.id, 2);
    expect(after.map((e) => e.seq)).toEqual([3]);
    expect(await listEvents(run.id, 3)).toEqual([]);
  });

  it("gives concurrent writers distinct, gap-free sequence numbers", async () => {
    const run = await newRun();
    await Promise.all(Array.from({ length: 25 }, (_, i) => appendEvent(run.id, { type: "text_delta", delta: String(i) })));
    const seqs = (await listEvents(run.id, 0, 100)).map((e) => e.seq);
    expect(seqs).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it("wakes listeners in this process when an event is appended", async () => {
    const run = await newRun();
    let woken = 0;
    const off = onRunEvents(run.id, () => woken++);
    await appendEvent(run.id, { type: "text_delta", delta: "hi" });
    off();
    await appendEvent(run.id, { type: "text_delta", delta: "again" });
    expect(woken).toBe(1);
  });

  it("copies approval and limit events to every ancestor, and nothing else", async () => {
    const root = await newRun();
    const midAgent = await seedAgent({ slug: "mid", name: "Mid", departmentSlug: "eng" });
    const midSession = await seedSession(midAgent.id);
    const mid = await createRun({
      organizationId: ORG, sessionId: midSession.id, taskId: midSession.taskId, agentId: midAgent.id,
      requestText: "m", mode: "trusted", parent: { run: root, slotId: "s1" }
    });
    const leafAgent = await seedAgent({ slug: "leaf", name: "Leaf", departmentSlug: "eng" });
    const leafSession = await seedSession(leafAgent.id);
    const leaf = await createRun({
      organizationId: ORG, sessionId: leafSession.id, taskId: leafSession.taskId, agentId: leafAgent.id,
      requestText: "l", mode: "trusted", parent: { run: mid, slotId: "s2" }
    });

    await emitRunEvent(leaf, { type: "text_delta", delta: "private to the leaf" });
    await emitRunEvent(leaf, { type: "approval_required", tool: "email_send", input: {}, approvalId: "ap1" });
    await emitRunEvent(leaf, { type: "limit_reached", limit: "budget", message: "stop" });

    const types = async (id: string) => (await listEvents(id, 0)).map((e) => e.type);
    expect(await types(leaf.id)).toEqual(["text_delta", "approval_required", "limit_reached"]);
    expect(await types(mid.id)).toEqual(["approval_required", "limit_reached"]);
    expect(await types(root.id)).toEqual(["approval_required", "limit_reached"]);
  });
});

describe("run lease", () => {
  it("lets one worker hold a run at a time", async () => {
    const run = await newRun();
    expect(await acquireRunLease(run.id, "w1", 30_000)).toBe(true);
    expect(await acquireRunLease(run.id, "w2", 30_000)).toBe(false);
    expect(await acquireRunLease(run.id, "w1", 30_000)).toBe(true); // the holder may renew
  });

  it("lets another worker take it once released or expired", async () => {
    const run = await newRun();
    await acquireRunLease(run.id, "w1", 30_000);
    await releaseRunLease(run.id, "w1");
    expect(await acquireRunLease(run.id, "w2", 30_000)).toBe(true);

    rawExec("UPDATE Run SET lockedUntil = ? WHERE id = ?", Date.now() - 1000, run.id);
    expect(await acquireRunLease(run.id, "w3", 30_000)).toBe(true);
  });

  it("only the holder can extend or release", async () => {
    const run = await newRun();
    await acquireRunLease(run.id, "w1", 30_000);
    await extendRunLease(run.id, "w2", 999_999);
    await releaseRunLease(run.id, "w2");
    expect((await getRun(run.id))?.lockedBy).toBe("w1");
  });

  it("gives a contended run to exactly one of many workers", async () => {
    const run = await newRun();
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => acquireRunLease(run.id, `w${i}`, 30_000)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

describe("tree budget", () => {
  it("adds each worker's delta to the root totals instead of overwriting", async () => {
    const root = await newRun();
    const limits = parseLimits(root);
    const a = budgetFromRoot(root);
    const b = budgetFromRoot(root); // two workers loaded the same starting point

    a.recordModelTurn({ modelId: "claude-sonnet-4-6", provider: "anthropic", inputTokens: 1000, outputTokens: 500 });
    a.recordToolCall();
    b.recordModelTurn({ modelId: "claude-sonnet-4-6", provider: "anthropic", inputTokens: 2000, outputTokens: 100 });
    await flushBudget(root.id, a);
    await flushBudget(root.id, b);

    const fresh = (await getRun(root.id))!;
    expect(fresh).toMatchObject({ tokensIn: 3000, tokensOut: 600, steps: 2, toolCalls: 1 });
    expect(fresh.spentCents).toBeGreaterThan(0);
    expect(budgetFromRoot(fresh).limits).toEqual(limits);
  });

  it("writes nothing when a step used nothing, and does not double count on a second flush", async () => {
    const root = await newRun();
    const budget = budgetFromRoot(root);
    budget.recordToolCall();
    await flushBudget(root.id, budget);
    await flushBudget(root.id, budget);
    expect((await getRun(root.id))?.toolCalls).toBe(1);
  });

  it("RunBudget reports the delta once", () => {
    const budget = new RunBudget({ maxDepth: 3, maxSteps: 9, maxToolCalls: 9, budgetCents: 9 }, { steps: 4 });
    budget.recordToolCall();
    expect(budget.takeDelta().toolCalls).toBe(1);
    expect(budget.takeDelta().toolCalls).toBe(0);
    expect(budget.steps).toBe(4);
  });
});

describe("run grants", () => {
  it("collects grants from concurrent approvals without losing any", async () => {
    const root = await newRun();
    await Promise.all(["github_push_file", "github_create_pr", "delete_file"].map((tool) => addRunGrant(root.id, tool)));
    expect([...parseGrants((await getRun(root.id))!)].sort()).toEqual(["delete_file", "github_create_pr", "github_push_file"]);
  });

  it("does not duplicate a tool", async () => {
    const root = await newRun();
    await addRunGrant(root.id, "delete_file");
    await addRunGrant(root.id, "delete_file");
    expect([...parseGrants((await getRun(root.id))!)]).toEqual(["delete_file"]);
  });
});

describe("state", () => {
  it("stores nothing until a step saves it", async () => {
    const run = await newRun();
    expect((await prisma.run.findUnique({ where: { id: run.id } }))?.stateJson).toBeNull();
  });
});
