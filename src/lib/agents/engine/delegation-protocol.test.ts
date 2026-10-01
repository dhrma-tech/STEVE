import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { scriptedModel, type ScriptedTurn } from "@/lib/agents/testing/scripted-anthropic";
import { drainAll, ORG, resetDb, seedAgent, seedTask, testWorker, USER } from "@/lib/agents/testing/test-db";
import { startAgentRun } from "@/lib/agents/run-service";
import { getRun, getRunBySession, listEvents } from "@/lib/agents/engine/run-store";
import { Worker } from "@/lib/agents/engine/worker";
import { parseStoredHandoff } from "@/lib/agents/engine/handoff";
import { answerQuestion, listOpenQuestions } from "@/lib/agents/policy/approvals";
import { getInboxItemsForUser } from "@/lib/notifications/inbox";

vi.mock("@anthropic-ai/sdk", async () => (await import("@/lib/agents/testing/scripted-anthropic")).anthropicModuleMock);

const call = (name: string, input: Record<string, unknown> = {}, extra: Partial<ScriptedTurn> = {}): ScriptedTurn => ({
  toolCalls: [{ name, input }],
  ...extra
});
const finish = (summary: string, extra: Record<string, unknown> = {}, turn: Partial<ScriptedTurn> = {}) =>
  call("finish_run", { status: "done", summary, ...extra }, turn);

async function team() {
  const ops = await seedAgent({ slug: "ops", name: "Operations Agent", departmentSlug: "operations" });
  const eng = await seedAgent({ slug: "eng", name: "Engineering Agent", departmentSlug: "engineering", skillKeys: ["github-repository"] });
  const mkt = await seedAgent({ slug: "mkt", name: "Marketing Agent", departmentSlug: "marketing" });
  const sales = await seedAgent({ slug: "sales", name: "Sales Agent", departmentSlug: "sales" });
  await prisma.agent.update({ where: { id: mkt.id }, data: { role: "Writes positioning and launch copy", capabilitiesJson: JSON.stringify(["launch copy", "SEO"]) } });
  return { ops, eng, mkt, sales };
}

async function startRoot(agentId: string, message = "Launch the landing page and announce it") {
  const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
  const task = await seedTask({ agentId, departmentId: agent.departmentId, title: message });
  const session = (await startAgentRun({ orgId: ORG, taskId: task.id, agentId, message }))!;
  return { session, run: (await getRunBySession(session.id))!, task };
}

const childrenOf = (runId: string) => prisma.run.findMany({ where: { parentRunId: runId }, orderBy: { createdAt: "asc" } });
const eventsOf = async (runId: string) => (await listEvents(runId, 0, 1000)).map((e) => ({ type: e.type, ...e.data }));

let workers: Worker[] = [];
beforeEach(async () => {
  await resetDb();
  scriptedModel.load([]);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("AGENTS_PAUSED", "");
  vi.stubEnv("MODEL_RETRY_BASE_MS", "0");
});
afterEach(async () => {
  await Promise.all(workers.map((w) => w.stop()));
  workers = [];
  vi.unstubAllEnvs();
});

