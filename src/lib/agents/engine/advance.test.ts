import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { scriptedModel, type ScriptedTurn } from "@/lib/agents/testing/scripted-anthropic";
import { ago, drainAll, fromNow, ORG, resetDb, seedAgent, seedTask, testWorker, USER } from "@/lib/agents/testing/test-db";
import { startAgentRun } from "@/lib/agents/run-service";
import { cancelRun, cancelRunsForTask } from "@/lib/agents/engine/advance";
import { getRun, getRunBySession, listEvents } from "@/lib/agents/engine/run-store";
import { getQueue } from "@/lib/agents/engine/queue";
import { resetCircuits } from "@/lib/agents/engine/models";
import { expireDueApprovals, resolveApproval } from "@/lib/agents/policy/approvals";
import { updatePolicy } from "@/lib/agents/policy/store";
import type { PermissionMode } from "@/lib/agents/run-scope";

const tools = vi.hoisted(() => ({
  search: vi.fn(async () => "3 results"),
  email: vi.fn(async () => "email sent"),
  push: vi.fn(async () => "pushed")
}));

vi.mock("@anthropic-ai/sdk", async () => (await import("@/lib/agents/testing/scripted-anthropic")).anthropicModuleMock);
vi.mock("@/lib/agents/prompt", () => ({
  buildPrompt: () => ({ system: "SYSTEM PROMPT", user: "USER PROMPT" }),
  loadOrgContext: async () => ({ businessPlan: "", brandKit: "" }),
  maybeExtractAndSaveBrandKit: async () => undefined
}));
// The real delegation definition, stand-ins for tools that would call outside services.
vi.mock("@/lib/agents/tools/registry", async () => {
  const { delegateAgentTool } = await import("@/lib/agents/tools/delegate-agent");
  const make = (name: string, execute: () => Promise<string>) => ({
    definition: { name, description: name, input_schema: { type: "object" as const, properties: {} } },
    execute
  });
  return {
    buildToolset: () => [
      delegateAgentTool,
      make("web_search", () => tools.search()),
      make("email_send", () => tools.email()),
      make("github_push_file", () => tools.push())
    ]
  };
});

const delegate = (agentSlug: string, task = "Write the launch copy"): ScriptedTurn => ({
  toolCalls: [{ name: "delegate_agent", input: { agentSlug, task } }]
});
const call = (name: string, input: Record<string, unknown> = {}): ScriptedTurn => ({ toolCalls: [{ name, input }] });

async function setup(mode: PermissionMode = "review_required") {
  const parent = await seedAgent({ slug: "engineering-default", name: "Engineering Agent", departmentSlug: "engineering", permissionMode: mode });
  const child = await seedAgent({ slug: "marketing-default", name: "Marketing Agent", departmentSlug: "marketing", permissionMode: "trusted" });
  const task = await seedTask({ agentId: parent.id, departmentId: parent.departmentId, title: "Launch the landing page" });
  const start = async () => {
    const session = await startAgentRun({ orgId: ORG, taskId: task.id, agentId: parent.id, message: "Launch the landing page" });
    const run = (await getRunBySession(session!.id))!;
    return { session: session!, run };
  };
  return { parent, child, task, start };
}

const eventsOf = async (runId: string) => (await listEvents(runId, 0, 1000)).map((e) => ({ type: e.type, ...e.data }));
const typesOf = async (runId: string) => (await eventsOf(runId)).map((e) => e.type);
const runStatus = async (runId: string) => (await getRun(runId))?.status;

async function pendingApproval() {
  return prisma.approval.findFirstOrThrow({ where: { status: "pending" }, orderBy: { createdAt: "desc" } });
}
const answer = (sessionId: string, approvalId: string, decision: "approve" | "deny", scope: "once" | "run" | "always" = "once") =>
  resolveApproval({ orgId: ORG, sessionId, approvalId, userId: USER, isAdmin: true, decision, scope });

beforeEach(async () => {
  await resetDb();
  scriptedModel.load([]);
  resetCircuits();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("AGENTS_PAUSED", "");
  vi.stubEnv("MODEL_RETRY_BASE_MS", "0");
});
afterEach(() => vi.unstubAllEnvs());

