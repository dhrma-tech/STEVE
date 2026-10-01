import type { Plan, PlanNode } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { startAgentRun } from "../run-service";
import { cancelRun } from "../engine/advance";
import { parseStoredHandoff, type Handoff } from "../engine/handoff";
import { ACTIVE_STATUSES } from "../engine/types";
import { ALWAYS_ASK_RISKS, classifyToolCall, type ToolRisk } from "../policy/risk";
import { buildToolset } from "../tools/registry";
import { planEstimates } from "./proposal";
import { DEFAULT_NODE_COST_CENTS, DEFAULT_NODE_MINUTES, findCycle, parseKeys } from "./schema";
import { ensureOrchestrator, ensureReviewer, isSystemAgentSlug } from "./system-agents";
import { enqueuePlanAdvance } from "./wake";

export type PlanStatus = "drafting" | "proposed" | "running" | "replanning" | "reporting" | "completed" | "failed" | "cancelled";
export type NodeStatus = "pending" | "starting" | "running" | "reviewing" | "done" | "failed" | "skipped";

export const FINAL_PLAN_STATUSES: ReadonlySet<string> = new Set(["completed", "failed", "cancelled"]);

const json = (value: unknown) => JSON.stringify(value);

// ── Starting a plan ───────────────────────────────────────────────────────────

