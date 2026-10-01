import { prisma } from "@/lib/db/client";
import { createRun } from "@/lib/agents/engine/run-store";
import { enqueueAdvance } from "@/lib/agents/engine/wake";
import { AgentsPausedError, assertAgentsNotPaused } from "@/lib/agents/flags";
import { defaultDailyBudgetCents } from "@/lib/agents/policy/limits";
import { getEffectivePolicy, resolveRunLimits } from "@/lib/agents/policy/store";
import { spendToday } from "@/lib/agents/policy/spend";
import { parsePermissionMode } from "@/lib/agents/run-scope";
import { AppError } from "@/lib/utils/error";

const json = (value: unknown) => JSON.stringify(value);

export type StartAgentRunInput = {
  orgId: string;
  taskId: string;
  /** Agent to run. Falls back to the task's agent, then its department's default agent. */
  agentId?: string | null;
  /** Extra instruction from the user; replaces the task text as the agent's request. */
  message?: string | null;
  /** Run.kind (default task). Plans start their planning, step, review and report runs through here too. */
  kind?: string;
  planId?: string | null;
  planNodeId?: string | null;
  /** Allow a task that is archived (review runs work on hidden tasks, like consults). */
  includeArchived?: boolean;
};

/**
 * The single entry point for running an agent on a task.
 *
 * Agent launch, task start, approval auto-start, roadmap launch and chat `/run`
 * all come through here, so every run gets the same tool-use loop, event stream,
 * kill switch and audit records. Returns the new session as soon as it exists.
 * The run itself is a durable record that a worker advances step by step, so it
 * carries on across restarts and can wait for approvals; it reports through its event log.
 *
 * Returns null when the task is not in this org or no agent can be resolved.
 * Throws AgentsPausedError while the global kill switch or the org's pause is on, and a 429 AppError once the
 * org has used its daily agent budget.
 */
export async function startAgentRun({
  orgId,
  taskId,
  agentId = null,
  message = null,
  kind,
  planId = null,
  planNodeId = null,
  includeArchived = false
}: StartAgentRunInput) {
  assertAgentsNotPaused();

  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: orgId, ...(includeArchived ? {} : { archivedAt: null }) },
    include: { department: true }
  });
  if (!task) return null;

  const agent = await resolveAgent({ orgId, task, agentId });
  if (!agent) return null;

  await assertOrgMayRun(orgId, agent.id);

  const now = new Date();
  await prisma.task.update({
    where: { id: task.id },
    data: {
      status: "running",
      agentId: agent.id,
      departmentId: task.departmentId ?? agent.departmentId,
      startedAt: task.startedAt ?? now
    }
  });

  const session = await prisma.taskSession.create({
    data: {
      organizationId: orgId,
      taskId: task.id,
      agentId: agent.id,
      status: "running",
      startedAt: now,
      browserUrl: `/org/${orgId}/canvas?task=${task.id}`,
      scratchpad: [
        `# ${agent.name} — Running`,
        "",
        `**Task:** ${task.title}`,
        task.department?.name ? `**Department:** ${task.department.name}` : null,
        message?.trim() ? `**Note:** ${message.trim()}` : null,
        "",
        "_Working on it…_"
      ].filter(Boolean).join("\n")
    }
  });

  await prisma.agentAction.create({
    data: {
      organizationId: orgId,
      sessionId: session.id,
      agentId: agent.id,
      label: "Session started",
      actionType: "session.start",
      status: "completed",
      completedAt: now,
      payloadJson: json({ taskId: task.id, message: message?.trim() ?? null })
    }
  });
  await prisma.agent.updateMany({ where: { id: agent.id }, data: { status: "running" } });

  const request = message?.trim() || `${task.title}${task.description ? `: ${task.description}` : ""}`;

  let mode = parsePermissionMode(undefined);
  try {
    mode = parsePermissionMode((JSON.parse(agent.permissionsJson ?? "{}") as { mode?: unknown }).mode);
  } catch { /* keep the safe default */ }

  const run = await createRun({
    organizationId: orgId,
    sessionId: session.id,
    taskId: task.id,
    agentId: agent.id,
    requestText: request,
    mode,
    limits: await resolveRunLimits(orgId, agent.id),
    kind,
    planId,
    planNodeId
  });
  await enqueueAdvance(run.id);

  return session;
}

/**
 * Org-level pause and the daily spend caps: the org's, the agent's own and its department's. Runs already in progress
 * stop at their next turn if the org is paused; caps are checked when a run starts.
 */
async function assertOrgMayRun(orgId: string, agentId: string) {
  const { agentsPaused, dailyBudgetCents, agentDailyBudgetCents } = await getEffectivePolicy(orgId, agentId);
  if (agentsPaused) throw new AgentsPausedError("Agent execution is paused for this organization.");

  const cap = dailyBudgetCents ?? defaultDailyBudgetCents();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const records = await prisma.usageRecord.findMany({
    where: { organizationId: orgId, category: "tokens", sourceId: { startsWith: "run:" }, occurredAt: { gte: startOfDay } },
    select: { costCents: true }
  });
  const spent = records.reduce((sum, record) => sum + record.costCents, 0);
  if (spent >= cap) {
    throw new AppError(
      `This organization has used its daily agent budget (${spent}¢ of ${cap}¢). Raise the limit in agent settings or try again tomorrow.`,
      429,
      "INTERNAL"
    );
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { name: true, department: { select: { id: true, name: true, dailyBudgetCents: true } } }
  });
  const departmentCap = agent?.department.dailyBudgetCents ?? null;
  if (agentDailyBudgetCents == null && departmentCap == null) return;
  const today = await spendToday(orgId);
  const agentSpent = today.byAgent.get(agentId) ?? 0;
  if (agentDailyBudgetCents != null && agentSpent >= agentDailyBudgetCents) {
    throw new AppError(
      `${agent?.name ?? "This agent"} has used its daily budget (${agentSpent}¢ of ${agentDailyBudgetCents}¢). Raise it in Agent controls or try again tomorrow.`,
      429,
      "INTERNAL"
    );
  }
  const departmentSpent = agent ? (today.byDepartment.get(agent.department.id) ?? 0) : 0;
  if (departmentCap != null && departmentSpent >= departmentCap) {
    throw new AppError(
      `The ${agent?.department.name ?? ""} department has used its daily budget (${departmentSpent}¢ of ${departmentCap}¢). Raise it in Agent controls or try again tomorrow.`,
      429,
      "INTERNAL"
    );
  }
}

async function resolveAgent({
  orgId,
  task,
  agentId
}: {
  orgId: string;
  task: { agentId: string | null; departmentId: string | null };
  agentId: string | null;
}) {
  const wantedId = agentId ?? task.agentId;
  if (wantedId) {
    const agent = await prisma.agent.findFirst({ where: { id: wantedId, organizationId: orgId, archivedAt: null } });
    if (agent) return agent;
  }
  if (!task.departmentId) return null;
  return (
    (await prisma.agent.findFirst({
      where: { organizationId: orgId, departmentId: task.departmentId, isDefault: true, archivedAt: null }
    })) ??
    (await prisma.agent.findFirst({
      where: { organizationId: orgId, departmentId: task.departmentId, archivedAt: null }
    }))
  );
}
