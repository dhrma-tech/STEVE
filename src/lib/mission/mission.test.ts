import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { scriptedModel, type ScriptedTurn } from "@/lib/agents/testing/scripted-anthropic";
import { drainAll, ORG, resetDb, seedAgent, seedSession, seedTask, USER } from "@/lib/agents/testing/test-db";
import { startAgentRun } from "@/lib/agents/run-service";
import { getRun, getRunBySession, listEvents } from "@/lib/agents/engine/run-store";
import { batchApprove, decideApproval, listPendingApprovals, previewOneTap, redeemOneTap } from "@/lib/agents/policy/approval-inbox";
import { createOneTapToken, verifyOneTapToken } from "@/lib/agents/policy/one-tap";
import { spendToday } from "@/lib/agents/policy/spend";
import { updatePolicy } from "@/lib/agents/policy/store";
import { getControlsData } from "@/lib/agents/policy/controls";
import { notifyApprovalRequested } from "@/lib/notifications/email";
import { createBriefing, ensureDailyBriefings, listBriefings } from "@/lib/briefings/briefings";
import { approvePlan, createGoalPlan, reassignPlanStep, retryPlanStep } from "@/lib/agents/plans/store";
import { addRunComment, cancelRunTree, getMissionOverview, getRunDetail, retryRun } from "./data";

vi.mock("@anthropic-ai/sdk", async () => (await import("@/lib/agents/testing/scripted-anthropic")).anthropicModuleMock);

const call = (name: string, input: Record<string, unknown> = {}): ScriptedTurn => ({ toolCalls: [{ name, input }] });
const VIEWER = "user_viewer";

async function setup() {
  await prisma.membership.create({ data: { organizationId: ORG, userId: USER, role: "owner" } });
  await prisma.user.create({ data: { id: VIEWER, email: "viewer@test.example", name: "Viewer" } });
  await prisma.membership.create({ data: { organizationId: ORG, userId: VIEWER, role: "viewer" } });
  const sales = await seedAgent({ slug: "sales", name: "Sales Agent", departmentSlug: "sales", skillKeys: ["email-outbound", "github-repository"], permissionMode: "review_required" });
  const ops = await seedAgent({ slug: "ops", name: "Operations Agent", departmentSlug: "operations" });
  return { sales, ops };
}

async function start(agentId: string, message: string) {
  const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
  const task = await seedTask({ agentId, departmentId: agent.departmentId, title: message });
  const session = (await startAgentRun({ orgId: ORG, taskId: task.id, agentId, message }))!;
  await drainAll();
  return (await getRunBySession(session.id))!;
}

const eventsOf = async (runId: string) => (await listEvents(runId, 0, 500)).map((e) => ({ type: e.type, ...e.data }));