export function planningRequest(goal: string, context?: string | null): string {
  return [
    `The founder's goal: ${goal}`,
    context ? `\nContext:\n${context}` : "",
    "\nMake a plan for this goal and record it with propose_plan. The founder reviews it before any work starts."
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Turn a founder's goal into a plan: create the plan and the Chief of Staff's task, and start the planning run.
 * The plan stays `drafting` until the Chief of Staff calls propose_plan.
 *
 * `autoApprove` (a manager asking to skip review) only takes effect when the plan's estimate fits the remaining
 * daily budget; otherwise the plan waits for review like any other.
 */
export async function createGoalPlan(params: {
  orgId: string;
  userId: string | null;
  goal: string;
  context?: string | null;
  roadmapItemId?: string | null;
  autoApprove?: boolean;
}) {
  const { orgId, userId, goal } = params;
  const orchestrator = await ensureOrchestrator(orgId);
  await ensureReviewer(orgId);

  const task = await prisma.task.create({
    data: {
      organizationId: orgId,
      departmentId: orchestrator.departmentId,
      agentId: orchestrator.id,
      roadmapItemId: params.roadmapItemId ?? null,
      createdByUserId: userId,
      title: `Plan: ${goal}`.slice(0, 80),
      description: goal,
      type: "agent_task",
      status: "queued",
      priority: 2,
      metadataJson: json({ source: "plan" })
    }
  });
  const plan = await prisma.plan.create({
    data: {
      organizationId: orgId,
      goal,
      orchestratorAgentId: orchestrator.id,
      taskId: task.id,
      roadmapItemId: params.roadmapItemId ?? null,
      createdByUserId: userId,
      autoApprove: !!params.autoApprove
    }
  });
  await prisma.task.update({ where: { id: task.id }, data: { metadataJson: json({ source: "plan", planId: plan.id }) } });

  try {
    const session = await startAgentRun({
      orgId,
      taskId: task.id,
      agentId: orchestrator.id,
      message: planningRequest(goal, params.context),
      kind: "plan",
      planId: plan.id
    });
    if (!session) throw new Error("The Chief of Staff could not be started.");
    return { plan, task, sessionId: session.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.plan.update({ where: { id: plan.id }, data: { status: "failed", outcome: "failed", errorMessage: message, finishedAt: new Date() } });
    await prisma.task.update({ where: { id: task.id }, data: { status: "todo" } });
    throw error;
  }
}

// ── Founder review ────────────────────────────────────────────────────────────

export type PlanActionResult<T = unknown> =
  | { kind: "ok"; value: T }
  | { kind: "not_found" }
  | { kind: "conflict"; message: string }
  | { kind: "invalid"; message: string };

export async function approvePlan(params: { orgId: string; planId: string; userId: string }): Promise<PlanActionResult> {
  const plan = await prisma.plan.findFirst({ where: { id: params.planId, organizationId: params.orgId }, include: { nodes: true } });
  if (!plan) return { kind: "not_found" };
  if (plan.status !== "proposed") return { kind: "conflict", message: `This plan is ${plan.status}; only a proposed plan can be approved.` };
  if (!plan.nodes.some((node) => node.status !== "skipped")) return { kind: "invalid", message: "The plan has no steps left to run." };

  const updated = await prisma.plan.updateMany({
    where: { id: plan.id, status: "proposed" },
    data: { status: "running", approvedAt: new Date(), approvedByUserId: params.userId }
  });
  if (updated.count !== 1) return { kind: "conflict", message: "This plan was changed meanwhile. Reload it and try again." };
  if (plan.taskId) await prisma.task.update({ where: { id: plan.taskId }, data: { status: "running" } });
  await enqueuePlanAdvance(plan.id);
  return { kind: "ok", value: null };
}

export type NodeEdit = {
  id: string;
  title?: string;
  description?: string;
  agentId?: string;
  acceptanceCriteria?: string[];
  dependsOn?: string[];
  review?: boolean;
  remove?: boolean;
};

/** The founder's changes to a proposed plan: retitle, rebrief, reassign, change criteria or dependencies, remove steps. */
export async function editPlan(params: { orgId: string; planId: string; nodes: NodeEdit[] }): Promise<PlanActionResult> {
  const plan = await prisma.plan.findFirst({ where: { id: params.planId, organizationId: params.orgId }, include: { nodes: true } });
  if (!plan) return { kind: "not_found" };
  if (plan.status !== "proposed") return { kind: "conflict", message: `This plan is ${plan.status}; only a proposed plan can be edited.` };

  const byId = new Map(plan.nodes.map((node) => [node.id, node]));
  for (const edit of params.nodes) if (!byId.has(edit.id)) return { kind: "invalid", message: `Unknown step ${edit.id}.` };

  const removedKeys = new Set(params.nodes.filter((edit) => edit.remove).map((edit) => byId.get(edit.id)!.key));
  const remaining = plan.nodes.filter((node) => !removedKeys.has(node.key) && node.status !== "skipped");
  if (remaining.length === 0) return { kind: "invalid", message: "A plan needs at least one step. Cancel the plan instead." };

  const agentIds = [...new Set(params.nodes.map((edit) => edit.agentId).filter((id): id is string => !!id))];
  const agents = agentIds.length
    ? await prisma.agent.findMany({ where: { id: { in: agentIds }, organizationId: params.orgId, archivedAt: null } })
    : [];
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  for (const id of agentIds) {
    const agent = agentById.get(id);
    if (!agent || isSystemAgentSlug(agent.slug)) return { kind: "invalid", message: "Steps can only be assigned to the company's department agents." };
  }

  // The graph after the edits: removed steps disappear from everyone's dependencies.
  const editsById = new Map(params.nodes.map((edit) => [edit.id, edit]));
  const remainingKeys = new Set(remaining.map((node) => node.key));
  const graph = remaining.map((node) => {
    const deps = editsById.get(node.id)?.dependsOn ?? parseKeys(node.dependsOnJson);
    return { node, dependsOn: [...new Set(deps.map((key) => key.trim().toLowerCase()))].filter((key) => !removedKeys.has(key)) };
  });
  for (const { node, dependsOn } of graph) {
    const unknown = dependsOn.find((key) => !remainingKeys.has(key) || key === node.key);
    if (unknown) return { kind: "invalid", message: `Step "${node.title}" cannot depend on "${unknown}".` };
  }
  const cycle = findCycle(graph.map(({ node, dependsOn }) => ({ key: node.key, dependsOn })));
  if (cycle) return { kind: "invalid", message: `Those dependencies form a loop: ${cycle.join(" -> ")}.` };

  await prisma.$transaction(async (tx) => {
    for (const node of plan.nodes.filter((candidate) => removedKeys.has(candidate.key))) {
      await tx.planNode.update({ where: { id: node.id }, data: { status: "skipped" } });
    }
    for (const { node, dependsOn } of graph) {
      const edit = editsById.get(node.id);
      const agent = edit?.agentId ? agentById.get(edit.agentId) : undefined;
      await tx.planNode.update({
        where: { id: node.id },
        data: {
          dependsOnJson: json(dependsOn),
          ...(edit?.title !== undefined ? { title: edit.title } : {}),
          ...(edit?.description !== undefined ? { description: edit.description } : {}),
          ...(edit?.acceptanceCriteria !== undefined ? { acceptanceCriteriaJson: json(edit.acceptanceCriteria) } : {}),
          ...(edit?.review !== undefined ? { review: edit.review } : {}),
          ...(agent ? { agentId: agent.id, departmentId: agent.departmentId } : {})
        }
      });
    }
    const nodes = await tx.planNode.findMany({ where: { planId: plan.id } });
    await tx.plan.update({ where: { id: plan.id }, data: planEstimates(nodes) });
  });
  return { kind: "ok", value: null };
}

/** Stop a plan: cancel every run still working on it and skip the steps that have not finished. */
export async function cancelPlan(params: { orgId: string; planId: string }): Promise<PlanActionResult> {
  const plan = await prisma.plan.findFirst({ where: { id: params.planId, organizationId: params.orgId }, include: { nodes: true } });
  if (!plan) return { kind: "not_found" };
  if (FINAL_PLAN_STATUSES.has(plan.status)) return { kind: "conflict", message: `This plan is already ${plan.status}.` };

  const now = new Date();
  const updated = await prisma.plan.updateMany({
    where: { id: plan.id, status: { notIn: [...FINAL_PLAN_STATUSES] } },
    data: { status: "cancelled", outcome: "cancelled", finishedAt: now }
  });
  if (updated.count !== 1) return { kind: "conflict", message: "This plan already finished." };

  await prisma.planNode.updateMany({
    where: { planId: plan.id, status: { notIn: ["done", "skipped", "failed"] } },
    data: { status: "skipped", finishedAt: now }
  });
  const runs = await prisma.run.findMany({ where: { planId: plan.id, status: { in: [...ACTIVE_STATUSES] } }, select: { id: true } });
  for (const run of runs) await cancelRun(run.id, "The plan was cancelled.");
  const taskIds = [plan.taskId, ...plan.nodes.map((node) => node.taskId)].filter((id): id is string => !!id);
  await prisma.task.updateMany({
    where: { id: { in: taskIds }, status: { notIn: ["completed", "canceled", "archived"] } },
    data: { status: "canceled" }
  });
  return { kind: "ok", value: null };
}

// ── Reading plans ─────────────────────────────────────────────────────────────

const RISK_LABELS: Partial<Record<ToolRisk, string>> = {
  external_comms: "contact people or publish",
  spend: "spend money or deploy to production",
  external_write: "change outside systems (GitHub, Supabase, social drafts)",
  destructive: "delete files"
};

function skillKeysOf(toolsJson: string | null): string[] {
  try {
    const config = JSON.parse(toolsJson ?? "{}") as { skillKeys?: unknown };
    return Array.isArray(config.skillKeys) ? config.skillKeys.filter((key): key is string => typeof key === "string") : [];
  } catch {
    return [];
  }
}

/** What an owner's tools could do that needs care. Always-ask risks are flagged: those pause for the founder. */
function toolHotspots(toolsJson: string | null): string[] {
  const risks = new Set(buildToolset(skillKeysOf(toolsJson)).map((tool) => classifyToolCall(tool.definition.name)));
  return [...risks]
    .filter((risk) => RISK_LABELS[risk])
    .map((risk) => (ALWAYS_ASK_RISKS.has(risk) ? `Can ${RISK_LABELS[risk]} (asks you first)` : `Can ${RISK_LABELS[risk]}`));
}

function parseReview(json: string | null): { verdict: "pass" | "fail" | "skipped"; summary: string; findings: string[] } | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as { verdict: "pass" | "fail" | "skipped"; summary: string; findings: string[] };
  } catch {
    return null;
  }
}

export async function serializePlan(plan: Plan & { nodes: PlanNode[] }) {
  const agentIds = [...new Set(plan.nodes.map((node) => node.agentId).filter((id): id is string => !!id))];
  const runIds = plan.nodes.flatMap((node) => [node.runId, node.reviewRunId]).filter((id): id is string => !!id);
  const [agents, runs, planRuns] = await Promise.all([
    prisma.agent.findMany({ where: { id: { in: agentIds } }, include: { department: { select: { id: true, name: true, slug: true } } } }),
    prisma.run.findMany({ where: { id: { in: runIds } }, select: { id: true, sessionId: true, status: true } }),
    // Every run started for the plan is a root run, so its cost already includes whatever it delegated.
    prisma.run.findMany({
      where: { planId: plan.id, parentRunId: null },
      select: { id: true, kind: true, sessionId: true, costCents: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" }
    })
  ]);
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const runById = new Map(runs.map((run) => [run.id, run]));
  const chiefRuns = planRuns.filter((run) => run.kind === "plan");
  const reportRun = planRuns.filter((run) => run.kind === "plan_report").at(-1) ?? null;

  const nodes = [...plan.nodes]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime())
    .map((node) => {
      const agent = node.agentId ? agentById.get(node.agentId) : undefined;
      const run = node.runId ? runById.get(node.runId) : undefined;
      const reviewRun = node.reviewRunId ? runById.get(node.reviewRunId) : undefined;
      const hotspots = agent ? toolHotspots(agent.toolsJson) : [];
      return {
        id: node.id,
        key: node.key,
        title: node.title,
        description: node.description,
        status: node.status as NodeStatus,
        agent: agent ? { id: agent.id, name: agent.name, slug: agent.slug } : null,
        department: agent?.department ?? null,
        dependsOn: parseKeys(node.dependsOnJson),
        acceptanceCriteria: parseKeys(node.acceptanceCriteriaJson),
        review: node.review,
        estimatedCostCents: node.estimatedCostCents ?? DEFAULT_NODE_COST_CENTS,
        estimatedMinutes: node.estimatedMinutes ?? DEFAULT_NODE_MINUTES,
        riskNotes: node.riskNotes,
        riskHotspots: node.riskNotes ? [node.riskNotes, ...hotspots] : hotspots,
        attempts: node.attempts,
        feedback: node.feedback,
        result: parseStoredHandoff(node.resultJson) as Handoff | null,
        reviewResult: parseReview(node.reviewJson),
        taskId: node.taskId,
        sessionId: run?.sessionId ?? null,
        reviewSessionId: reviewRun?.sessionId ?? null,
        startedAt: node.startedAt?.toISOString() ?? null,
        finishedAt: node.finishedAt?.toISOString() ?? null
      };
    });

  return {
    id: plan.id,
    goal: plan.goal,
    status: plan.status as PlanStatus,
    outcome: plan.outcome,
    summary: plan.summary,
    version: plan.version,
    replanCount: plan.replanCount,
    maxReplans: plan.maxReplans,
    autoApprove: plan.autoApprove,
    roadmapItemId: plan.roadmapItemId,
    taskId: plan.taskId,
    planningSessionId: chiefRuns.at(-1)?.sessionId ?? null,
    reportSessionId: reportRun?.sessionId ?? null,
    estimatedCostCents: plan.estimatedCostCents,
    estimatedMinutes: plan.estimatedMinutes,
    costCents: Math.round(planRuns.reduce((sum, run) => sum + run.costCents, 0) * 100) / 100,
    departments: [...new Set(nodes.filter((node) => node.status !== "skipped").map((node) => node.department?.name).filter(Boolean))],
    reportText: plan.reportText,
    errorMessage: plan.errorMessage,
    createdAt: plan.createdAt.toISOString(),
    approvedAt: plan.approvedAt?.toISOString() ?? null,
    finishedAt: plan.finishedAt?.toISOString() ?? null,
    nodes
  };
}

export type SerializedPlan = Awaited<ReturnType<typeof serializePlan>>;

export async function getPlan(orgId: string, planId: string): Promise<SerializedPlan | null> {
  const plan = await prisma.plan.findFirst({ where: { id: planId, organizationId: orgId }, include: { nodes: true } });
  return plan ? serializePlan(plan) : null;
}

export async function listPlans(orgId: string, limit = 20) {
  const plans = await prisma.plan.findMany({
    where: { organizationId: orgId },
    include: { nodes: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
    take: limit
  });
  return plans.map((plan) => {
    const live = plan.nodes.filter((node) => node.status !== "skipped");
    return {
      id: plan.id,
      goal: plan.goal,
      status: plan.status as PlanStatus,
      outcome: plan.outcome,
      steps: live.length,
      done: live.filter((node) => node.status === "done").length,
      estimatedCostCents: plan.estimatedCostCents,
      createdAt: plan.createdAt.toISOString(),
      finishedAt: plan.finishedAt?.toISOString() ?? null
    };
  });
}