describe("scenario: build, copy and outreach in parallel", () => {
  it("fans out to three departments that run at the same time and hands back three structured results", async () => {
    const { ops } = await team();
    scriptedModel.load([
      call("delegate_many", {
        delegations: [
          { agentSlug: "eng", objective: "Build the landing page", acceptanceCriteria: ["deploy preview exists"] },
          { agentSlug: "mkt", objective: "Write the launch copy", context: "Audience: indie founders" },
          { agentSlug: "sales", objective: "Draft outreach to 20 prospects", constraints: "Do not send anything" }
        ]
      }),
      { text: "Launch work is done: page, copy and outreach drafts." }
    ]);
    scriptedModel.route("Engineering Agent", [
      finish("Landing page built.", { artifacts: [{ type: "pr", ref: "#12", title: "Landing page" }] }, { delayMs: 400 })
    ]);
    scriptedModel.route("Marketing Agent", [finish("Copy written.", { findings: ["Indie founders respond to speed"] }, { delayMs: 400 })]);
    scriptedModel.route("Sales Agent", [finish("20 outreach drafts ready.", { status: "needs_input", openQuestions: ["Which offer?"] }, { delayMs: 400 })]);

    const { run, session } = await startRoot(ops.id);
    const worker = new Worker({ id: "parallel", concurrency: 4, pollMs: 20, sweepMs: 60_000 });
    workers.push(worker);
    worker.start();

    await vi.waitFor(async () => expect((await getRun(run.id))?.closedOutAt).toBeTruthy(), { timeout: 15_000, interval: 50 });
    expect((await getRun(run.id))?.errorMessage ?? "").toBe("");
    expect((await getRun(run.id))?.status).toBe("completed");

    // All three were working at once.
    expect(scriptedModel.maxInFlight).toBe(3);

    const children = await childrenOf(run.id);
    expect(children.map((c) => c.kind)).toEqual(["delegation", "delegation", "delegation"]);
    expect(children.every((c) => c.status === "completed" && c.depth === 1)).toBe(true);
    const handoffs = children.map((c) => parseStoredHandoff(c.resultJson));
    expect(handoffs.map((h) => h?.status).sort()).toEqual(["done", "done", "needs_input"]);
    expect(handoffs.find((h) => h?.summary === "Landing page built.")?.artifacts).toEqual([{ type: "pr", ref: "#12", title: "Landing page" }]);

    // The parent's next turn got all three handoffs back as one JSON array.
    const lastCall = JSON.stringify(scriptedModel.calls.at(-1)!.messages);
    for (const text of ["Landing page built.", "Copy written.", "20 outreach drafts ready.", "Which offer?"]) expect(lastCall).toContain(text);

    // The root's event log shows three starts and three structured finishes.
    const events = await eventsOf(run.id);
    expect(events.filter((e) => e.type === "delegate_start")).toHaveLength(3);
    const done = events.filter((e) => e.type === "delegate_done") as Array<{ status?: string; summary?: string }>;
    expect(done.map((e) => e.status).sort()).toEqual(["done", "done", "needs_input"]);

    // Three child sessions hang off the root session (the delegation tree the UI draws).
    expect(await prisma.taskSession.count({ where: { parentSessionId: session.id } })).toBe(3);
  });
});

describe("typed briefs", () => {
  it("passes objective, context, constraints, criteria and deadline to the teammate", async () => {
    const { ops } = await team();
    scriptedModel.load([
      call("delegate_agent", {
        agentSlug: "mkt",
        objective: "Write the launch post",
        context: "We launch Tuesday",
        constraints: "Under 200 words",
        acceptanceCriteria: ["mentions pricing", "has a call to action"],
        deadline: "2026-10-06"
      }),
      finish("Post written."),
      { text: "ok" }
    ]);
    const { run } = await startRoot(ops.id);
    await drainAll();

    const [child] = await childrenOf(run.id);
    for (const part of ["Objective: Write the launch post", "Context:\nWe launch Tuesday", "Constraints:\nUnder 200 words", "- mentions pricing", "Deadline: 2026-10-06", "Delegated by: Operations Agent"]) {
      expect(child!.requestText).toContain(part);
    }
    const task = await prisma.task.findUniqueOrThrow({ where: { id: child!.taskId! } });
    expect(task.dueAt?.toISOString().slice(0, 10)).toBe("2026-10-06");
    // The child's model saw the brief.
    expect(JSON.stringify(scriptedModel.calls[1]!.messages)).toContain("mentions pricing");
  });

  it("still accepts the older `task` field", async () => {
    const { ops } = await team();
    scriptedModel.load([call("delegate_agent", { agentSlug: "mkt", task: "Old style brief" }), finish("ok"), { text: "done" }]);
    const { run } = await startRoot(ops.id);
    await drainAll();
    expect((await childrenOf(run.id))[0]!.requestText).toContain("Objective: Old style brief");
  });
});

