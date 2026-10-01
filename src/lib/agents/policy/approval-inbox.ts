import { prisma } from "@/lib/db/client";
import { isManagerRole, isWriterRole } from "@/lib/auth/roles";
import { classifyToolCall, ALWAYS_ASK_RISKS, type ToolRisk } from "./risk";
import { resolveApproval, type ApprovalScope, type ResolveResult } from "./approvals";
import { verifyOneTapToken } from "./one-tap";
import { REDACTED } from "./sanitize";

/**
 * The founder's approvals inbox: every tool call waiting for a person, across all runs, with what it will do and
 * what it may cost. Decisions go through `resolveApproval`, the same path as the approval banner in a session.
 */

/** Risks safe to approve in bulk: nothing that contacts people, spends money, ships to production or deletes. */
export function isBatchApprovable(risk: string): boolean {
  return !ALWAYS_ASK_RISKS.has(risk as ToolRisk) && risk !== "destructive";
}

function parsePayload(json: string | null): Record<string, unknown> {
  try {
    const value = JSON.parse(json ?? "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function listPendingApprovals(orgId: string) {
  const rows = await prisma.approval.findMany({
    where: { organizationId: orgId, kind: "tool", status: "pending", sessionId: { not: null } },
    include: { requestedByAgent: { select: { id: true, name: true, slug: true, department: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
    take: 100
  });
  const runs = await prisma.run.findMany({
    where: { sessionId: { in: rows.map((row) => row.sessionId!) } },
    select: { id: true, sessionId: true, rootRunId: true, costCents: true, budgetCapCents: true, taskId: true, planId: true }
  });
  const runBySession = new Map(runs.map((run) => [run.sessionId, run]));
  const roots = await prisma.run.findMany({
    where: { id: { in: [...new Set(runs.map((run) => run.rootRunId))] } },
    select: { id: true, sessionId: true, spentCents: true, limitsJson: true, taskId: true }
  });
  const rootById = new Map(roots.map((root) => [root.id, root]));
  const tasks = await prisma.task.findMany({
    where: { id: { in: roots.map((root) => root.taskId).filter((id): id is string => !!id) } },
    select: { id: true, title: true }
  });
  const taskTitle = new Map(tasks.map((task) => [task.id, task.title]));

  return rows.map((row) => {
    const run = runBySession.get(row.sessionId!);
    const root = run ? rootById.get(run.rootRunId) : undefined;
    let budgetCents: number | null = null;
    try {
      budgetCents = root?.limitsJson ? ((JSON.parse(root.limitsJson) as { budgetCents?: number }).budgetCents ?? null) : null;
    } catch {
      /* unknown */
    }
    const risk = row.riskLevel as ToolRisk;
    return {
      id: row.id,
      toolName: row.toolName ?? "",
      summary: row.description ?? row.title,
      risk,
      alwaysAsk: ALWAYS_ASK_RISKS.has(risk),
      batchable: isBatchApprovable(risk),
      payload: parsePayload(row.payloadJson),
      agent: row.requestedByAgent
        ? { id: row.requestedByAgent.id, name: row.requestedByAgent.name, slug: row.requestedByAgent.slug, department: row.requestedByAgent.department.name }
        : null,
      sessionId: row.sessionId!,
      rootSessionId: root?.sessionId ?? row.sessionId!,
      taskTitle: root?.taskId ? (taskTitle.get(root.taskId) ?? null) : null,
      planId: run?.planId ?? null,
      // What the run tree has spent and may spend; the call itself has no price until it runs.
      spentCents: root ? Math.round(root.spentCents * 100) / 100 : null,
      budgetCents,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null
    };
  });
}

export type PendingApproval = Awaited<ReturnType<typeof listPendingApprovals>>[number];

export type DecideResult = ResolveResult | { kind: "invalid"; message: string };

/**
 * Approve (once or for the run), approve with edited arguments, or deny. Edited arguments must be a JSON object for
 * the same tool, may not keep a redacted placeholder, and may not raise the call's risk (a read-only SQL query
 * edited into a write is refused: deny it and let the agent ask again).
 */
export async function decideApproval(params: {
  orgId: string;
  approvalId: string;
  userId: string;
  role: string;
  action: "approve" | "deny";
  scope?: ApprovalScope;
  editedInput?: Record<string, unknown> | null;
  note?: string;
}): Promise<DecideResult> {
  const approval = await prisma.approval.findFirst({ where: { id: params.approvalId, organizationId: params.orgId, kind: "tool" } });
  if (!approval?.sessionId) return { kind: "not_found" };

  if (params.editedInput && params.action === "approve") {
    const json = JSON.stringify(params.editedInput);
    if (json.includes(REDACTED)) return { kind: "invalid", message: `Replace every ${REDACTED} value before approving the edited call.` };
    const original = classifyToolCall(approval.toolName ?? "", parsePayload(approval.payloadJson));
    const edited = classifyToolCall(approval.toolName ?? "", params.editedInput);
    const order: ToolRisk[] = ["read", "write_internal", "delegate", "external_write", "destructive", "external_comms", "spend"];
    if (order.indexOf(edited) > order.indexOf(original)) {
      return { kind: "invalid", message: `The edit makes this a riskier call (${edited.replace("_", " ")}). Deny it instead and let the agent ask again.` };
    }
    const saved = await prisma.approval.updateMany({ where: { id: approval.id, status: "pending" }, data: { editedPayloadJson: json } });
    if (saved.count === 0) return { kind: "already_resolved", status: approval.status };
  }

  return resolveApproval({
    orgId: params.orgId,
    sessionId: approval.sessionId,
    approvalId: approval.id,
    userId: params.userId,
    isAdmin: isManagerRole(params.role),
    decision: params.action,
    // An edited call is approved for this once only: the edit is about this call.
    scope: params.editedInput ? "once" : params.scope,
    note: params.note
  });
}

/** Approve several low-risk calls at once. Anything that is not batch-approvable is skipped, never approved. */
export async function batchApprove(params: { orgId: string; approvalIds: string[]; userId: string; role: string }) {
  const rows = await prisma.approval.findMany({
    where: { id: { in: params.approvalIds }, organizationId: params.orgId, kind: "tool", status: "pending" }
  });
  const approved: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  for (const id of params.approvalIds) {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) {
      skipped.push({ id, reason: "not pending" });
      continue;
    }
    if (!isBatchApprovable(row.riskLevel)) {
      skipped.push({ id, reason: `${row.riskLevel.replace("_", " ")} needs a decision of its own` });
      continue;
    }
    const result = await decideApproval({ orgId: params.orgId, approvalId: id, userId: params.userId, role: params.role, action: "approve", scope: "once" });
    if (result.kind === "ok") approved.push(id);
    else skipped.push({ id, reason: result.kind.replace("_", " ") });
  }
  return { approved, skipped };
}

// ── One-tap links ─────────────────────────────────────────────────────────────

export type OneTapPreview =
  | { kind: "invalid"; message: string }
  | {
      kind: "ok";
      approvalId: string;
      decision: "approve" | "deny";
      status: string;
      summary: string;
      risk: string;
      agentName: string | null;
      payload: Record<string, unknown>;
      orgId: string;
    };

const TOKEN_MESSAGES = {
  malformed: "This link is not valid.",
  bad_signature: "This link is not valid.",
  expired: "This link has expired. Open the approvals inbox to decide."
} as const;

/** What a one-tap link would do, for its confirmation page. Changes nothing. */
export async function previewOneTap(token: string): Promise<OneTapPreview> {
  const verified = verifyOneTapToken(token);
  if (!verified.ok) return { kind: "invalid", message: TOKEN_MESSAGES[verified.reason] };
  const approval = await prisma.approval.findUnique({
    where: { id: verified.claims.approvalId },
    include: { requestedByAgent: { select: { name: true } } }
  });
  if (!approval || approval.kind !== "tool") return { kind: "invalid", message: "This approval no longer exists." };
  return {
    kind: "ok",
    approvalId: approval.id,
    decision: verified.claims.decision,
    status: approval.status,
    summary: approval.description ?? approval.title,
    risk: approval.riskLevel,
    agentName: approval.requestedByAgent?.name ?? null,
    payload: parsePayload(approval.payloadJson),
    orgId: approval.organizationId
  };
}

/** Carry out a one-tap decision. The person in the token must still be a member who may act in that org. */
export async function redeemOneTap(token: string): Promise<DecideResult> {
  const verified = verifyOneTapToken(token);
  if (!verified.ok) return { kind: "invalid", message: TOKEN_MESSAGES[verified.reason] };
  const approval = await prisma.approval.findUnique({ where: { id: verified.claims.approvalId } });
  if (!approval) return { kind: "not_found" };
  const membership = await prisma.membership.findUnique({
    where: { organizationId_userId: { organizationId: approval.organizationId, userId: verified.claims.userId } }
  });
  if (!membership || !isWriterRole(membership.role)) {
    return { kind: "forbidden", message: "You can no longer decide approvals in this organization." };
  }
  return decideApproval({
    orgId: approval.organizationId,
    approvalId: approval.id,
    userId: verified.claims.userId,
    role: membership.role,
    action: verified.claims.decision,
    scope: "once"
  });
}
