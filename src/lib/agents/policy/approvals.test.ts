import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { cancelPendingApprovals, createApproval, expireDueApprovals, resolveApproval } from "@/lib/agents/policy/approvals";
import { createRun, getRun, parseGrants } from "@/lib/agents/engine/run-store";
import { getQueue } from "@/lib/agents/engine/queue";
import { ago, ORG, resetDb, seedAgent, seedSession, USER } from "@/lib/agents/testing/test-db";

async function pendingApproval(
  toolName = "github_push_file",
  risk: "external_write" | "external_comms" = "external_write",
  slug = "eng"
) {
  const agent = await seedAgent({ slug, name: "Engineering Agent", departmentSlug: "engineering" });
  const session = await seedSession(agent.id);
  const run = await createRun({
    organizationId: ORG, sessionId: session.id, taskId: session.taskId, agentId: agent.id, requestText: "x", mode: "review_required"
  });
  await prisma.run.update({ where: { id: run.id }, data: { status: "waiting_approval" } });
  const approval = await createApproval({
    orgId: ORG, sessionId: session.id, agentId: agent.id, toolName,
    input: { path: "a.ts", token: "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123" },
    risk, summary: "Push a.ts", timeoutMs: 60_000
  });
  const resolve = (over: Partial<Parameters<typeof resolveApproval>[0]> = {}) =>
    resolveApproval({
      orgId: ORG, sessionId: session.id, approvalId: approval.id, userId: USER, isAdmin: true, decision: "approve", ...over
    });
  return { agent, session, run, approval, resolve };
}

const statusOf = async (id: string) => (await prisma.approval.findUniqueOrThrow({ where: { id } })).status;

beforeEach(resetDb);

describe("createApproval", () => {
  it("stores a pending, session-linked approval without linking it to the task", async () => {
    const { approval, session } = await pendingApproval();
    expect(approval).toMatchObject({
      status: "pending", toolName: "github_push_file", sessionId: session.id, taskId: null, riskLevel: "external_write"
    });
    expect(approval.expiresAt).toBeInstanceOf(Date);
  });

  it("redacts secrets in the stored arguments", async () => {
    const { approval } = await pendingApproval();
    expect(String(approval.payloadJson)).not.toContain("sk-ant-");
  });
});

describe("resolveApproval", () => {
  it("approves, records who decided, and queues the run to continue", async () => {
    const { approval, run, resolve } = await pendingApproval();

    expect(await resolve()).toEqual({ kind: "ok", approved: true, scopeApplied: "once" });
    expect(await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).toMatchObject({
      status: "approved", reviewedByUserId: USER, decisionScope: "once"
    });
    expect(await getQueue().hasPending(run.id)).toBe(true);
  });

  it("denies", async () => {
    const { approval, resolve } = await pendingApproval();
    expect(await resolve({ decision: "deny", note: "not now" })).toMatchObject({ kind: "ok", approved: false });
    expect(await statusOf(approval.id)).toBe("denied");
  });

  it("cannot be answered twice", async () => {
    const { resolve } = await pendingApproval();
    await resolve();
    expect(await resolve()).toEqual({ kind: "already_resolved", status: "approved" });
  });

  it("counts only the first of two answers that arrive together", async () => {
    const { approval, resolve } = await pendingApproval();
    const results = await Promise.all([resolve(), resolve({ decision: "deny" })]);
    expect(results.filter((r) => r.kind === "ok")).toHaveLength(1);
    expect(["approved", "denied"]).toContain(await statusOf(approval.id));
  });

  it("is not found for another org or an unrelated session", async () => {
    const { resolve, approval } = await pendingApproval();
    expect(await resolve({ orgId: "org_other" })).toEqual({ kind: "not_found" });
    expect(await resolve({ sessionId: "sess_unrelated" })).toEqual({ kind: "not_found" });
    expect(await resolve({ approvalId: "nope" })).toEqual({ kind: "not_found" });
    expect(await statusOf(approval.id)).toBe("pending");
  });

  it("accepts an answer sent on the parent session of the run that is waiting", async () => {
    const { agent, session, approval, run, resolve } = await pendingApproval();
    const childSession = await prisma.taskSession.create({
      data: { organizationId: ORG, taskId: session.taskId, agentId: agent.id, parentSessionId: session.id, status: "running" }
    });
    const child = await createRun({
      organizationId: ORG, sessionId: childSession.id, taskId: session.taskId, agentId: agent.id,
      requestText: "sub", mode: "review_required", parent: { run, slotId: "s1" }
    });
    await prisma.run.update({ where: { id: child.id }, data: { status: "waiting_approval" } });
    await prisma.approval.update({ where: { id: approval.id }, data: { sessionId: childSession.id } });

    expect(await resolve()).toMatchObject({ kind: "ok", approved: true }); // answered on the parent session
    expect(await getQueue().hasPending(child.id)).toBe(true); // and the child is the one that resumes
  });

  it("is stale, and expired, when the run that asked has already ended", async () => {
    const { approval, run, resolve } = await pendingApproval();
    await prisma.run.update({ where: { id: run.id }, data: { status: "cancelled" } });

    expect(await resolve()).toEqual({ kind: "stale" });
    expect(await statusOf(approval.id)).toBe("expired");
  });
});

