import { publishOrgEvent } from "@/lib/automations/channels";
import type { Plan, PlanNode, Run } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { defaultDailyBudgetCents } from "../policy/limits";
import { getOrgPolicy } from "../policy/store";
import {
  criticalPathMinutes,
  DEFAULT_NODE_COST_CENTS,
  DEFAULT_NODE_MINUTES,
  findCycle,
  parseKeys,
  parsePlanInput,
  type PlanNodeInput
} from "./schema";
import { isSystemAgentSlug } from "./system-agents";
import { enqueuePlanAdvance } from "./wake";

/** Steps whose work is finished or under way: a revision keeps them as they are. */
const KEPT_NODE_STATUSES: ReadonlySet<string> = new Set(["done", "starting", "running", "reviewing"]);

const json = (value: unknown) => JSON.stringify(value);

// ── The Chief of Staff's proposal (called by the run engine for propose_plan) ─

type OrgAgent = { id: string; slug: string; name: string; departmentId: string };

async function orgAgentsBySlug(orgId: string): Promise<Map<string, OrgAgent>> {
  const agents = await prisma.agent.findMany({
    where: { organizationId: orgId, archivedAt: null },
    select: { id: true, slug: true, name: true, departmentId: true }
  });
  return new Map(agents.map((agent) => [agent.slug, agent]));
}

function ownerProblems(nodes: PlanNodeInput[], agents: Map<string, OrgAgent>): string[] {
  const problems: string[] = [];
  for (const node of nodes) {
    if (isSystemAgentSlug(node.agentSlug)) problems.push(`step "${node.key}": ${node.agentSlug} cannot own a step; give it to a teammate`);
    else if (!agents.has(node.agentSlug)) problems.push(`step "${node.key}": no teammate with slug "${node.agentSlug}"`);
  }
  return problems;
}

function nodeData(node: PlanNodeInput, owner: OrgAgent, sortOrder: number) {
  return {
    title: node.title,
    description: node.description,
    agentId: owner.id,
    departmentId: owner.departmentId,
    dependsOnJson: json(node.dependsOn),
    acceptanceCriteriaJson: json(node.acceptanceCriteria),
    review: node.review ?? false,
    estimatedCostCents: node.estimatedCostCents ?? null,
    estimatedMinutes: node.estimatedMinutes ?? null,
    riskNotes: node.riskNotes ?? null,
    sortOrder
  };
}

/** Totals over the steps that will still run (skipped ones do not count). */
export function planEstimates(nodes: Array<Pick<PlanNode, "key" | "status" | "dependsOnJson" | "estimatedCostCents" | "estimatedMinutes">>) {
  const live = nodes.filter((node) => node.status !== "skipped");
  return {
    estimatedCostCents: Math.round(live.reduce((sum, node) => sum + (node.estimatedCostCents ?? DEFAULT_NODE_COST_CENTS), 0) * 100) / 100,
    estimatedMinutes: criticalPathMinutes(
      live.map((node) => ({ key: node.key, dependsOn: parseKeys(node.dependsOnJson), minutes: node.estimatedMinutes ?? DEFAULT_NODE_MINUTES }))
    )
  };
}

async function spentTodayCents(orgId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await prisma.usageRecord.findMany({
    where: { organizationId: orgId, category: "tokens", sourceId: { startsWith: "run:" }, occurredAt: { gte: startOfDay } },
    select: { costCents: true }
  });
  return rows.reduce((sum, row) => sum + row.costCents, 0);
}

/** A manager's auto-approve applies only within policy: the estimate must fit what is left of today's budget. */
async function fitsDailyBudget(orgId: string, estimatedCostCents: number): Promise<boolean> {
  const policy = await getOrgPolicy(orgId);
  const cap = policy.dailyBudgetCents ?? defaultDailyBudgetCents();
  return estimatedCostCents <= cap - (await spentTodayCents(orgId));
}

export type ProposalResult = { ok: true; message: string; nodeCount: number; summary: string } | { ok: false; error: string };

/**
 * Record what the Chief of Staff passed to propose_plan. A drafting plan gets its steps and waits for the founder's
 * review (or starts, when a manager's auto-approve applies). A plan being replanned is revised in place: finished
 * and running steps stay, failed and pending ones are replaced, steps left out are skipped, and work carries on.
 */
export async function recordProposedPlan(run: Pick<Run, "planId" | "organizationId">, input: unknown): Promise<ProposalResult> {
  if (!run.planId) return { ok: false, error: "Error: this run is not planning a goal." };
  const plan = await prisma.plan.findUnique({ where: { id: run.planId }, include: { nodes: true } });
  if (!plan || plan.organizationId !== run.organizationId) return { ok: false, error: "Error: the plan no longer exists." };

  if (plan.status === "drafting") return recordFirstProposal(plan, input);
  if (plan.status === "replanning") return recordRevision(plan, input);
  return { ok: false, error: `Error: this plan is ${plan.status} and cannot be changed now.` };
}