describe("finish_run", () => {
  it("rejects an invalid handoff and lets the agent try again", async () => {
    const { ops } = await team();
    scriptedModel.load([
      call("delegate_agent", { agentSlug: "mkt", objective: "copy" }),
      call("finish_run", { status: "great", summary: "" }),
      finish("Copy ready."),
      { text: "done" }
    ]);
    const { run } = await startRoot(ops.id);
    await drainAll();
    expect(JSON.stringify(scriptedModel.calls[2]!.messages)).toContain("finish_run input is invalid");
    const [child] = await childrenOf(run.id);
    expect(parseStoredHandoff(child!.resultJson)?.summary).toBe("Copy ready.");
  });

  it("asks a delegated agent once to hand off properly, then wraps its text", async () => {
    const { ops } = await team();
    scriptedModel.load([call("delegate_agent", { agentSlug: "mkt", objective: "copy" }), { text: "Here is the copy." }, { text: "Still just text." }, { text: "done" }]);
    const { run } = await startRoot(ops.id);
    await drainAll();
    expect(JSON.stringify(scriptedModel.calls[2]!.messages)).toContain("You ended without calling finish_run");
    const [child] = await childrenOf(run.id);
    expect(child!.status).toBe("completed");
    expect(parseStoredHandoff(child!.resultJson)).toMatchObject({ status: "done", summary: "Here is the copy.Still just text." });
  });

  it("a root run may end with finish_run too, and its session shows the handoff", async () => {
    const { ops } = await team();
    scriptedModel.load([finish("All set.", { nextSteps: ["Announce on Friday"] })]);
    const { run, session } = await startRoot(ops.id);
    await drainAll();
    expect((await getRun(run.id))?.status).toBe("completed");
    const scratchpad = (await prisma.taskSession.findUniqueOrThrow({ where: { id: session.id } })).scratchpad;
    expect(scratchpad).toContain("All set.");
    expect(scratchpad).toContain("Announce on Friday");
  });
});

describe("budgets", () => {
  it("splits the parent's remaining budget among the teammates it starts in one turn", async () => {
    vi.stubEnv("AGENT_RUN_BUDGET_CENTS", "100");
    const { ops } = await team();
    scriptedModel.load([
      call("delegate_many", {
        delegations: [
          { agentSlug: "eng", objective: "a" },
          { agentSlug: "mkt", objective: "b", budgetCents: 5 },
          { agentSlug: "sales", objective: "c", budgetCents: 500 }
        ]
      }),
      finish("a"),
      finish("b"),
      finish("c"),
      { text: "done" }
    ]);
    const { run } = await startRoot(ops.id);
    await drainAll();
    const caps = (await childrenOf(run.id)).map((c) => c.budgetCapCents!);
    const share = caps[0]!;
    expect(share).toBeGreaterThan(30);
    expect(share).toBeLessThan(100 / 3);
    expect(caps[1]).toBe(5); // a lower request is honored
    expect(caps[2]).toBe(share); // a higher one is capped at the share
  });

  it("stops a teammate that spends its share and reports a failed handoff to the parent", async () => {
    const { ops } = await team();
    scriptedModel.load([
      call("delegate_agent", { agentSlug: "mkt", objective: "copy", budgetCents: 0.001 }),
      // The child's first turn costs more than its tiny share; it is stopped before a second one.
      call("write_file", { name: "draft.md", content: "x" }, { usage: { input: 10_000, output: 1000 } }),
      { text: "I will handle it." }
    ]);
    const { run } = await startRoot(ops.id);
    await drainAll();
    const [child] = await childrenOf(run.id);
    expect(child!.status).toBe("failed");
    expect(child!.errorMessage).toMatch(/budget share/);
    expect(JSON.stringify(scriptedModel.calls.at(-1)!.messages)).toContain('\\"status\\":\\"failed\\"');
    expect((await getRun(run.id))?.status).toBe("completed");
  });

  it("charges each run with its own spend plus everything under it", async () => {
    const { ops } = await team();
    scriptedModel.load([call("delegate_agent", { agentSlug: "mkt", objective: "copy" }), finish("done"), { text: "ok" }]);
    const { run } = await startRoot(ops.id);
    await drainAll();
    const root = (await getRun(run.id))!;
    const [child] = await childrenOf(run.id);
    expect(child!.costCents).toBeGreaterThan(0);
    expect(root.costCents).toBeCloseTo(root.spentCents, 5);
    expect(root.costCents).toBeGreaterThan(child!.costCents);
    expect(parseStoredHandoff(child!.resultJson)?.costCents).toBeCloseTo(child!.costCents, 5);
  });
});