beforeEach(async () => {
  await resetDb();
  scriptedModel.load([]);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("AGENTS_PAUSED", "");
  vi.stubEnv("MODEL_RETRY_BASE_MS", "0");
  vi.stubEnv("RESEND_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("approvals inbox", () => {
  it("lists what waits, with risk, payload and spend, and resumes the run when approved", async () => {
    const { sales } = await setup();
    scriptedModel.route("Sales Agent", [call("email_send", { to: "a@b.co", subject: "Hi", body: "Hello" }), { text: "sent" }]);
    const run = await start(sales.id, "Email the lead");
    expect(run.status).toBe("waiting_approval");

    const [pending] = await listPendingApprovals(ORG);
    expect(pending).toMatchObject({ toolName: "email_send", risk: "external_comms", alwaysAsk: true, batchable: false, payload: { to: "a@b.co" } });
    expect(pending!.agent?.name).toBe("Sales Agent");
    expect(pending!.spentCents).toBeGreaterThan(0);

    expect((await decideApproval({ orgId: ORG, approvalId: pending!.id, userId: USER, role: "owner", action: "approve" })).kind).toBe("ok");
    await drainAll();
    expect((await getRun(run.id))!.status).toBe("completed");
  });

  it("runs an edited call with exactly the edited arguments", async () => {
    const { sales } = await setup();
    scriptedModel.route("Sales Agent", [call("email_send", { to: "wrong@b.co", subject: "Hi", body: "Hello" }), { text: "sent" }]);
    const run = await start(sales.id, "Email the lead");
    const [pending] = await listPendingApprovals(ORG);

    const edited = { to: "right@b.co", subject: "Hi there", body: "Hello" };
    expect((await decideApproval({ orgId: ORG, approvalId: pending!.id, userId: USER, role: "owner", action: "approve", editedInput: edited })).kind).toBe("ok");
    await drainAll();
    const calls = (await eventsOf(run.id)).filter((e) => e.type === "tool_call") as Array<{ input?: Record<string, unknown> }>;
    expect(calls.at(-1)!.input).toEqual(edited);
    expect((await prisma.approval.findUniqueOrThrow({ where: { id: pending!.id } })).decisionScope).toBe("once");
  });

  it("refuses an edit that keeps a redacted value or makes the call riskier", async () => {
    const { sales } = await setup();
    const session = await seedSession(sales.id);
    const approval = await prisma.approval.create({
      data: {
        organizationId: ORG, sessionId: session.id, kind: "tool", toolName: "supabase_run_query", requestedByAgentId: sales.id,
        payloadJson: JSON.stringify({ sql: "select * from users", token: "[REDACTED]" }), title: "q", riskLevel: "read", status: "pending"
      }
    });
    const redacted = await decideApproval({ orgId: ORG, approvalId: approval.id, userId: USER, role: "owner", action: "approve", editedInput: { sql: "select 1", token: "[REDACTED]" } });
    expect(redacted).toMatchObject({ kind: "invalid" });
    const riskier = await decideApproval({ orgId: ORG, approvalId: approval.id, userId: USER, role: "owner", action: "approve", editedInput: { sql: "delete from users" } });
    expect(riskier.kind === "invalid" && riskier.message).toContain("riskier");
  });

  it("batch-approves only low-risk calls", async () => {
    const { sales } = await setup();
    scriptedModel.route("Sales Agent", [
      { toolCalls: [{ name: "github_create_branch", input: { repo: "acme/web", branch: "feature" } }, { name: "email_send", input: { to: "a@b.co", subject: "s", body: "b" } }] },
      { text: "ok" }
    ]);
    await start(sales.id, "Branch and email");
    // The run asks for one call at a time; approve the branch in bulk, the email cannot be.
    const first = await listPendingApprovals(ORG);
    expect(first.map((a) => a.toolName)).toEqual(["github_create_branch"]);
    const result = await batchApprove({ orgId: ORG, approvalIds: first.map((a) => a.id), userId: USER, role: "owner" });
    expect(result.approved).toHaveLength(1);
    await drainAll();
    const second = await listPendingApprovals(ORG);
    expect(second.map((a) => a.toolName)).toEqual(["email_send"]);
    const refused = await batchApprove({ orgId: ORG, approvalIds: second.map((a) => a.id), userId: USER, role: "owner" });
    expect(refused).toMatchObject({ approved: [], skipped: [{ reason: "external comms needs a decision of its own" }] });
  });
});

describe("one-tap links", () => {
  it("approves once from a signed link, and refuses reuse, tampering, expiry and read-only members", async () => {
    const { sales } = await setup();
    scriptedModel.route("Sales Agent", [call("email_send", { to: "a@b.co", subject: "Hi", body: "Hello" }), { text: "sent" }]);
    const run = await start(sales.id, "Email the lead");
    const [pending] = await listPendingApprovals(ORG);

    const viewerToken = createOneTapToken({ approvalId: pending!.id, decision: "approve", userId: VIEWER });
    expect(await redeemOneTap(viewerToken)).toMatchObject({ kind: "forbidden" });

    const token = createOneTapToken({ approvalId: pending!.id, decision: "approve", userId: USER });
    expect(await previewOneTap(token)).toMatchObject({ kind: "ok", decision: "approve", status: "pending", agentName: "Sales Agent" });
    expect((await redeemOneTap(token)).kind).toBe("ok");
    expect((await prisma.approval.findUniqueOrThrow({ where: { id: pending!.id } })).reviewedByUserId).toBe(USER);
    expect(await redeemOneTap(token)).toMatchObject({ kind: "already_resolved" });
    await drainAll();
    expect((await getRun(run.id))!.status).toBe("completed");

    const [body, signature] = token.split(".");
    expect(verifyOneTapToken(`${body}x.${signature}`)).toMatchObject({ ok: false, reason: "bad_signature" });
    const old = createOneTapToken({ approvalId: "a", decision: "deny", userId: USER }, { now: Date.now() - 2 * 86_400_000 });
    expect(verifyOneTapToken(old)).toMatchObject({ ok: false, reason: "expired" });
  });

  it("emails the managers approve and deny links when email is set up", async () => {
    const { sales } = await setup();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "e1" }), { status: 200 }));
    const session = await seedSession(sales.id);
    const approval = await prisma.approval.create({
      data: {
        organizationId: ORG, sessionId: session.id, kind: "tool", toolName: "email_send", requestedByAgentId: sales.id,
        payloadJson: JSON.stringify({ to: "a@b.co" }), title: "t", description: "Send an email to a@b.co", riskLevel: "external_comms", status: "pending"
      }
    });
    expect(await notifyApprovalRequested(approval)).toBe(1); // the owner, not the viewer
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe("https://api.resend.com/emails");
    const sent = JSON.parse(String((init as RequestInit).body)) as { to: string; html: string; subject: string };
    expect(sent.to).toBe("reviewer@test.example");
    expect(sent.subject).toContain("Send an email to a@b.co");
    const links = [...sent.html.matchAll(/\/approve\/([^"]+)"/g)].map((m) => verifyOneTapToken(m[1]!));
    expect(links.map((l) => l.ok && l.claims.decision)).toEqual(["approve", "deny"]);
  });
});

