import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import {
  evaluateToolCall,
  finishUnapprovedCall,
  requestToolApproval,
  runToolCall,
  type Evaluation
} from "@/lib/agents/tool-executor";
import { LimitExceededError, RunBudget, type RunLimits } from "@/lib/agents/policy/limits";
import { updatePolicy } from "@/lib/agents/policy/store";
import type { AgentEvent } from "@/lib/agents/events";
import type { PermissionMode, RunScope } from "@/lib/agents/run-scope";
import type { AgentTool, ToolContext } from "@/lib/agents/tools/types";
import { ORG, resetDb, seedAgent, seedSession } from "@/lib/agents/testing/test-db";

// These are unit tests of the executor's pieces. The full approve / deny / expire / resume flow through
// the step machine is covered in engine/advance.test.ts.

const LIMITS: RunLimits = { maxDepth: 3, maxSteps: 60, maxToolCalls: 100, budgetCents: 200 };

function fakeTool(name: string, execute: (input: Record<string, unknown>) => Promise<string> | string = () => "ok") {
  const run = vi.fn(async (input: Record<string, unknown>) => execute(input));
  const tool: AgentTool = {
    definition: { name, description: name, input_schema: { type: "object", properties: {} } },
    execute: run
  };
  return { tool, run };
}

async function setup(mode: PermissionMode, opts: { limits?: RunLimits; grants?: string[]; slug?: string } = {}) {
  const agent = await seedAgent({
    slug: opts.slug ?? "eng", name: "Engineering Agent", departmentSlug: "engineering", permissionMode: mode
  });
  const session = await seedSession(agent.id);
  const scope: RunScope = {
    tree: {
      rootRunId: "run_test",
      rootSessionId: session.id,
      budget: new RunBudget(opts.limits ?? LIMITS),
      grants: new Set(opts.grants ?? [])
    },
    depth: 0,
    callChain: [agent.id],
    mode
  };
  const ctx: ToolContext = { orgId: ORG, agentId: agent.id, sessionId: session.id, skillKeys: [], scope };
  const events: AgentEvent[] = [];
  const emit = async (e: AgentEvent) => {
    events.push(e);
  };
  const evaluate = (toolset: AgentTool[], toolName: string, toolInput: Record<string, unknown> = {}, counted = false) =>
    evaluateToolCall({ toolName, toolInput, toolset, ctx, counted, emit });

  /** What the step machine does for a call that is allowed to run: evaluate, then run it. */
  const callAllowed = async (tool: AgentTool, toolInput: Record<string, unknown> = {}) => {
    const evaluation = await evaluate([tool], tool.definition.name, toolInput);
    if (evaluation.kind === "result") return evaluation.result;
    if (evaluation.kind !== "run") throw new Error(`expected the call to run, got ${evaluation.kind}`);
    return runToolCall({
      toolName: tool.definition.name, toolInput, tool, ctx, risk: evaluation.risk,
      idempotencyKey: evaluation.idempotencyKey, actionId: null, approvalId: null, emit
    });
  };
  return { agent, session, scope, ctx, events, emit, evaluate, callAllowed };
}

const actions = () => prisma.agentAction.findMany({ orderBy: { createdAt: "asc" } });
const kindOf = (e: Evaluation) => e.kind;

beforeEach(resetDb);
afterEach(() => vi.unstubAllEnvs());

describe("running allowed calls", () => {
  it("runs a low-risk tool, records it and emits call and result events", async () => {
    const { session, events, callAllowed } = await setup("review_required");
    const search = fakeTool("web_search", () => "3 results");

    const result = await callAllowed(search.tool, { query: "x" });

    expect(result).toMatchObject({ output: "3 results", success: true, outcome: "completed" });
    expect(search.run).toHaveBeenCalledOnce();
    expect(events.map((e) => e.type)).toEqual(["tool_call", "tool_result"]);
    const recorded = await actions();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ actionType: "tool.web_search", status: "completed", sessionId: session.id });
    expect(recorded[0]?.completedAt).toBeInstanceOf(Date);
    expect(await prisma.approval.count()).toBe(0);
  });

  it("redacts secrets and caps the size of what goes back to the model and into the log", async () => {
    const { callAllowed } = await setup("review_required");
    const leaky = fakeTool("read_file", () => `token sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123 ${"z".repeat(20_000)}`);

    const { output } = await callAllowed(leaky.tool);

    expect(output).not.toContain("sk-ant-");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("output truncated");
    expect(output.length).toBeLessThan(13_000);
    expect(String((await actions())[0]?.payloadJson)).not.toContain("sk-ant-");
  });

  it("returns a failed result, not a crash, when the tool throws", async () => {
    const { callAllowed } = await setup("review_required");
    const broken = fakeTool("read_file", () => {
      throw new Error("disk on fire");
    });

    const result = await callAllowed(broken.tool);

    expect(result).toMatchObject({ success: false, outcome: "failed" });
    expect(result.output).toContain("disk on fire");
    expect((await actions())[0]?.status).toBe("failed");
  });

  it("fails a tool that runs past the timeout", async () => {
    vi.stubEnv("AGENT_TOOL_TIMEOUT_MS", "20");
    const { callAllowed } = await setup("review_required");
    const slow = fakeTool("read_file", () => new Promise<string>((resolve) => setTimeout(() => resolve("late"), 500)));

    const result = await callAllowed(slow.tool);

    expect(result).toMatchObject({ success: false, outcome: "failed" });
    expect(result.output).toMatch(/timed out/);
  });

  it("reports an unknown tool without running anything", async () => {
    const { evaluate, events } = await setup("review_required");
    const evaluation = await evaluate([], "made_up_tool");
    expect(evaluation).toEqual({
      kind: "result", result: { success: false, outcome: "failed", output: "Unknown tool: made_up_tool" }
    });
    expect(events.map((e) => e.type)).toEqual(["tool_call", "tool_result"]);
  });
});