describe("a single agent", () => {
  it("completes, finalizes the session and task, records usage and logs its events", async () => {
    const { task, start } = await setup();
    scriptedModel.load([{ text: "Nothing to delegate, all done." }]);
    const { session, run } = await start();

    expect(session.status).toBe("running"); // the caller gets the session at once; the work happens in a worker
    expect(await runStatus(run.id)).toBe("queued");

    await drainAll();

    const done = (await getRun(run.id))!;
    expect(done).toMatchObject({ status: "completed", outputText: "Nothing to delegate, all done.", turnCount: 1 });
    expect((await prisma.taskSession.findUnique({ where: { id: session.id } }))?.status).toBe("completed");
    expect((await prisma.task.findUnique({ where: { id: task.id } }))?.status).toBe("ready_to_review");
    expect((await prisma.agent.findFirst({ where: { slug: "engineering-default" } }))?.status).toBe("idle");
    expect((await prisma.taskSession.findUnique({ where: { id: session.id } }))?.scratchpad).toContain("Usage: ~");

    const usage = await prisma.usageRecord.findMany();
    expect(usage).toEqual([expect.objectContaining({ category: "tokens", quantity: 150, unit: "tokens", sourceId: `run:${session.id}` })]);
    expect(await eventsOf(run.id)).toEqual([
      { type: "text_delta", delta: "Nothing to delegate, all done." },
      { type: "done", output: "Nothing to delegate, all done." }
    ]);
  });

  it("does the work in steps, each written to the database before the next begins", async () => {
    const { start } = await setup();
    scriptedModel.load([call("web_search", { query: "x" }), { text: "Found it." }]);
    const { run } = await start();
    const worker = testWorker();

    await worker.runOnce(); // model turn asking for a tool
    let row = (await getRun(run.id))!;
    expect(row.status).toBe("running");
    expect(JSON.parse(row.stateJson!).pending).toEqual([expect.objectContaining({ name: "web_search", status: "pending" })]);
    expect(tools.search).not.toHaveBeenCalled();

    await worker.runOnce(); // run the tool and hand its result back to the conversation
    row = (await getRun(run.id))!;
    const state = JSON.parse(row.stateJson!);
    expect(state.pending).toBeNull();
    expect(JSON.stringify(state.messages.at(-1))).toContain("3 results");
    expect(tools.search).toHaveBeenCalledOnce();

    await worker.runOnce(); // final model turn
    expect(await runStatus(run.id)).toBe("completed");
    expect(await typesOf(run.id)).toEqual(["tool_call", "tool_result", "text_delta", "done"]);
  });

  it("records every tool call as an AgentAction", async () => {
    const { start } = await setup();
    scriptedModel.load([call("web_search"), { text: "ok" }]);
    await start();
    await drainAll();
    const actions = await prisma.agentAction.findMany({ where: { actionType: "tool.web_search" } });
    expect(actions).toEqual([expect.objectContaining({ status: "completed" })]);
  });
});