describe("scopes", () => {
  it("'run' adds a grant on the root run", async () => {
    const { run, resolve } = await pendingApproval();
    expect(await resolve({ scope: "run" })).toMatchObject({ scopeApplied: "run" });
    expect(parseGrants((await getRun(run.id))!).has("github_push_file")).toBe(true);
  });

  it("'always' writes an agent rule, but only for admins", async () => {
    const { agent, approval, resolve } = await pendingApproval();
    expect(await resolve({ scope: "always", isAdmin: false })).toMatchObject({ kind: "forbidden" });
    expect(await statusOf(approval.id)).toBe("pending");

    expect(await resolve({ scope: "always", isAdmin: true })).toMatchObject({ scopeApplied: "always" });
    expect(await prisma.policy.findFirstOrThrow({ where: { agentId: agent.id } })).toMatchObject({ autoApproveJson: '["github_push_file"]' });
  });

  it("never widens approval for communication tools", async () => {
    const { run, resolve } = await pendingApproval("email_send", "external_comms");
    expect(await resolve({ scope: "always" })).toMatchObject({ scopeApplied: "once" });
    expect(parseGrants((await getRun(run.id))!).size).toBe(0);
    expect(await prisma.policy.count()).toBe(0);
  });

  it("a denial never widens anything", async () => {
    const { run, resolve } = await pendingApproval();
    await resolve({ decision: "deny", scope: "always" });
    expect(parseGrants((await getRun(run.id))!).size).toBe(0);
    expect(await prisma.policy.count()).toBe(0);
  });
});

describe("expiry and cancellation", () => {
  it("expires only overdue approvals and wakes their runs", async () => {
    const { approval, run } = await pendingApproval();
    expect(await expireDueApprovals()).toBe(0); // not due yet

    await prisma.approval.update({ where: { id: approval.id }, data: { expiresAt: ago(1000) } });
    expect(await expireDueApprovals()).toBe(1);
    expect(await statusOf(approval.id)).toBe("expired");
    expect(await getQueue().hasPending(run.id)).toBe(true);
    expect(await expireDueApprovals()).toBe(0); // and only once
  });

  it("cancels the open approvals of given sessions and leaves others alone", async () => {
    const a = await pendingApproval();
    const b = await pendingApproval(undefined, undefined, "eng-2");
    await cancelPendingApprovals([a.session.id]);
    expect(await statusOf(a.approval.id)).toBe("cancelled");
    expect(await statusOf(b.approval.id)).toBe("pending");
  });
});
