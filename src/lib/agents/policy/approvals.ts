import { prisma } from "@/lib/db/client";
import { addRunGrant, getRunBySession } from "@/lib/agents/engine/run-store";
import { isTerminalStatus } from "@/lib/agents/engine/types";
import { enqueueAdvance } from "@/lib/agents/engine/wake";
import { addAutoApprove } from "./store";
import { ALWAYS_ASK_RISKS, type ToolRisk } from "./risk";
import { redactSecrets } from "./sanitize";

/**
 * Tool-call approvals.
 *
 * An approval is a durable `Approval` row: who asked, which tool, what arguments, who decided, when. The run that
 * asked is paused in the database (status `waiting_approval`), not in memory, so it can wait for days and survive
 * restarts. Answering writes the decision and queues the run to continue; a worker resumes it.
 */

export type ApprovalScope = "once" | "run" | "always";

/** How long a run waits for a human before the call is treated as not approved. */
export function approvalTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const minutes = Number(env.APPROVAL_TIMEOUT_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 24 * 60) * 60_000;
}

export async function createApproval(params: {
  orgId: string;
  sessionId: string;
  taskId?: string | null;
  agentId: string;
  agentActionId?: string | null;
  toolName: string;
  input: Record<string, unknown>;
  risk: ToolRisk;
  summary: string;
  timeoutMs: number;
}) {
  return prisma.approval.create({
    data: {
      organizationId: params.orgId,
      // Deliberately not linked to the task: task approvals have their own review flow
      // and would otherwise block or restart the task when answered.
      taskId: null,
      agentActionId: params.agentActionId ?? null,
      requestedByAgentId: params.agentId,
      sessionId: params.sessionId,
      toolName: params.toolName,
      payloadJson: redactSecrets(JSON.stringify(params.input)),
      title: `Approve ${params.toolName}`,
      description: params.summary,
      riskLevel: params.risk,
      status: "pending",
      expiresAt: new Date(Date.now() + params.timeoutMs)
    }
  });
}

/** True when `sessionId` is `ancestorId` or one of its delegated descendants. */
async function sessionBelongsTo(sessionId: string, ancestorId: string): Promise<boolean> {
  let current: string | null = sessionId;
  for (let hops = 0; current && hops < 10; hops++) {
    if (current === ancestorId) return true;
    const row: { parentSessionId: string | null } | null = await prisma.taskSession.findFirst({
      where: { id: current },
      select: { parentSessionId: true }
    });
    current = row?.parentSessionId ?? null;
  }
  return false;
}

export type ResolveResult =
  | { kind: "not_found" }
  | { kind: "already_resolved"; status: string }
  | { kind: "stale" }
  | { kind: "forbidden"; message: string }
  | { kind: "ok"; approved: boolean; scopeApplied: ApprovalScope };

export async function resolveApproval(params: {
  orgId: string;
  /** Session the request came in on: the approval must belong to it or to a session it delegated to. */
  sessionId: string;
  approvalId: string;
  userId: string;
  isAdmin: boolean;
  decision: "approve" | "deny";
  scope?: ApprovalScope;
  note?: string;
}): Promise<ResolveResult> {
  const approval = await prisma.approval.findFirst({ where: { id: params.approvalId, organizationId: params.orgId } });
  if (!approval || !approval.sessionId || !(await sessionBelongsTo(approval.sessionId, params.sessionId))) {
    return { kind: "not_found" };
  }
  if (approval.status !== "pending") return { kind: "already_resolved", status: approval.status };

  const requested: ApprovalScope = params.decision === "approve" ? params.scope ?? "once" : "once";
  if (requested === "always" && !params.isAdmin) {
    return { kind: "forbidden", message: "Only an organization admin can always-approve a tool." };
  }

  const run = await getRunBySession(approval.sessionId);
  if (!run || isTerminalStatus(run.status)) {
    // The run that asked has already ended (cancelled, failed or finished), so there is nothing to resume.
    await prisma.approval.updateMany({ where: { id: approval.id, status: "pending" }, data: { status: "expired", reviewedAt: new Date() } });
    return { kind: "stale" };
  }

  const risk = approval.riskLevel as ToolRisk;
  const toolName = approval.toolName ?? "";
  let applied: ApprovalScope = "once";
  if (params.decision === "approve" && requested !== "once" && !ALWAYS_ASK_RISKS.has(risk) && toolName) {
    if (requested === "run") {
      await addRunGrant(run.rootRunId, toolName);
      applied = "run";
    } else if (approval.requestedByAgentId) {
      await addAutoApprove(params.orgId, approval.requestedByAgentId, toolName);
      applied = "always";
    }
  }

  // Only the first answer counts, even if two people click at the same moment.
  const updated = await prisma.approval.updateMany({
    where: { id: approval.id, status: "pending" },
    data: {
      status: params.decision === "approve" ? "approved" : "denied",
      reviewedByUserId: params.userId,
      reviewedAt: new Date(),
      decisionScope: params.decision === "approve" ? applied : null
    }
  });
  if (updated.count === 0) {
    const current = await prisma.approval.findUnique({ where: { id: approval.id } });
    return { kind: "already_resolved", status: current?.status ?? "resolved" };
  }

  await enqueueAdvance(run.id);
  return { kind: "ok", approved: params.decision === "approve", scopeApplied: applied };
}

/** Mark approvals nobody answered in time as expired and wake their runs so they can carry on without them. */
export async function expireDueApprovals(now = new Date()): Promise<number> {
  const due = await prisma.approval.findMany({
    where: { status: "pending", sessionId: { not: null }, expiresAt: { lt: now } }
  });
  let count = 0;
  for (const approval of due) {
    const updated = await prisma.approval.updateMany({
      where: { id: approval.id, status: "pending" },
      data: { status: "expired", reviewedAt: now }
    });
    if (updated.count === 0) continue;
    count += 1;
    const run = approval.sessionId ? await getRunBySession(approval.sessionId) : null;
    if (run && !isTerminalStatus(run.status)) await enqueueAdvance(run.id);
  }
  return count;
}

/** Close every open approval of the given sessions (used when a run is cancelled). */
export async function cancelPendingApprovals(sessionIds: string[]): Promise<void> {
  if (sessionIds.length === 0) return;
  await prisma.approval.updateMany({
    where: { sessionId: { in: sessionIds }, status: "pending" },
    data: { status: "cancelled", reviewedAt: new Date() }
  });
}