describe("delegation", () => {
  it("runs the child as its own run, links it to the parent and feeds its result back", async () => {
    const { start } = await setup("review_required");
    scriptedModel.load([delegate("marketing-default"), { text: "Launch copy drafted." }, { text: "Landing page is ready." }]);
    const { session, run } = await start();

    await drainAll();

    expect((await getRun(run.id))?.status).toBe("completed");
    const child = (await prisma.run.findFirstOrThrow({ where: { parentRunId: run.id } }))!;
    expect(child).toMatchObject({ status: "completed", depth: 1, rootRunId: run.id, outputText: "Launch copy drafted." });
    expect((await prisma.taskSession.findUniqueOrThrow({ where: { id: child.sessionId } })).parentSessionId).toBe(session.id);

    // The parent's next model call carries the child's output as the tool result.
    expect(JSON.stringify(scriptedModel.calls[2]!.messages)).toContain("Launch copy drafted.");
    expect(await prisma.approval.count()).toBe(0); // delegating never asks

    const parentTypes = await typesOf(run.id);
    expect(parentTypes).toEqual(["delegate_start", "delegate_done", "text_delta", "done"]);
    // One usage record for the whole tree, attributed to the root.
    expect(await prisma.usageRecord.findMany()).toEqual([expect.objectContaining({ quantity: 450 })]);
  });

  it("starts every delegate of one turn before any of them finishes (parallel fan-out)", async () => {
    const { start } = await setup();
    await seedAgent({ slug: "sales-default", name: "Sales Agent", departmentSlug: "sales" });
    scriptedModel.load([
      { toolCalls: [
        { name: "delegate_agent", input: { agentSlug: "marketing-default", task: "copy" } },
        { name: "delegate_agent", input: { agentSlug: "sales-default", task: "outreach" } }
      ] },
      { text: "copy done" },
      { text: "outreach done" },
      { text: "All delegated work is done." }
    ]);
    const { run } = await start();
    const worker = testWorker();

    await worker.runOnce(); // parent's model turn
    await worker.runOnce(); // parent's tool calls: both children are created here
    const children = await prisma.run.findMany({ where: { parentRunId: run.id } });
    expect(children).toHaveLength(2);
    expect(children.every((c) => c.status === "queued")).toBe(true); // neither has run yet
    expect(await runStatus(run.id)).toBe("waiting_children");

    await drainAll(worker);
    expect(await runStatus(run.id)).toBe("completed");
    const parentMessages = JSON.stringify(scriptedModel.calls.at(-1)!.messages);
    expect(parentMessages).toContain("copy done");
    expect(parentMessages).toContain("outreach done");
  });

  it("tells the agent, without crashing, when the target does not exist", async () => {
    const { start } = await setup();
    scriptedModel.load([delegate("nope", "x"), { text: "Could not delegate." }]);
    const { run } = await start();
    await drainAll();

    expect(await runStatus(run.id)).toBe("completed");
    expect((await eventsOf(run.id)).find((e) => e.type === "tool_result" && (e as { tool?: string }).tool === "delegate_agent" || false)).toBeUndefined();
    expect(JSON.stringify(scriptedModel.calls[1]!.messages)).toContain('no agent with slug \\"nope\\"');
  });

  it("refuses to delegate to itself and creates nothing", async () => {
    const { start } = await setup();
    scriptedModel.load([delegate("engineering-default"), { text: "I will do it myself." }]);
    const { run } = await start();
    await drainAll();

    expect(await runStatus(run.id)).toBe("completed");
    expect(JSON.stringify(scriptedModel.calls[1]!.messages)).toMatch(/cannot delegate.*itself/i);
    expect(await prisma.run.count()).toBe(1);
    expect(await prisma.task.count()).toBe(1);
  });

  it("refuses a delegation loop back to an agent already in the chain", async () => {
    const { start } = await setup();
    // Engineering -> Marketing -> Engineering (blocked) -> Marketing finishes -> Engineering finishes
    scriptedModel.load([delegate("marketing-default"), delegate("engineering-default"), { text: "Marketing done." }, { text: "All done." }]);
    const { run } = await start();
    await drainAll();

    expect(await runStatus(run.id)).toBe("completed");
    expect(JSON.stringify(scriptedModel.calls[2]!.messages)).toMatch(/loop/);
    expect(await prisma.run.count({ where: { parentRunId: { not: null } } })).toBe(1);
  });

  it("refuses delegation deeper than the depth limit", async () => {
    vi.stubEnv("AGENT_MAX_DEPTH", "1");
    const { start } = await setup();
    await seedAgent({ slug: "sales-default", name: "Sales Agent", departmentSlug: "sales" });
    scriptedModel.load([delegate("marketing-default"), delegate("sales-default"), { text: "Did it myself." }, { text: "Done." }]);
    const { run } = await start();
    await drainAll();

    expect(await runStatus(run.id)).toBe("completed");
    expect(JSON.stringify(scriptedModel.calls[2]!.messages)).toMatch(/depth limit/i);
    expect(await prisma.run.count({ where: { parentRunId: { not: null } } })).toBe(1);
  });

  it("never lets a delegated agent be less restricted than its caller, and surfaces its approval on the root run", async () => {
    const { start } = await setup("review_required");
    // The child is configured 'trusted' but inherits review_required, so its push asks first.
    scriptedModel.load([delegate("marketing-default"), call("github_push_file", { path: "a.ts" }), { text: "Pushed." }, { text: "Done." }]);
    const { session, run } = await start();

    await drainAll();
    expect(await runStatus(run.id)).toBe("waiting_children");
    const child = await prisma.run.findFirstOrThrow({ where: { parentRunId: run.id } });
    expect(child.status).toBe("waiting_approval");
    expect(child.mode).toBe("review_required");
    expect(tools.push).not.toHaveBeenCalled();

    // The person watching the root run sees the child's approval in the root's event log...
    expect(await typesOf(run.id)).toContain("approval_required");
    // ...and answers it on the root session.
    const approval = await pendingApproval();
    expect(approval.sessionId).toBe(child.sessionId);
    expect(await answer(session.id, approval.id, "approve")).toMatchObject({ kind: "ok", approved: true });
    await drainAll();

    expect(await runStatus(run.id)).toBe("completed");
    expect(tools.push).toHaveBeenCalledOnce();
  });

  it("gives a delegated run the same tool-call budget as its parent tree", async () => {
    vi.stubEnv("AGENT_MAX_TOOL_CALLS", "2");
    const { start } = await setup();
    // parent delegate (call 1) -> child search (call 2) -> child's third call hits the shared limit
    scriptedModel.load([delegate("marketing-default"), call("web_search", { n: 1 }), call("web_search", { n: 2 })]);
    const { run } = await start();
    await drainAll();

    const root = (await getRun(run.id))!;
    expect(root.status).toBe("failed");
    expect(root.errorMessage).toMatch(/tool-call limit/i);
    const child = await prisma.run.findFirstOrThrow({ where: { parentRunId: run.id } });
    expect(child.status).toBe("failed");
    expect(tools.search).toHaveBeenCalledTimes(1);
  });
});