async function recordFirstProposal(plan: Plan & { nodes: PlanNode[] }, input: unknown): Promise<ProposalResult> {
  const parsed = parsePlanInput(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const agents = await orgAgentsBySlug(plan.organizationId);
  const problems = ownerProblems(parsed.plan.nodes, agents);
  if (problems.length) return { ok: false, error: `The plan has problems: ${problems.join("; ")}. Fix them and call propose_plan again.` };

  const nodes = parsed.plan.nodes;
  const estimates = planEstimates(
    nodes.map((node) => ({
      key: node.key,
      status: "pending",
      dependsOnJson: json(node.dependsOn),
      estimatedCostCents: node.estimatedCostCents ?? null,
      estimatedMinutes: node.estimatedMinutes ?? null
    }))
  );
  const autoStart = plan.autoApprove && (await fitsDailyBudget(plan.organizationId, estimates.estimatedCostCents));
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    await tx.planNode.deleteMany({ where: { planId: plan.id } });
    await tx.planNode.createMany({
      data: nodes.map((node, index) => ({ planId: plan.id, key: node.key, ...nodeData(node, agents.get(node.agentSlug)!, index) }))
    });
    // Only a plan still drafting takes the proposal (two proposals racing cannot both land).
    return tx.plan.updateMany({
      where: { id: plan.id, status: "drafting" },
      data: {
        summary: parsed.plan.summary,
        ...estimates,
        status: autoStart ? "running" : "proposed",
        ...(autoStart ? { approvedAt: now, approvedByUserId: plan.createdByUserId } : {})
      }
    });
  });
  if (updated.count !== 1) return { ok: false, error: "Error: this plan was changed meanwhile and cannot take the proposal." };
  if (plan.taskId) await prisma.task.update({ where: { id: plan.taskId }, data: { status: autoStart ? "running" : "ready_to_review" } });
  if (autoStart) await enqueuePlanAdvance(plan.id);
  else {
    await publishOrgEvent(plan.organizationId, "plan.proposed", {
      text: `Plan ready for review: ${plan.goal.slice(0, 200)} (${nodes.length} steps, ~${Math.round(estimates.estimatedCostCents)}¢)`,
      path: `/org/${plan.organizationId}/canvas?plan=${plan.id}`,
      data: { planId: plan.id, goal: plan.goal, summary: parsed.plan.summary, steps: nodes.length, estimatedCostCents: estimates.estimatedCostCents }
    });
  }

  return {
    ok: true,
    nodeCount: nodes.length,
    summary: `Proposed a plan with ${nodes.length} step${nodes.length === 1 ? "" : "s"}.`,
    message: autoStart
      ? `Plan recorded with ${nodes.length} steps and approved within budget. Work starts now.`
      : `Plan recorded with ${nodes.length} steps. The founder will review it before work starts. Your planning run ends here.`
  };
}

async function recordRevision(plan: Plan & { nodes: PlanNode[] }, input: unknown): Promise<ProposalResult> {
  const kept = plan.nodes.filter((node) => KEPT_NODE_STATUSES.has(node.status));
  const parsed = parsePlanInput(input, kept.map((node) => node.key));
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const agents = await orgAgentsBySlug(plan.organizationId);
  const keptKeys = new Set(kept.map((node) => node.key));
  const changing = parsed.plan.nodes.filter((node) => !keptKeys.has(node.key));
  const problems = ownerProblems(changing, agents);
  if (problems.length) return { ok: false, error: `The plan has problems: ${problems.join("; ")}. Fix them and call propose_plan again.` };

  // The revised graph: kept steps as they are, everything else as proposed. It must still be loop-free.
  const graph = [
    ...kept.map((node) => ({ key: node.key, dependsOn: parseKeys(node.dependsOnJson) })),
    ...changing.map((node) => ({ key: node.key, dependsOn: node.dependsOn }))
  ];
  const cycle = findCycle(graph);
  if (cycle) return { ok: false, error: `The plan has problems: the dependencies form a loop: ${cycle.join(" -> ")}. Fix them and call propose_plan again.` };

  const byKey = new Map(plan.nodes.map((node) => [node.key, node]));
  const proposedKeys = new Set(parsed.plan.nodes.map((node) => node.key));
  const baseOrder = plan.nodes.length;

  await prisma.$transaction(async (tx) => {
    for (const [index, node] of changing.entries()) {
      const data = nodeData(node, agents.get(node.agentSlug)!, byKey.get(node.key)?.sortOrder ?? baseOrder + index);
      const existing = byKey.get(node.key);
      if (existing) {
        // A retried step starts fresh but keeps its task and the reason the last attempt failed.
        await tx.planNode.update({
          where: { id: existing.id },
          data: { ...data, status: "pending", attempts: 0, runId: null, reviewRunId: null, resultJson: null, reviewJson: null, startedAt: null, finishedAt: null }
        });
      } else {
        await tx.planNode.create({ data: { planId: plan.id, key: node.key, ...data } });
      }
    }
    for (const node of plan.nodes) {
      if (!proposedKeys.has(node.key) && (node.status === "pending" || node.status === "failed")) {
        await tx.planNode.update({ where: { id: node.id }, data: { status: "skipped", finishedAt: new Date() } });
      }
    }
    const nodes = await tx.planNode.findMany({ where: { planId: plan.id } });
    await tx.plan.update({
      where: { id: plan.id },
      data: { summary: parsed.plan.summary, version: { increment: 1 }, status: "running", errorMessage: null, ...planEstimates(nodes) }
    });
  });
  await enqueuePlanAdvance(plan.id);

  return {
    ok: true,
    nodeCount: parsed.plan.nodes.length,
    summary: `Revised the plan (${changing.length} step${changing.length === 1 ? "" : "s"} changed or added).`,
    message: "Revised plan recorded. Work continues with it now. Your replanning run ends here."
  };
}