describe("budgets", () => {
  it("attributes delegated spend to the agent that did it, and stops an agent or department over its daily budget", async () => {
    const { sales, ops } = await setup();
    scriptedModel.route("Operations Agent", [call("delegate_agent", { agentSlug: "sales", objective: "Draft outreach" }), { text: "ok" }]);
    scriptedModel.route("Sales Agent", [call("finish_run", { status: "done", summary: "Drafted." })]);
    const root = await start(ops.id, "Get outreach going");
    expect((await getRun(root.id))!.status).toBe("completed");

    const today = await spendToday(ORG);
    const opsOwn = today.byAgent.get(ops.id)!;
    const salesOwn = today.byAgent.get(sales.id)!;
    expect(opsOwn).toBeGreaterThan(0);
    expect(salesOwn).toBeGreaterThan(0);
    // Per-agent spend is shown to two decimals of a cent.
    expect(opsOwn + salesOwn).toBeCloseTo((await getRun(root.id))!.costCents, 1);
    expect(today.byDepartment.get(sales.departmentId)).toBeCloseTo(salesOwn, 5);

    await updatePolicy(ORG, { dailyBudgetCents: 0.0001 }, sales.id);
    const task = await seedTask({ agentId: sales.id, departmentId: sales.departmentId });
    await expect(startAgentRun({ orgId: ORG, taskId: task.id, agentId: sales.id })).rejects.toThrow(/Sales Agent has used its daily budget/);

    await updatePolicy(ORG, { dailyBudgetCents: null }, sales.id);
    await prisma.department.update({ where: { id: sales.departmentId }, data: { dailyBudgetCents: 0 } });
    await expect(startAgentRun({ orgId: ORG, taskId: task.id, agentId: sales.id })).rejects.toThrow(/department has used its daily budget/);
    // Other departments are not affected.
    const opsTask = await seedTask({ agentId: ops.id, departmentId: ops.departmentId });
    scriptedModel.route("Operations Agent", [{ text: "fine" }]);
    expect(await startAgentRun({ orgId: ORG, taskId: opsTask.id, agentId: ops.id })).toBeTruthy();

    const controls = await getControlsData(ORG);
    expect(controls.agents.find((a) => a.id === sales.id)).toMatchObject({ mode: "review_required", spentTodayCents: salesOwn });
    expect(controls.departments.find((d) => d.id === sales.departmentId)).toMatchObject({ dailyBudgetCents: 0 });
  });
});