describe("approvals", () => {
  it("pauses in the database until a person answers, then continues", async () => {
    const { start } = await setup("review_required");
    scriptedModel.load([call("email_send", { to: "a@b.co", subject: "Hi", body: "Hello" }), { text: "Sent." }]);
    const { session, run } = await start();

    await drainAll();
    expect(await runStatus(run.id)).toBe("waiting_approval");
    expect(tools.email).not.toHaveBeenCalled();
    expect(scriptedModel.remaining).toBe(1);
    expect(await getQueue().hasPending(run.id)).toBe(false); // nothing is polling; it just waits

    const approval = await pendingApproval();
    expect(approval).toMatchObject({ toolName: "email_send", riskLevel: "external_comms", sessionId: session.id, taskId: null });
    expect(await answer(session.id, approval.id, "approve")).toMatchObject({ kind: "ok" });
    expect(await getQueue().hasPending(run.id)).toBe(true); // answering woke the run

    await drainAll();
    expect(await getRun(run.id)).toMatchObject({ status: "completed", outputText: "Sent." });
    expect(tools.email).toHaveBeenCalledOnce();
    const asked = (await eventsOf(run.id)).find((e) => e.type === "approval_required");
    expect(asked).toMatchObject({ tool: "email_send", risk: "external_comms", approvalId: approval.id });
  });

  it("carries on after a restart: a different worker with no memory of the run resumes it", async () => {
    const { start } = await setup("review_required");
    scriptedModel.load([call("email_send", { to: "a@b.co" }), { text: "Sent." }]);
    const { session, run } = await start();

    await drainAll(testWorker({ id: "before-restart" }));
    expect(await runStatus(run.id)).toBe("waiting_approval");

    // Days later, after a deploy: nothing in memory survives, only the database.
    resetCircuits();
    const approval = await pendingApproval();
    await prisma.approval.update({ where: { id: approval.id }, data: { expiresAt: fromNow(3 * 86_400_000) } });
    await answer(session.id, approval.id, "approve");
    await drainAll(testWorker({ id: "after-restart" }));

    expect(await runStatus(run.id)).toBe("completed");
    expect(tools.email).toHaveBeenCalledOnce();
  });

  it("gives the model a 'denied' result and never sends when the human says no", async () => {
    const { start } = await setup("review_required");
    scriptedModel.load([call("email_send", { to: "a@b.co" }), { text: "Understood, not sending." }]);
    const { session, run } = await start();
    await drainAll();

    await answer(session.id, (await pendingApproval()).id, "deny");
    await drainAll();

    expect(tools.email).not.toHaveBeenCalled();
    expect(JSON.stringify(scriptedModel.calls[1]!.messages)).toMatch(/denied/i);
    expect(await runStatus(run.id)).toBe("completed");
    expect((await prisma.agentAction.findFirstOrThrow({ where: { actionType: "tool.email_send" } })).status).toBe("denied");
  });

  it("asks about email even in trusted mode and without any delegation", async () => {
    const { start } = await setup("trusted");
    scriptedModel.load([call("email_send", { to: "a@b.co" }), { text: "ok" }]);
    const { run } = await start();
    await drainAll();
    expect(await runStatus(run.id)).toBe("waiting_approval");
  });

  it("treats an unanswered approval as not approved once it expires, and the run continues without it", async () => {
    const { start } = await setup("review_required");
    scriptedModel.load([call("email_send", { to: "a@b.co" }), { text: "Carrying on without it." }]);
    const { run } = await start();
    await drainAll();

    const approval = await pendingApproval();
    await prisma.approval.update({ where: { id: approval.id }, data: { expiresAt: ago(1000) } });
    expect(await expireDueApprovals()).toBe(1);
    await drainAll();

    expect(tools.email).not.toHaveBeenCalled();
    expect((await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).status).toBe("expired");
    expect(JSON.stringify(scriptedModel.calls[1]!.messages)).toMatch(/no one approved/i);
    expect(await runStatus(run.id)).toBe("completed");
  });

  it("'for this run' pre-approves the same tool for the rest of the run", async () => {
    const { start } = await setup("review_required");
    scriptedModel.load([call("github_push_file", { path: "a.ts" }), call("github_push_file", { path: "b.ts" }), { text: "Both pushed." }]);
    const { session, run } = await start();
    await drainAll();

    expect(await answer(session.id, (await pendingApproval()).id, "approve", "run")).toMatchObject({ scopeApplied: "run" });
    await drainAll();

    expect(await runStatus(run.id)).toBe("completed");
    expect(tools.push).toHaveBeenCalledTimes(2);
    expect(await prisma.approval.count()).toBe(1); // the second push did not ask
  });

  it("does not run an identical outside-effect call twice within a run", async () => {
    const { start } = await setup("trusted");
    scriptedModel.load([call("github_push_file", { path: "a.ts" }), call("github_push_file", { path: "a.ts" }), { text: "done" }]);
    const { run } = await start();
    await drainAll();

    expect(await runStatus(run.id)).toBe("completed");
    expect(tools.push).toHaveBeenCalledOnce();
    expect(JSON.stringify(scriptedModel.calls[2]!.messages)).toMatch(/already completed/);
  });
});