describe("approvals", () => {
  it("asks before an outside-effect call and runs nothing while deciding", async () => {
    const { evaluate } = await setup("review_required");
    const email = fakeTool("email_send");

    const evaluation = await evaluate([email.tool], "email_send", { to: "a@b.co", subject: "Hi", body: "Hello" });

    expect(evaluation).toMatchObject({ kind: "ask", risk: "external_comms", summary: expect.stringContaining("a@b.co") });
    expect(email.run).not.toHaveBeenCalled();
    expect(await actions()).toHaveLength(0);
  });

  it("records a durable approval and a waiting action, and announces it", async () => {
    const { session, ctx, events, emit } = await setup("review_required");

    const { approvalId, actionId } = await requestToolApproval({
      toolName: "email_send", toolInput: { to: "a@b.co" }, ctx, taskId: null,
      risk: "external_comms", reason: "sends email", summary: "Email a@b.co", emit
    });

    expect(await prisma.approval.findUniqueOrThrow({ where: { id: approvalId } })).toMatchObject({
      status: "pending", toolName: "email_send", sessionId: session.id, riskLevel: "external_comms",
      agentActionId: actionId, taskId: null
    });
    expect(await prisma.agentAction.findUniqueOrThrow({ where: { id: actionId } })).toMatchObject({
      status: "waiting_approval", completedAt: null
    });
    expect(events).toEqual([expect.objectContaining({ type: "approval_required", approvalId, tool: "email_send", risk: "external_comms" })]);
  });

  it("runs an approved call on the action that was waiting, instead of recording a second one", async () => {
    const { ctx, emit } = await setup("review_required");
    const email = fakeTool("email_send", () => "sent");
    const { approvalId, actionId } = await requestToolApproval({
      toolName: "email_send", toolInput: { to: "a@b.co" }, ctx, taskId: null,
      risk: "external_comms", reason: "r", summary: "s", emit
    });

    const result = await runToolCall({
      toolName: "email_send", toolInput: { to: "a@b.co" }, tool: email.tool, ctx, risk: "external_comms",
      idempotencyKey: null, actionId, approvalId, emit
    });

    expect(result).toMatchObject({ output: "sent", outcome: "completed", actionId });
    const recorded = await actions();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ id: actionId, status: "completed" });
    expect(String(recorded[0]?.payloadJson)).toContain(approvalId);
  });

  it.each([
    ["denied", /denied by the user/i],
    ["expired", /no one approved it in time/i],
    ["cancelled", /run was cancelled/i]
  ] as const)("closes out a %s call and tells the agent", async (status, message) => {
    const { ctx, events, emit } = await setup("review_required");
    const { approvalId, actionId } = await requestToolApproval({
      toolName: "email_send", toolInput: { to: "a@b.co" }, ctx, taskId: null,
      risk: "external_comms", reason: "r", summary: "s", emit
    });
    events.length = 0;

    const result = await finishUnapprovedCall({ toolName: "email_send", toolInput: { to: "a@b.co" }, actionId, approvalId, status, emit });

    expect(result).toMatchObject({ success: false, outcome: "denied" });
    expect(result.output).toMatch(message);
    expect((await prisma.agentAction.findUniqueOrThrow({ where: { id: actionId } })).status).toBe("denied");
    expect(events.map((e) => e.type)).toEqual(["tool_call", "tool_result"]);
  });

  it("'for this run' grants skip the question for external writes, but not for comms", async () => {
    const { evaluate } = await setup("review_required", { grants: ["github_push_file", "email_send"] });
    const push = fakeTool("github_push_file");
    const email = fakeTool("email_send");

    expect(kindOf(await evaluate([push.tool], "github_push_file", { path: "a.ts" }))).toBe("run");
    expect(kindOf(await evaluate([email.tool], "email_send", { to: "a@b.co" }))).toBe("ask");
  });

  it("an 'always' agent rule skips the question in any later run", async () => {
    const { agent, evaluate } = await setup("review_required");
    await updatePolicy(ORG, { autoApprove: ["github_push_file"] }, agent.id);
    const push = fakeTool("github_push_file");

    expect(kindOf(await evaluate([push.tool], "github_push_file", { path: "z.ts" }))).toBe("run");
  });
});