describe("Mission Control", () => {
  it("shows delegation trees with approvals rolled up, and the run detail for replay", async () => {
    const { sales, ops } = await setup();
    scriptedModel.route("Operations Agent", [call("delegate_agent", { agentSlug: "sales", objective: "Email the lead" }), { text: "ok" }]);
    scriptedModel.route("Sales Agent", [call("email_send", { to: "a@b.co", subject: "s", body: "b" })]);
    const root = await start(ops.id, "Follow up with the lead");

    const overview = await getMissionOverview(ORG);
    const tree = overview.trees.find((t) => t.runId === root.id)!;
    expect(tree).toMatchObject({ status: "waiting_children", treePendingApprovals: 1, treeSize: 2, agent: { name: "Operations Agent" } });
    expect(tree.children[0]).toMatchObject({ kind: "delegation", status: "waiting_approval", pendingApprovals: 1, agent: { name: "Sales Agent" } });
    expect(overview.counts).toMatchObject({ activeRuns: 2, approvals: 1, waitingForYou: 1 });

    const detail = (await getRunDetail(ORG, root.id))!;
    // The delegate's approval is forwarded to the root, where the person watching sees it.
    expect(detail.events.map((e) => e.type)).toEqual(expect.arrayContaining(["delegate_start", "approval_required"]));
    expect(detail.children).toHaveLength(1);
    expect(detail).toMatchObject({ canCancel: true, canRetry: false });

    expect((await cancelRunTree({ orgId: ORG, runId: tree.children[0]!.runId })).kind).toBe("ok");
    expect((await getRun(root.id))!.status).toBe("cancelled");
    expect((await getRun(tree.children[0]!.runId))!.status).toBe("cancelled");
    void sales;
  });

  it("retries a finished task run as a new run and records comments in the task chat", async () => {
    const { ops } = await setup();
    scriptedModel.route("Operations Agent", [{ text: "first" }, { text: "second" }]);
    const first = await start(ops.id, "Write the weekly update");
    expect((await getRunDetail(ORG, first.id))!.canRetry).toBe(true);

    const retried = await retryRun({ orgId: ORG, runId: first.id, message: "Write the weekly update, shorter" });
    expect(retried.kind).toBe("ok");
    await drainAll();
    const second = (await getRunBySession((retried as { value: { sessionId: string } }).value.sessionId))!;
    expect(second).toMatchObject({ status: "completed", taskId: first.taskId, requestText: "Write the weekly update, shorter" });
    expect((await getRun(first.id))!.status).toBe("completed");

    const comment = await addRunComment({ orgId: ORG, runId: first.id, userId: USER, body: "Good, but mention hiring." });
    expect(comment.kind).toBe("ok");
    const message = await prisma.chatMessage.findFirstOrThrow({ where: { body: "Good, but mention hiring." }, include: { thread: true } });
    expect(message.thread.taskId).toBe(first.taskId);
    expect(await retryRun({ orgId: ORG, runId: "nope" })).toEqual({ kind: "not_found" });
  });
});