describe("limits and switches", () => {
  it("stops when the budget is spent and keeps the partial output", async () => {
    vi.stubEnv("AGENT_RUN_BUDGET_CENTS", "5");
    const { start } = await setup();
    scriptedModel.load([{ text: "Partial findings.", toolCalls: [{ name: "web_search", input: {} }], usage: { input: 0, output: 1_000_000 } }]);
    const { session, run } = await start();
    await drainAll();

    const row = (await getRun(run.id))!;
    expect(row.status).toBe("failed");
    expect(row.outputText).toBe("Partial findings.");
    expect(row.errorMessage).toMatch(/budget/i);
    expect(await typesOf(run.id)).toEqual(expect.arrayContaining(["limit_reached", "error"]));
    expect(scriptedModel.calls).toHaveLength(1);
    expect((await prisma.taskSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe("error");
    expect((await prisma.usageRecord.findFirstOrThrow()).costCents).toBeGreaterThan(5);
  });

  it("stops at the step limit", async () => {
    vi.stubEnv("AGENT_MAX_STEPS", "2");
    const { start } = await setup();
    scriptedModel.load([call("web_search", { n: 1 }), call("web_search", { n: 2 }), { text: "never reached" }]);
    const { run } = await start();
    await drainAll();

    expect((await getRun(run.id))?.status).toBe("failed");
    expect(await typesOf(run.id)).toContain("limit_reached");
    expect(scriptedModel.calls).toHaveLength(2);
  });

  it("fails a run without calling any model when AGENTS_PAUSED is on", async () => {
    const { start } = await setup();
    scriptedModel.load([{ text: "should never be requested" }]);
    const { session, run } = await start();
    vi.stubEnv("AGENTS_PAUSED", "1");
    await drainAll();

    expect((await getRun(run.id))?.errorMessage).toMatch(/paused/);
    expect(scriptedModel.calls).toHaveLength(0);
    expect((await prisma.taskSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe("error");
  });

  it("fails a run when its organization is paused before it gets going", async () => {
    const { start } = await setup();
    scriptedModel.load([{ text: "should never be requested" }]);
    const { run } = await start();
    await updatePolicy(ORG, { agentsPaused: true });
    await drainAll();

    expect((await getRun(run.id))?.errorMessage).toMatch(/paused for this organization/);
    expect(scriptedModel.calls).toHaveLength(0);
  });

  it("surfaces a missing API key as an actionable error on the run, session and task chat", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { task, start } = await setup();
    const { session, run } = await start();
    await drainAll();

    expect((await getRun(run.id))?.errorMessage).toContain("ANTHROPIC_API_KEY is not set");
    expect((await prisma.taskSession.findUniqueOrThrow({ where: { id: session.id } })).scratchpad).toContain("ANTHROPIC_API_KEY is not set");
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("todo");
    expect((await prisma.chatMessage.findMany()).some((m) => m.body.includes("ANTHROPIC_API_KEY"))).toBe(true);
    expect(scriptedModel.calls).toHaveLength(0);
  });
});

describe("cancellation", () => {
  it("cancels a run that is waiting for approval and closes the approval", async () => {
    const { start } = await setup("review_required");
    scriptedModel.load([call("email_send", { to: "a@b.co" })]);
    const { session, run } = await start();
    await drainAll();
    const approval = await pendingApproval();

    await cancelRun(run.id, "No longer needed.");

    expect(await runStatus(run.id)).toBe("cancelled");
    expect((await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).status).toBe("cancelled");
    expect((await prisma.taskSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe("canceled");
    expect(await typesOf(run.id)).toContain("error");
    // Answering a cancelled run's approval is refused instead of resurrecting it.
    expect(await answer(session.id, approval.id, "approve")).toMatchObject({ kind: "already_resolved" });
    await drainAll();
    expect(tools.email).not.toHaveBeenCalled();
  });

  it("cancels everything a run delegated to", async () => {
    const { start } = await setup("review_required");
    scriptedModel.load([delegate("marketing-default"), call("github_push_file", { path: "a.ts" })]);
    const { run } = await start();
    await drainAll();
    const child = await prisma.run.findFirstOrThrow({ where: { parentRunId: run.id } });
    expect(child.status).toBe("waiting_approval");

    await cancelRun(run.id);

    expect(await runStatus(child.id)).toBe("cancelled");
    expect((await prisma.approval.findFirstOrThrow()).status).toBe("cancelled");
  });

  it("stops a run when its task is cancelled", async () => {
    const { task, start } = await setup("review_required");
    scriptedModel.load([call("email_send", { to: "a@b.co" })]);
    const { run } = await start();
    await drainAll();

    await cancelRunsForTask(task.id);
    expect(await runStatus(run.id)).toBe("cancelled");
  });

  it("does not let a step that was in flight bring a cancelled run back", async () => {
    const { start } = await setup();
    scriptedModel.load([{ text: "This answer arrives after the cancel." }]);
    const { run } = await start();

    await cancelRun(run.id);
    await drainAll();

    expect(await runStatus(run.id)).toBe("cancelled");
    expect(scriptedModel.calls).toHaveLength(0);
  });

  it("fails a run's delegated children when the parent fails", async () => {
    vi.stubEnv("AGENT_RUN_BUDGET_CENTS", "5");
    const { start } = await setup("review_required");
    // The parent burns its budget in the same turn that delegates; the child must not keep running.
    scriptedModel.load([{ ...delegate("marketing-default"), usage: { input: 0, output: 1_000_000 } }]);
    const { run } = await start();
    await drainAll();

    expect(await runStatus(run.id)).toBe("failed");
    const children = await prisma.run.findMany({ where: { parentRunId: run.id } });
    expect(children.every((c) => c.status === "cancelled" || c.status === "failed")).toBe(true);
  });
});

describe("crash recovery", () => {
  /** Simulate a worker dying mid-step: its lease on the job and the run simply runs out. */
  async function expireLeases() {
    await prisma.job.updateMany({ where: { status: "active" }, data: { lockedUntil: ago(1000) } });
    await prisma.run.updateMany({ where: { lockedUntil: { not: null } }, data: { lockedUntil: ago(1000) } });
  }

  it("re-runs a read-only call that a dead worker never finished, on a different worker", async () => {
    let attempts = 0;
    tools.search.mockImplementation(async () => {
      attempts += 1;
      if (attempts === 1) return new Promise<string>(() => undefined); // the first worker hangs here forever
      return "3 results";
    });
    const { start } = await setup();
    scriptedModel.load([call("web_search", { q: "x" }), { text: "Found it." }]);
    const { run } = await start();

    const dying = testWorker({ id: "dying-worker" });
    await dying.runOnce(); // model turn
    void dying.runOnce(); // tool call: never returns, as if the process was killed
    await vi.waitFor(async () => expect(JSON.parse((await getRun(run.id))!.stateJson!).pending[0].status).toBe("executing"));

    await expireLeases();
    const survivor = testWorker({ id: "survivor" });
    const stats = await survivor.sweep();
    expect(stats.requeuedJobs).toBe(1);
    await drainAll(survivor);

    expect(await getRun(run.id)).toMatchObject({ status: "completed", outputText: "Found it." });
    expect(attempts).toBe(2);
  });

  it("does not repeat a call with outside effects that a dead worker may have completed", async () => {
    let attempts = 0;
    tools.push.mockImplementation(async () => {
      attempts += 1;
      return new Promise<string>(() => undefined);
    });
    const { start } = await setup("trusted");
    scriptedModel.load([call("github_push_file", { path: "a.ts" }), { text: "Checked before retrying." }]);
    const { run } = await start();

    const dying = testWorker({ id: "dying-worker" });
    await dying.runOnce();
    void dying.runOnce();
    await vi.waitFor(async () => expect(JSON.parse((await getRun(run.id))!.stateJson!).pending[0].status).toBe("executing"));

    await expireLeases();
    const survivor = testWorker({ id: "survivor" });
    await survivor.sweep();
    await drainAll(survivor);

    expect(attempts).toBe(1); // never run a second time
    expect(JSON.stringify(scriptedModel.calls[1]!.messages)).toMatch(/interrupted by a restart/);
    expect(await runStatus(run.id)).toBe("completed");
  });

  it("wakes a run that has no job behind it", async () => {
    const { start } = await setup();
    scriptedModel.load([{ text: "Recovered." }]);
    const { run } = await start();
    await prisma.job.deleteMany(); // the queue lost it
    await prisma.run.update({ where: { id: run.id }, data: { updatedAt: ago(10 * 60_000) } });

    const worker = testWorker();
    expect((await worker.sweep()).reawakenedRuns).toBe(1);
    await drainAll(worker);
    expect(await runStatus(run.id)).toBe("completed");
  });
});

describe("provider failures", () => {
  it("retries a temporary provider error later instead of failing the run", async () => {
    const { start } = await setup();
    scriptedModel.load([
      { error: { status: 503, message: "overloaded" } },
      { error: { status: 503, message: "overloaded" } },
      { error: { status: 503, message: "overloaded" } },
      { text: "Back online." }
    ]);
    const { run } = await start();
    const worker = testWorker();

    await drainAll(worker);
    expect(await runStatus(run.id)).toBe("running"); // not failed
    const job = await prisma.job.findFirstOrThrow({ where: { runId: run.id } });
    expect(job).toMatchObject({ status: "queued", attempts: 1 });
    expect(job.lastError).toMatch(/did not respond/);

    await prisma.job.update({ where: { id: job.id }, data: { runAt: ago(1000) } }); // the backoff has passed
    await drainAll(worker);
    expect(await getRun(run.id)).toMatchObject({ status: "completed", outputText: "Back online." });
  });

  it("fails the run at once for an error a retry cannot fix", async () => {
    const { start } = await setup();
    scriptedModel.load([{ error: { status: 401, message: "invalid x-api-key" } }]);
    const { run } = await start();
    await drainAll();

    expect(await getRun(run.id)).toMatchObject({ status: "failed" });
    expect((await getRun(run.id))?.errorMessage).toMatch(/invalid x-api-key/);
  });
});

describe("event log", () => {
  it("lets a client that reconnects pick up exactly where it left off", async () => {
    const { start } = await setup();
    scriptedModel.load([call("web_search"), { text: "Answer." }]);
    const { run } = await start();
    await drainAll();

    const all = await listEvents(run.id, 0);
    expect(all.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    const missed = await listEvents(run.id, 2); // the client saw up to event 2
    expect(missed.map((e) => e.type)).toEqual(["text_delta", "done"]);
  });
});