describe("policy modes", () => {
  it("blocks outside-effect calls in read-only preview without asking anyone", async () => {
    const { evaluate, events } = await setup("sandbox_only");
    const push = fakeTool("github_push_file");

    const evaluation = await evaluate([push.tool], "github_push_file", { path: "a.ts" });

    expect(push.run).not.toHaveBeenCalled();
    if (evaluation.kind !== "result") throw new Error("expected a settled result");
    expect(evaluation.result).toMatchObject({ success: false, outcome: "denied" });
    expect(evaluation.result.output).toMatch(/Blocked by policy/);
    expect(events.some((e) => e.type === "approval_required")).toBe(false);
    expect(await prisma.approval.count()).toBe(0);
    expect((await actions())[0]?.status).toBe("denied");
  });

  it("trusted mode runs a third-party write straight away but still asks before sending email", async () => {
    const { evaluate } = await setup("trusted");
    const push = fakeTool("github_push_file");
    const email = fakeTool("email_send");

    expect(kindOf(await evaluate([push.tool], "github_push_file", { path: "a.ts" }))).toBe("run");
    expect(kindOf(await evaluate([email.tool], "email_send", { to: "a@b.co" }))).toBe("ask");
  });

  it("an org 'always ask' rule makes a trusted agent ask about a normally free tool", async () => {
    await updatePolicy(ORG, { alwaysAsk: ["github_push_file"] });
    const { evaluate } = await setup("trusted");
    const push = fakeTool("github_push_file");

    expect(kindOf(await evaluate([push.tool], "github_push_file", { path: "a.ts" }))).toBe("ask");
  });
});

describe("repeat guard", () => {
  it("does not run an identical outside-effect call twice in one run, and does not ask again", async () => {
    const { events, callAllowed } = await setup("trusted");
    const push = fakeTool("github_push_file", () => "pushed a.ts");

    await callAllowed(push.tool, { path: "a.ts", content: "x" });
    const repeat = await callAllowed(push.tool, { content: "x", path: "a.ts" }); // same args, different key order

    expect(push.run).toHaveBeenCalledOnce();
    expect(repeat.output).toMatch(/already completed/);
    expect(repeat.output).toContain("pushed a.ts");
    expect(repeat.success).toBe(true);
    expect(events.some((e) => e.type === "approval_required")).toBe(false);
    expect((await actions()).map((a) => a.status)).toEqual(["completed", "skipped"]);
  });

  it("runs the same tool again when the arguments differ", async () => {
    const { callAllowed } = await setup("trusted");
    const push = fakeTool("github_push_file");
    await callAllowed(push.tool, { path: "a.ts" });
    await callAllowed(push.tool, { path: "b.ts" });
    expect(push.run).toHaveBeenCalledTimes(2);
  });

  it("does not apply to reads", async () => {
    const { callAllowed } = await setup("review_required");
    const search = fakeTool("web_search");
    await callAllowed(search.tool, { query: "x" });
    await callAllowed(search.tool, { query: "x" });
    expect(search.run).toHaveBeenCalledTimes(2);
  });
});

describe("limits", () => {
  it("stops the run tree when the tool-call limit is hit", async () => {
    const { callAllowed } = await setup("review_required", { limits: { ...LIMITS, maxToolCalls: 2 } });
    const search = fakeTool("web_search");

    await callAllowed(search.tool, { n: 1 });
    await callAllowed(search.tool, { n: 2 });
    await expect(callAllowed(search.tool, { n: 3 })).rejects.toBeInstanceOf(LimitExceededError);
    expect(search.run).toHaveBeenCalledTimes(2);
  });

  it("does not count a call twice when a resumed step evaluates it again", async () => {
    const { scope, evaluate } = await setup("review_required");
    const search = fakeTool("web_search");

    await evaluate([search.tool], "web_search", {}, false);
    await evaluate([search.tool], "web_search", {}, true);
    expect(scope.tree.budget.toolCalls).toBe(1);
    expect(scope.tree.budget.takeDelta().toolCalls).toBe(1);
  });
});