describe("ask_agent", () => {
  it("asks a teammate a read-only question and returns the answer without a visible task", async () => {
    const { ops } = await team();
    scriptedModel.load([call("ask_agent", { agentSlug: "mkt", question: "What tone do we use?" }), { text: "Plain and direct." }, { text: "ok" }]);
    const { run } = await startRoot(ops.id);
    await drainAll();

    const [consult] = await childrenOf(run.id);
    expect(consult).toMatchObject({ kind: "consult", status: "completed" });
    expect(consult!.budgetCapCents).toBeLessThanOrEqual(25);
    // The teammate only had read tools: nothing that writes, delegates or reaches people.
    const tools = scriptedModel.calls[1]!.toolNames;
    expect(tools).toContain("web_search");
    for (const name of ["write_file", "delegate_agent", "ask_user", "finish_run", "create_task"]) expect(tools).not.toContain(name);
    // Its task is archived so the task list is not cluttered with agent chatter.
    expect((await prisma.task.findUniqueOrThrow({ where: { id: consult!.taskId! } })).archivedAt).not.toBeNull();
    expect(JSON.stringify(scriptedModel.calls.at(-1)!.messages)).toContain("Plain and direct.");
  });
});

describe("ask_user", () => {
  it("pauses the run with a question in the founder's inbox and continues with the answer", async () => {
    const { ops } = await team();
    scriptedModel.load([call("ask_user", { question: "Which pricing tier do we launch with?", options: ["Free", "Pro"] }), { text: "Going with Pro." }]);
    const { run, session } = await startRoot(ops.id);
    await drainAll();

    expect((await getRun(run.id))?.status).toBe("waiting_approval");
    const [question] = await listOpenQuestions(ORG);
    expect(question).toMatchObject({ question: "Which pricing tier do we launch with?", options: ["Free", "Pro"], sessionId: session.id });
    const inbox = await getInboxItemsForUser({ orgId: ORG, userId: USER });
    expect(inbox.items[0]).toMatchObject({ kind: "agent_question" });
    expect((await eventsOf(run.id)).map((e) => e.type)).toContain("question_asked");

    // A question is not a tool approval: the approve endpoint does not answer it.
    expect(await answerQuestion({ orgId: ORG, approvalId: question!.id, userId: USER, answer: "Pro, $29" })).toEqual({ kind: "ok" });
    expect(await answerQuestion({ orgId: ORG, approvalId: question!.id, userId: USER, answer: "again" })).toMatchObject({ kind: "already_resolved" });
    await drainAll();

    expect((await getRun(run.id))?.status).toBe("completed");
    expect(JSON.stringify(scriptedModel.calls.at(-1)!.messages)).toContain("The founder answered: Pro, $29");
    expect(await listOpenQuestions(ORG)).toEqual([]);
  });

  it("carries on without an answer when the question expires", async () => {
    const { ops } = await team();
    scriptedModel.load([call("ask_user", { question: "Budget?" }), { text: "Assumed a small budget." }]);
    const { run } = await startRoot(ops.id);
    await drainAll();
    await prisma.approval.updateMany({ where: { kind: "question" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await testWorker().sweep();
    await drainAll();
    expect((await getRun(run.id))?.status).toBe("completed");
    expect(JSON.stringify(scriptedModel.calls.at(-1)!.messages)).toContain("did not answer in time");
  });
});

describe("agent directory", () => {
  it("tells every agent who is on the team, what they do and who is busy", async () => {
    const { ops, sales } = await team();
    // Sales already has a run going.
    await startRoot(sales.id, "Qualify leads");
    scriptedModel.load([{ text: "ok" }]);
    await startRoot(ops.id);
    const worker = testWorker();
    // Only the Operations run's first turn: the Sales run stays queued (and so counts as busy).
    const opsRun = await prisma.run.findFirstOrThrow({ where: { agentId: ops.id } });
    const { advanceRun } = await import("@/lib/agents/engine/advance");
    await advanceRun(opsRun.id, { workerId: worker.id });

    const system = scriptedModel.calls[0]!.system;
    expect(system).toContain("## Your team");
    expect(system).toContain("**Operations Agent** (you), slug `ops`");
    expect(system).toContain("**Marketing Agent**, slug `mkt`, marketing: Writes positioning and launch copy Capabilities: launch copy, SEO.");
    expect(system).toMatch(/\*\*Engineering Agent\*\*, slug `eng`.*Tools: github_list_repos/);
    expect(system).toMatch(/\*\*Sales Agent\*\*, slug `sales`.*Busy: 1 run in progress\./);
    expect(system).toContain("## Working with your team");
  });
});