describe("plan manager tools", () => {
  it("reassigns a waiting step and retries a failed step of a stopped plan", async () => {
    const { sales, ops } = await setup();
    scriptedModel.route("Chief of Staff", [
      call("propose_plan", { summary: "Two steps", nodes: [{ key: "a", title: "A", agentSlug: "ops" }, { key: "b", title: "B", agentSlug: "ops", dependsOn: ["a"] }] }),
      { text: "Stopped report" },
      { text: "Final report" }
    ]);
    scriptedModel.route("Operations Agent", [call("finish_run", { status: "failed", summary: "Broke." })]);
    scriptedModel.route("Sales Agent", [call("finish_run", { status: "done", summary: "A done." }), call("finish_run", { status: "done", summary: "B done." })]);
    const { plan } = await createGoalPlan({ orgId: ORG, userId: USER, goal: "A then B" });
    await drainAll();
    await prisma.plan.update({ where: { id: plan.id }, data: { maxReplans: 0 } });
    await approvePlan({ orgId: ORG, planId: plan.id, userId: USER });
    await drainAll();
    let row = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id }, include: { nodes: true } });
    expect(row.status).toBe("failed");

    const a = row.nodes.find((n) => n.key === "a")!;
    const b = row.nodes.find((n) => n.key === "b")!;
    expect((await reassignPlanStep({ orgId: ORG, planId: plan.id, nodeId: a.id, agentId: sales.id })).kind).toBe("ok");
    expect((await reassignPlanStep({ orgId: ORG, planId: plan.id, nodeId: b.id, agentId: sales.id })).kind).toBe("ok");
    expect((await retryPlanStep({ orgId: ORG, planId: plan.id, nodeId: a.id })).kind).toBe("ok");
    await drainAll();
    row = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id }, include: { nodes: true } });
    expect(row.status).toBe("completed");
    expect(row.nodes.every((n) => n.status === "done")).toBe(true);
    expect((await retryPlanStep({ orgId: ORG, planId: plan.id, nodeId: a.id })).kind).toBe("conflict");
    void ops;
  });
});

describe("briefings", () => {
  it("has the Chief of Staff write the briefing from the facts", async () => {
    const { ops } = await setup();
    scriptedModel.route("Operations Agent", [{ text: "done" }]);
    const task = await seedTask({ agentId: ops.id, departmentId: ops.departmentId, title: "Ship the pricing page" });
    await startAgentRun({ orgId: ORG, taskId: task.id, agentId: ops.id });
    await drainAll();
    await prisma.task.update({ where: { id: task.id }, data: { status: "completed", completedAt: new Date() } });

    scriptedModel.route("Chief of Staff", [{ text: "Good day: the pricing page shipped. Nothing needs you." }]);
    const briefing = await createBriefing(ORG, "manual");
    expect(briefing.status).toBe("writing");
    await drainAll();
    const [ready] = await listBriefings(ORG);
    expect(ready).toMatchObject({ status: "ready", byChiefOfStaff: true, text: "Good day: the pricing page shipped. Nothing needs you." });
    expect(ready!.facts.shipped.tasks.map((t) => t.title)).toContain("Ship the pricing page");
    const chiefCall = scriptedModel.calls.find((c) => c.system.startsWith("You are Chief of Staff,"))!;
    expect(chiefCall.system).toContain("How to write the briefing");
    expect(chiefCall.toolNames).not.toContain("delegate_agent");
  });

  it("falls back to a briefing from the records when the Chief of Staff cannot write one", async () => {
    await setup();
    scriptedModel.route("Chief of Staff", [{ error: { status: 400, message: "bad request" } }]);
    await createBriefing(ORG, "manual");
    await drainAll();
    const [ready] = await listBriefings(ORG);
    expect(ready).toMatchObject({ status: "ready", byChiefOfStaff: false });
    expect(ready!.text).toContain("**Shipped**");
    expect(ready!.text).toContain("**Needs you**");
  });

  it("makes one daily briefing per active org after the briefing hour", async () => {
    const { ops } = await setup();
    await prisma.organization.update({ where: { id: ORG }, data: { status: "active" } });
    scriptedModel.route("Operations Agent", [{ text: "done" }]);
    await start(ops.id, "Anything");
    vi.stubEnv("DAILY_BRIEFINGS", "on");
    vi.stubEnv("BRIEFING_HOUR", "8");
    vi.stubEnv("ANTHROPIC_API_KEY", ""); // records-only, no model
    const early = new Date();
    early.setHours(7, 0, 0, 0);
    expect(await ensureDailyBriefings(early)).toBe(0);
    const later = new Date();
    later.setHours(9, 0, 0, 0);
    expect(await ensureDailyBriefings(later)).toBe(1);
    await drainAll();
    expect(await ensureDailyBriefings(later)).toBe(0);
    expect(await prisma.briefing.count({ where: { organizationId: ORG, period: "daily" } })).toBe(1);
    expect((await listBriefings(ORG))[0]!.status).toBe("ready");
  });
});
