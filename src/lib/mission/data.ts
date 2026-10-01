import type { Run } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { cancelRun } from "@/lib/agents/engine/advance";
import { parseStoredHandoff } from "@/lib/agents/engine/handoff";
import { listEvents } from "@/lib/agents/engine/run-store";
import { ACTIVE_STATUSES, isTerminalStatus } from "@/lib/agents/engine/types";
import { defaultDailyBudgetCents } from "@/lib/agents/policy/limits";
import { spendToday } from "@/lib/agents/policy/spend";
import { getOrgPolicy } from "@/lib/agents/policy/store";
import { startAgentRun } from "@/lib/agents/run-service";

/**
 * Mission Control: what the agents are doing right now and did recently, as delegation trees, plus what is
 * waiting for the founder. Read from the durable run tables, so it shows the same thing in every process.
 */

const RECENT_MS = 24 * 60 * 60 * 1000;
const MAX_TREES = 30;

export type RunNode = {
  runId: string;
  sessionId: string;
  kind: string;
  status: string;
  agent: { id: string; name: string; slug: string; department: string } | null;
  request: string;
  summary: string | null;
  costCents: number;
  startedAt: string | null;
  finishedAt: string | null;
  elapsedMs: number;
  pendingApprovals: number;
  planId: string | null;
  error: string | null;
  children: RunNode[];
};

function elapsed(run: Pick<Run, "startedAt" | "createdAt" | "finishedAt">, now: number): number {
  const start = (run.startedAt ?? run.createdAt).getTime();
  return Math.max(0, (run.finishedAt?.getTime() ?? now) - start);
}

export async function getMissionOverview(orgId: string) {
  const now = Date.now();
  const roots = await prisma.run.findMany({
    where: {
      organizationId: orgId,
      parentRunId: null,
      OR: [{ status: { in: [...ACTIVE_STATUSES] } }, { finishedAt: { gte: new Date(now - RECENT_MS) } }]
    },
    orderBy: { createdAt: "desc" },
    take: MAX_TREES
  });
  const all = roots.length
    ? await prisma.run.findMany({ where: { rootRunId: { in: roots.map((root) => root.id) } }, orderBy: { createdAt: "asc" } })
    : [];
  const sessionIds = all.map((run) => run.sessionId);

  const [agents, approvals, plans, questions, proposedMemories, policy, today] = await Promise.all([
    prisma.agent.findMany({
      where: { id: { in: [...new Set(all.map((run) => run.agentId))] } },
      select: { id: true, name: true, slug: true, department: { select: { name: true } } }
    }),
    prisma.approval.groupBy({
      by: ["sessionId"],
      where: { organizationId: orgId, status: "pending", sessionId: { in: sessionIds } },
      _count: { _all: true }
    }),
    prisma.plan.findMany({
      where: {
        organizationId: orgId,
        OR: [{ status: { notIn: ["completed", "failed", "cancelled"] } }, { finishedAt: { gte: new Date(now - RECENT_MS) } }]
      },
      include: { nodes: { select: { status: true } } },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.approval.count({ where: { organizationId: orgId, status: "pending", kind: "question" } }),
    prisma.orgMemory.count({ where: { organizationId: orgId, status: "proposed" } }),
    getOrgPolicy(orgId),
    spendToday(orgId)
  ]);
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const pendingBySession = new Map(approvals.map((row) => [row.sessionId, row._count._all]));

  const nodeOf = (run: Run): RunNode => {
    const agent = agentById.get(run.agentId);
    const handoff = parseStoredHandoff(run.resultJson);
    return {
      runId: run.id,
      sessionId: run.sessionId,
      kind: run.kind,
      status: run.status,
      agent: agent ? { id: agent.id, name: agent.name, slug: agent.slug, department: agent.department.name } : null,
      request: run.requestText.split(/\r?\n/)[0]!.slice(0, 160),
      summary: handoff?.summary.slice(0, 240) ?? null,
      costCents: Math.round(run.costCents * 100) / 100,
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      elapsedMs: elapsed(run, now),
      pendingApprovals: pendingBySession.get(run.sessionId) ?? 0,
      planId: run.planId,
      error: run.errorMessage,
      children: []
    };
  };
  const nodes = new Map(all.map((run) => [run.id, nodeOf(run)]));
  for (const run of all) {
    if (run.parentRunId) nodes.get(run.parentRunId)?.children.push(nodes.get(run.id)!);
  }
  // Pending approvals anywhere in a tree show on its root, so the list says where a person is needed.
  const rollUp = (node: RunNode): number => node.pendingApprovals + node.children.reduce((sum, child) => sum + rollUp(child), 0);
  const trees = roots.map((root) => {
    const node = nodes.get(root.id)!;
    return { ...node, treePendingApprovals: rollUp(node), treeSize: all.filter((run) => run.rootRunId === root.id).length };
  });

  const pendingToolApprovals = await prisma.approval.count({ where: { organizationId: orgId, status: "pending", kind: "tool" } });
  const proposedPlans = plans.filter((plan) => plan.status === "proposed").length;

  return {
    counts: {
      activeRuns: all.filter((run) => !isTerminalStatus(run.status)).length,
      waitingForYou: pendingToolApprovals + questions + proposedPlans + proposedMemories,
      approvals: pendingToolApprovals,
      questions,
      plansToReview: proposedPlans,
      memoriesToReview: proposedMemories
    },
    spend: {
      todayCents: today.totalCents,
      dailyBudgetCents: policy.dailyBudgetCents ?? defaultDailyBudgetCents(),
      paused: policy.agentsPaused
    },
    trees,
    plans: plans.map((plan) => {
      const live = plan.nodes.filter((node) => node.status !== "skipped");
      return {
        id: plan.id,
        goal: plan.goal,
        status: plan.status,
        steps: live.length,
        done: live.filter((node) => node.status === "done").length,
        running: live.filter((node) => ["starting", "running", "reviewing"].includes(node.status)).length,
        createdAt: plan.createdAt.toISOString()
      };
    })
  };
}

export type MissionOverview = Awaited<ReturnType<typeof getMissionOverview>>;

/** One run, its event log (for the timeline and replay), its children and its approvals. */
export async function getRunDetail(orgId: string, runId: string) {
  const run = await prisma.run.findFirst({ where: { id: runId, organizationId: orgId } });
  if (!run) return null;
  const [events, agent, children, approvals, task] = await Promise.all([
    listEvents(run.id, 0, 2000),
    prisma.agent.findUnique({ where: { id: run.agentId }, select: { id: true, name: true, slug: true } }),
    prisma.run.findMany({ where: { parentRunId: run.id }, orderBy: { createdAt: "asc" } }),
    prisma.approval.findMany({ where: { sessionId: run.sessionId }, orderBy: { createdAt: "asc" } }),
    run.taskId ? prisma.task.findUnique({ where: { id: run.taskId }, select: { id: true, title: true, archivedAt: true } }) : null
  ]);
  const childAgents = await prisma.agent.findMany({ where: { id: { in: children.map((c) => c.agentId) } }, select: { id: true, name: true } });
  const childName = new Map(childAgents.map((a) => [a.id, a.name]));
  const now = Date.now();

  return {
    run: {
      id: run.id,
      sessionId: run.sessionId,
      kind: run.kind,
      status: run.status,
      request: run.requestText,
      output: run.outputText,
      error: run.errorMessage,
      handoff: parseStoredHandoff(run.resultJson),
      costCents: Math.round(run.costCents * 100) / 100,
      turns: run.turnCount,
      depth: run.depth,
      parentRunId: run.parentRunId,
      rootRunId: run.rootRunId,
      planId: run.planId,
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      elapsedMs: elapsed(run, now)
    },
    agent,
    task: task ? { id: task.id, title: task.title } : null,
    // A finished task run can be run again; delegated and plan runs are retried from their parent or plan instead.
    canRetry: isTerminalStatus(run.status) && run.parentRunId === null && run.kind === "task" && !!task && !task.archivedAt,
    canCancel: !isTerminalStatus(run.status) && run.parentRunId === null,
    events: events.map((event) => ({ seq: event.seq, type: event.type, at: event.createdAt.toISOString(), data: event.data })),
    children: children.map((child) => ({
      runId: child.id,
      sessionId: child.sessionId,
      kind: child.kind,
      status: child.status,
      agentName: childName.get(child.agentId) ?? "Agent",
      costCents: Math.round(child.costCents * 100) / 100
    })),
    approvals: approvals.map((approval) => ({
      id: approval.id,
      kind: approval.kind,
      toolName: approval.toolName,
      summary: approval.description ?? approval.title,
      risk: approval.riskLevel,
      status: approval.status,
      decisionScope: approval.decisionScope,
      edited: !!approval.editedPayloadJson,
      createdAt: approval.createdAt.toISOString(),
      reviewedAt: approval.reviewedAt?.toISOString() ?? null
    }))
  };
}

export type RunDetail = NonNullable<Awaited<ReturnType<typeof getRunDetail>>>;

// ── Manager tools ─────────────────────────────────────────────────────────────

export type RunActionResult<T = unknown> = { kind: "ok"; value: T } | { kind: "not_found" } | { kind: "conflict"; message: string };

/**
 * Run a finished task again (fork): same task and agent, the original request or a changed one. The old run and
 * its history stay as they were.
 */
export async function retryRun(params: { orgId: string; runId: string; message?: string | null }): Promise<RunActionResult<{ sessionId: string }>> {
  const run = await prisma.run.findFirst({ where: { id: params.runId, organizationId: params.orgId } });
  if (!run) return { kind: "not_found" };
  if (!isTerminalStatus(run.status)) return { kind: "conflict", message: "This run is still going. Cancel it first, or wait for it to finish." };
  if (run.parentRunId || run.kind !== "task" || !run.taskId) {
    return { kind: "conflict", message: "Only a task run can be retried here. Delegated work is retried by its parent, plan steps from the plan." };
  }
  const session = await startAgentRun({
    orgId: params.orgId,
    taskId: run.taskId,
    agentId: run.agentId,
    message: params.message?.trim() || run.requestText
  });
  if (!session) return { kind: "conflict", message: "The task or its agent no longer exists." };
  return { kind: "ok", value: { sessionId: session.id } };
}

export async function cancelRunTree(params: { orgId: string; runId: string }): Promise<RunActionResult> {
  const run = await prisma.run.findFirst({ where: { id: params.runId, organizationId: params.orgId } });
  if (!run) return { kind: "not_found" };
  if (isTerminalStatus(run.status)) return { kind: "conflict", message: `This run already ${run.status}.` };
  await cancelRun(run.rootRunId === run.id ? run.id : run.rootRunId, "Cancelled from Mission Control.");
  return { kind: "ok", value: null };
}

/** A manager's comment on a run, kept in the task's chat so the team (and later runs) can see it. */
export async function addRunComment(params: { orgId: string; runId: string; userId: string; body: string }): Promise<RunActionResult<{ messageId: string }>> {
  const run = await prisma.run.findFirst({ where: { id: params.runId, organizationId: params.orgId } });
  if (!run) return { kind: "not_found" };
  if (!run.taskId) return { kind: "conflict", message: "This run has no task to comment on." };
  const thread =
    (await prisma.chatThread.findFirst({ where: { organizationId: params.orgId, taskId: run.taskId, kind: "task", archivedAt: null } })) ??
    (await prisma.chatThread.create({ data: { organizationId: params.orgId, taskId: run.taskId, agentId: run.agentId, kind: "task", title: "Task chat" } }));
  const message = await prisma.chatMessage.create({
    data: {
      organizationId: params.orgId,
      threadId: thread.id,
      senderType: "user",
      senderUserId: params.userId,
      body: params.body,
      metadataJson: JSON.stringify({ kind: "run_comment", runId: run.id })
    }
  });
  return { kind: "ok", value: { messageId: message.id } };
}
