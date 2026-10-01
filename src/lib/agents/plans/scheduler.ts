import { publishOrgEvent } from "@/lib/automations/channels";
import type { Plan, PlanNode, Run } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { markRoadmapItemComplete } from "@/lib/roadmap/progress";
import { startAgentRun } from "../run-service";
import { handoffFromText, parseStoredHandoff, type Handoff } from "../engine/handoff";
import { getRun, getRunBySession } from "../engine/run-store";
import { isTerminalStatus } from "../engine/types";
import { parseKeys } from "./schema";
import { ensureOrchestrator, ensureReviewer } from "./system-agents";
import { enqueuePlanAdvance } from "./wake";

/**
 * The plan scheduler. One job (`plan.advance`) moves a plan forward: it settles steps whose run finished, sends
 * finished work to the Reviewer, starts every step whose dependencies are done (in parallel), asks the Chief of
 * Staff to replan when a step fails, and has it write the founder report at the end. Runs wake the plan when they
 * finish (engine close-out), and the worker's sweeper re-checks plans in case a wake-up was lost.
 */

/** A step rejected by the Reviewer gets one more attempt with the feedback before it counts as failed. */
export const MAX_NODE_ATTEMPTS = 2;
const LEASE_MS = 30_000;
/** A step stuck in `starting` this long (its worker died mid-start) is checked and recovered. */
const STARTING_STALE_MS = 2 * 60_000;
/** When a step cannot start (paused agents, daily budget), try again after this long. */
const RETRY_START_MS = 60_000;

/**
 * A run counts as finished for the plan once its close-out is done (session, task and chat updated), so the plan's
 * own updates to the step's task are not overwritten by the close-out. The close-out wakes the plan afterwards.
 */
const isSettled = (run: Run) => isTerminalStatus(run.status) && run.closedOutAt !== null;

const ACTIVE_NODE_STATUSES: ReadonlySet<string> = new Set(["starting", "running", "reviewing"]);
const SETTLED_NODE_STATUSES: ReadonlySet<string> = new Set(["done", "skipped"]);

type PlanWithNodes = Plan & { nodes: PlanNode[] };
const json = (value: unknown) => JSON.stringify(value);

export type PlanAdvanceResult = "done" | "busy" | "gone";

export async function advancePlan(planId: string, options: { workerId: string }): Promise<PlanAdvanceResult> {
  const now = new Date();
  const claimed = await prisma.plan.updateMany({
    where: { id: planId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }, { lockedBy: options.workerId }] },
    data: { lockedBy: options.workerId, lockedUntil: new Date(now.getTime() + LEASE_MS) }
  });
  if (claimed.count !== 1) return (await prisma.plan.count({ where: { id: planId } })) ? "busy" : "gone";
  try {
    await tick(planId);
    return "done";
  } finally {
    await prisma.plan.updateMany({ where: { id: planId, lockedBy: options.workerId }, data: { lockedBy: null, lockedUntil: null } });
  }
}

const loadPlan = (planId: string) => prisma.plan.findUnique({ where: { id: planId }, include: { nodes: true } });

async function tick(planId: string): Promise<void> {
  let plan = await loadPlan(planId);
  if (!plan) return;

  if (plan.status === "drafting") return checkPlanning(plan);
  if (!["running", "replanning", "reporting"].includes(plan.status)) return;

  await settleNodes(plan);
  plan = (await loadPlan(planId))!;

  if (plan.status === "reporting") return checkReport(plan);
  if (plan.status === "replanning") return checkReplanning(plan);
  if (plan.status !== "running") return;

  const failed = plan.nodes.filter((node) => node.status === "failed");
  if (failed.length > 0) return replanOrWrapUp(plan, failed);

  await startReadyNodes(plan);
  plan = (await loadPlan(planId))!;
  if (plan.status === "running" && plan.nodes.every((node) => SETTLED_NODE_STATUSES.has(node.status))) {
    await beginReport(plan, "completed");
  }
}

/** The Chief of Staff's run of a given kind most recently started for this plan. */
const latestChiefRun = (planId: string, kind: "plan" | "plan_report") =>
  prisma.run.findFirst({ where: { planId, kind, parentRunId: null }, orderBy: { createdAt: "desc" } });

// ── Planning ──────────────────────────────────────────────────────────────────

/** A drafting plan whose planning run ended without a proposal has failed. */
async function checkPlanning(plan: PlanWithNodes) {
  const run = await latestChiefRun(plan.id, "plan");
  if (!run || !isSettled(run)) return;
  const reason =
    run.status === "completed"
      ? "The Chief of Staff finished without proposing a plan."
      : run.status === "cancelled"
        ? "Planning was cancelled."
        : `Planning failed: ${run.errorMessage ?? "unknown error"}`;
  await prisma.plan.updateMany({
    where: { id: plan.id, status: "drafting" },
    data: { status: "failed", outcome: "failed", errorMessage: reason, reportText: run.outputText || null, finishedAt: new Date() }
  });
  if (plan.taskId) await prisma.task.update({ where: { id: plan.taskId }, data: { status: "blocked" } });
}

// ── Settling steps ────────────────────────────────────────────────────────────

async function settleNodes(plan: PlanWithNodes) {
  for (const node of plan.nodes) {
    if (node.status === "starting") await recoverStarting(node);
    else if (node.status === "running" && node.runId) {
      const run = await getRun(node.runId);
      if (!run) await failNode(node, "The step's run disappeared.");
      else if (isSettled(run)) await onRunFinished(plan, node, run);
    } else if (node.status === "reviewing" && node.reviewRunId) {
      const run = await getRun(node.reviewRunId);
      if (!run) await markDone(node, { verdict: "skipped", summary: "The review could not be found.", findings: [] });
      else if (isSettled(run)) await onReviewFinished(node, run);
    }
  }
}

/** A worker stopped between claiming a step and recording its run: adopt the run if it exists, otherwise retry. */
async function recoverStarting(node: PlanNode) {
  if (!node.startedAt || Date.now() - node.startedAt.getTime() < STARTING_STALE_MS) return;
  const run = await prisma.run.findFirst({
    where: { planNodeId: node.id, kind: "plan_node", createdAt: { gte: node.startedAt } },
    orderBy: { createdAt: "desc" }
  });
  await prisma.planNode.updateMany({
    where: { id: node.id, status: "starting" },
    data: run ? { status: "running", runId: run.id, taskId: run.taskId ?? node.taskId } : { status: "pending", attempts: { decrement: 1 } }
  });
}

function handoffOf(run: Run): Handoff | null {
  if (run.status !== "completed") return null;
  return parseStoredHandoff(run.resultJson) ?? { ...handoffFromText(run.outputText), costCents: run.costCents };
}

async function onRunFinished(plan: PlanWithNodes, node: PlanNode, run: Run) {
  const handoff = handoffOf(run);
  if (!handoff || handoff.status !== "done") {
    const reason = handoff
      ? [`The owner reported "${handoff.status.replace("_", " ")}": ${handoff.summary}`, ...handoff.openQuestions.map((q) => `Open question: ${q}`)].join("\n")
      : run.status === "cancelled"
        ? "The step's run was cancelled."
        : `The step's run failed: ${run.errorMessage ?? "unknown error"}`;
    await failNode(node, reason, handoff);
    return;
  }

  await prisma.planNode.update({ where: { id: node.id }, data: { resultJson: json(handoff) } });
  if (!node.review) {
    await markDone(node, null);
    return;
  }
  try {
    const reviewRunId = await startReview(plan, node, handoff);
    await prisma.planNode.update({ where: { id: node.id }, data: { status: "reviewing", reviewRunId } });
  } catch (error) {
    // The Reviewer being unavailable must not hold up finished work; the founder sees that it was not reviewed.
    await markDone(node, { verdict: "skipped", summary: `Not reviewed: ${error instanceof Error ? error.message : String(error)}`, findings: [] });
  }
}

async function onReviewFinished(node: PlanNode, run: Run) {
  if (run.status !== "completed") {
    await markDone(node, { verdict: "skipped", summary: `The review did not finish: ${run.errorMessage ?? run.status}`, findings: [] });
    return;
  }
  const verdict = parseStoredHandoff(run.resultJson) ?? { ...handoffFromText(run.outputText), costCents: run.costCents };
  if (verdict.status === "done") {
    await markDone(node, { verdict: "pass", summary: verdict.summary, findings: verdict.findings });
    return;
  }
  const review = { verdict: "fail" as const, summary: verdict.summary, findings: verdict.findings };
  const feedback = [`The Reviewer rejected the result: ${verdict.summary}`, ...verdict.findings.map((f) => `- ${f}`)].join("\n");
  if (node.attempts < MAX_NODE_ATTEMPTS) {
    // One more attempt, with the Reviewer's feedback in the brief.
    await prisma.planNode.update({
      where: { id: node.id },
      data: { status: "pending", feedback, reviewJson: json(review), runId: null, reviewRunId: null }
    });
  } else {
    await prisma.planNode.update({ where: { id: node.id }, data: { reviewJson: json(review) } });
    await failNode(node, `${feedback}\n(This was attempt ${node.attempts} of ${MAX_NODE_ATTEMPTS}.)`);
  }
}

async function markDone(node: PlanNode, review: { verdict: "pass" | "skipped"; summary: string; findings: string[] } | null) {
  const now = new Date();
  await prisma.planNode.update({
    where: { id: node.id },
    data: { status: "done", finishedAt: now, feedback: null, ...(review ? { reviewJson: json(review) } : {}) }
  });
  if (node.taskId) await prisma.task.update({ where: { id: node.taskId }, data: { status: "completed", completedAt: now } });
}

async function failNode(node: PlanNode, reason: string, handoff: Handoff | null = null) {
  await prisma.planNode.update({
    where: { id: node.id },
    data: { status: "failed", feedback: reason.slice(0, 4000), finishedAt: new Date(), ...(handoff ? { resultJson: json(handoff) } : {}) }
  });
  if (node.taskId) await prisma.task.update({ where: { id: node.taskId }, data: { status: "blocked" } });
}

// ── Starting steps ────────────────────────────────────────────────────────────

async function startReadyNodes(plan: PlanWithNodes) {
  const statusByKey = new Map(plan.nodes.map((node) => [node.key, node.status]));
  const ready = plan.nodes
    .filter((node) => node.status === "pending")
    .filter((node) => parseKeys(node.dependsOnJson).every((dep) => SETTLED_NODE_STATUSES.has(statusByKey.get(dep) ?? "skipped")));
  for (const node of ready) await startNode(plan, node);
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

/** The brief a step's owner works from: the step, its criteria, what earlier steps produced and any feedback. */
export function stepBrief(plan: Pick<Plan, "goal">, node: PlanNode, inputs: Array<{ node: PlanNode; agentName: string }>): string {
  const criteria = parseKeys(node.acceptanceCriteriaJson);
  const inputLines = inputs.map(({ node: dep, agentName }) => {
    const result = parseStoredHandoff(dep.resultJson);
    if (!result) return `- ${dep.title} (${agentName}): ${dep.status}`;
    const artifacts = result.artifacts.map((a) => `${a.type}: ${a.title ? `${a.title} (${a.ref})` : a.ref}`);
    return [
      `- ${dep.title} (${agentName}): ${result.summary}`,
      artifacts.length ? `  Artifacts: ${artifacts.join("; ")}` : "",
      result.findings.length ? `  Findings: ${result.findings.join("; ")}` : ""
    ]
      .filter(Boolean)
      .join("\n");
  });
  return [
    `Objective: ${node.title}`,
    node.description ? `\n${node.description}` : "",
    criteria.length ? `\nAcceptance criteria:\n${bulletList(criteria)}` : "",
    inputLines.length ? `\nResults from earlier steps:\n${inputLines.join("\n")}` : "",
    node.feedback ? `\nFeedback on the previous attempt (address it):\n${node.feedback}` : "",
    `\nThis is one step of the plan for the founder's goal: ${plan.goal}`,
    "Planned by: Chief of Staff"
  ]
    .filter(Boolean)
    .join("\n");
}

async function agentNames(ids: Array<string | null>): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  const agents = await prisma.agent.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
  return new Map(agents.map((agent) => [agent.id, agent.name]));
}

async function startNode(plan: PlanWithNodes, node: PlanNode) {
  // Claim the step first, so two schedulers (or a retried job) never start it twice.
  const claimed = await prisma.planNode.updateMany({
    where: { id: node.id, status: "pending" },
    data: { status: "starting", attempts: { increment: 1 }, startedAt: new Date(), runId: null }
  });
  if (claimed.count !== 1) return;
  const attempt = node.attempts + 1;

  const owner = node.agentId
    ? await prisma.agent.findFirst({ where: { id: node.agentId, organizationId: plan.organizationId, archivedAt: null } })
    : null;
  if (!owner) {
    await failNode(node, "The step's owner no longer exists. Give it to another teammate.");
    return;
  }

  const deps = parseKeys(node.dependsOnJson);
  const depNodes = plan.nodes.filter((candidate) => deps.includes(candidate.key) && candidate.status === "done");
  const names = await agentNames(depNodes.map((dep) => dep.agentId));
  const brief = stepBrief(plan, { ...node, attempts: attempt }, depNodes.map((dep) => ({ node: dep, agentName: names.get(dep.agentId ?? "") ?? "agent" })));

  const existingTask = node.taskId ? await prisma.task.findUnique({ where: { id: node.taskId } }) : null;
  const task = existingTask
    ? await prisma.task.update({ where: { id: existingTask.id }, data: { status: "queued", description: brief, agentId: owner.id, departmentId: owner.departmentId, archivedAt: null } })
    : await prisma.task.create({
        data: {
          organizationId: plan.organizationId,
          departmentId: owner.departmentId,
          agentId: owner.id,
          roadmapItemId: plan.roadmapItemId,
          createdByUserId: plan.createdByUserId,
          title: node.title.slice(0, 80),
          description: brief,
          type: "agent_task",
          status: "queued",
          priority: 2,
          metadataJson: json({ source: "plan", planId: plan.id, nodeKey: node.key })
        }
      });
  await prisma.planNode.update({ where: { id: node.id }, data: { taskId: task.id } });

  let session;
  try {
    session = await startAgentRun({
      orgId: plan.organizationId,
      taskId: task.id,
      agentId: owner.id,
      message: brief,
      kind: "plan_node",
      planId: plan.id,
      planNodeId: node.id
    });
  } catch (error) {
    // Agents paused or the daily budget used up: nothing is wrong with the step itself. Try again later.
    const message = error instanceof Error ? error.message : String(error);
    await prisma.planNode.update({ where: { id: node.id }, data: { status: "pending", attempts: { decrement: 1 }, startedAt: null } });
    await prisma.task.update({ where: { id: task.id }, data: { status: "queued" } });
    await prisma.plan.update({ where: { id: plan.id }, data: { errorMessage: `Waiting to start "${node.title}": ${message}` } });
    await enqueuePlanAdvance(plan.id, { delayMs: RETRY_START_MS });
    return;
  }
  if (!session) {
    await failNode({ ...node, taskId: task.id }, "The step's run could not be started.");
    return;
  }
  const run = await getRunBySession(session.id);
  await prisma.planNode.update({ where: { id: node.id }, data: { status: "running", runId: run?.id ?? null } });
  if (plan.errorMessage) await prisma.plan.update({ where: { id: plan.id }, data: { errorMessage: null } });
}

// ── Review ────────────────────────────────────────────────────────────────────

async function startReview(plan: Plan, node: PlanNode, handoff: Handoff): Promise<string> {
  const reviewer = await ensureReviewer(plan.organizationId);
  const criteria = parseKeys(node.acceptanceCriteriaJson);
  const request = [
    `Review this step of the plan for: ${plan.goal}`,
    `\nStep: ${node.title}`,
    node.description ? `Brief:\n${node.description}` : "",
    `\nAcceptance criteria:\n${criteria.length ? bulletList(criteria) : "- (none given: judge against the brief)"}`,
    `\nWhat the owner handed back:\n${json({ status: handoff.status, summary: handoff.summary, artifacts: handoff.artifacts, findings: handoff.findings })}`,
    `\nThis is attempt ${node.attempts} of ${MAX_NODE_ATTEMPTS}. Call finish_run with status done (accepted) or failed (rejected, with what to fix).`
  ]
    .filter(Boolean)
    .join("\n");
  const now = new Date();
  // Reviews are conversations between agents, not work anyone needs in the task list (like consults).
  const task = await prisma.task.create({
    data: {
      organizationId: plan.organizationId,
      departmentId: reviewer.departmentId,
      agentId: reviewer.id,
      title: `Review: ${node.title}`.slice(0, 80),
      description: request,
      type: "agent_review",
      status: "queued",
      priority: 1,
      archivedAt: now,
      metadataJson: json({ source: "plan", planId: plan.id, nodeKey: node.key, review: true })
    }
  });
  const session = await startAgentRun({
    orgId: plan.organizationId,
    taskId: task.id,
    agentId: reviewer.id,
    message: request,
    kind: "review",
    planId: plan.id,
    planNodeId: node.id,
    includeArchived: true
  });
  if (!session) throw new Error("the Reviewer could not be started");
  const run = await getRunBySession(session.id);
  if (!run) throw new Error("the review run was not created");
  return run.id;
}

// ── Replanning ────────────────────────────────────────────────────────────────

function stepLine(node: PlanNode, owners: Map<string, string>): string {
  const result = parseStoredHandoff(node.resultJson);
  const deps = parseKeys(node.dependsOnJson);
  return [
    `- [${node.status}] ${node.key}: ${node.title} (owner ${owners.get(node.agentId ?? "") ?? "unassigned"})`,
    deps.length ? `  depends on: ${deps.join(", ")}` : "",
    result ? `  result: ${result.summary}` : "",
    node.feedback ? `  problem: ${node.feedback.replace(/\n/g, " ")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

async function ownerSlugs(nodes: PlanNode[]): Promise<Map<string, string>> {
  const ids = [...new Set(nodes.map((node) => node.agentId).filter((id): id is string => !!id))];
  const agents = await prisma.agent.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true } });
  return new Map(agents.map((agent) => [agent.id, agent.slug]));
}

async function replanOrWrapUp(plan: PlanWithNodes, failed: PlanNode[]) {
  if (plan.replanCount >= plan.maxReplans) {
    // Out of replans: let running work finish, then report what was and was not achieved.
    if (plan.nodes.some((node) => ACTIVE_NODE_STATUSES.has(node.status))) return;
    await beginReport(plan, "failed", `Stopped after ${plan.replanCount} replan${plan.replanCount === 1 ? "" : "s"}: ${failed.map((n) => n.title).join(", ")} could not be completed.`);
    return;
  }

  const moved = await prisma.plan.updateMany({
    where: { id: plan.id, status: "running" },
    data: { status: "replanning", replanCount: { increment: 1 } }
  });
  if (moved.count !== 1) return;

  const owners = await ownerSlugs(plan.nodes);
  const request = [
    `The founder's goal: ${plan.goal}`,
    plan.summary ? `\nCurrent plan: ${plan.summary}` : "",
    `\nSteps (status, key, title, owner slug):\n${plan.nodes.map((node) => stepLine(node, owners)).join("\n")}`,
    `\nThese steps failed:\n${failed.map((node) => `- ${node.key}: ${node.feedback ?? "no reason recorded"}`).join("\n")}`,
    `\nThis is replan ${plan.replanCount + 1} of ${plan.maxReplans}. Revise the plan with propose_plan, or ask the founder with ask_user if only they can unblock it.`
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await startChiefRun(plan, "plan", request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.plan.update({
      where: { id: plan.id },
      data: { status: "running", replanCount: { decrement: 1 }, errorMessage: `Waiting to replan: ${message}` }
    });
    await enqueuePlanAdvance(plan.id, { delayMs: RETRY_START_MS });
  }
}

/** A replanning run that ended without a revision hands the decision to the founder: the plan stops and reports. */
async function checkReplanning(plan: PlanWithNodes) {
  const run = await latestChiefRun(plan.id, "plan");
  if (run && !isSettled(run)) return;
  if (plan.nodes.some((node) => ACTIVE_NODE_STATUSES.has(node.status))) return;
  const why =
    run?.status === "completed"
      ? `The Chief of Staff did not find a way forward and handed the decision to you. ${run.outputText.trim()}`.trim()
      : `Replanning did not finish: ${run?.errorMessage ?? "the run is missing"}`;
  await beginReport(plan, "failed", why);
}

// ── Report ────────────────────────────────────────────────────────────────────

async function startChiefRun(plan: Plan, kind: "plan" | "plan_report", request: string) {
  const chief = await ensureOrchestrator(plan.organizationId);
  if (!plan.taskId) throw new Error("the plan has no task");
  await prisma.task.update({ where: { id: plan.taskId }, data: { status: "queued", archivedAt: null } });
  const session = await startAgentRun({ orgId: plan.organizationId, taskId: plan.taskId, agentId: chief.id, message: request, kind, planId: plan.id });
  if (!session) throw new Error("the Chief of Staff could not be started");
  return session;
}

/** A plain report from the plan's records, used when the Chief of Staff cannot write one. */
export function fallbackReport(plan: Pick<Plan, "goal" | "outcome" | "errorMessage">, nodes: PlanNode[], owners: Map<string, string>): string {
  const live = nodes.filter((node) => node.status !== "skipped");
  const done = live.filter((node) => node.status === "done");
  const lines = live.map((node) => {
    const result = parseStoredHandoff(node.resultJson);
    const detail = node.status === "done" ? (result?.summary ?? "done") : (node.feedback ?? node.status);
    return `- **${node.title}** (${owners.get(node.agentId ?? "") ?? "unassigned"}, ${node.status}): ${detail.replace(/\n/g, " ")}`;
  });
  return [
    `**Goal:** ${plan.goal}`,
    `**Outcome:** ${plan.outcome === "completed" ? "completed" : "not completed"}. ${done.length} of ${live.length} steps done.`,
    plan.errorMessage ? `**Why it stopped:** ${plan.errorMessage}` : "",
    "",
    ...lines
  ]
    .filter((line) => line !== null)
    .join("\n")
    .trim();
}

async function beginReport(plan: PlanWithNodes, outcome: "completed" | "failed", reason?: string) {
  const moved = await prisma.plan.updateMany({
    where: { id: plan.id, status: { in: ["running", "replanning"] } },
    data: { status: "reporting", outcome, ...(reason ? { errorMessage: reason } : {}) }
  });
  if (moved.count !== 1) return;

  const owners = await agentNames(plan.nodes.map((node) => node.agentId));
  const live = plan.nodes.filter((node) => node.status !== "skipped");
  const request = [
    `Write the founder's report for the goal: ${plan.goal}`,
    `\nOutcome: ${outcome === "completed" ? "every step is done" : "the plan stopped before the goal was reached"}.`,
    reason ? `Why it stopped: ${reason}` : "",
    `\nSteps:\n${live
      .map((node) => {
        const result = parseStoredHandoff(node.resultJson);
        return json({
          title: node.title,
          owner: owners.get(node.agentId ?? "") ?? null,
          status: node.status,
          summary: result?.summary ?? null,
          artifacts: result?.artifacts ?? [],
          nextSteps: result?.nextSteps ?? [],
          problem: node.status === "done" ? null : node.feedback,
          costCents: result ? Math.round(result.costCents * 100) / 100 : null
        });
      })
      .join("\n")}`
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await startChiefRun(plan, "plan_report", request);
  } catch {
    await finishPlan({ ...plan, outcome, errorMessage: reason ?? plan.errorMessage }, null);
  }
}

async function checkReport(plan: PlanWithNodes) {
  const run = await latestChiefRun(plan.id, "plan_report");
  if (run && !isSettled(run)) return;
  await finishPlan(plan, run?.status === "completed" && run.outputText.trim() ? run.outputText.trim() : null);
}

async function finishPlan(plan: PlanWithNodes, report: string | null) {
  const outcome = plan.outcome === "completed" ? "completed" : "failed";
  const reportText = report ?? fallbackReport({ ...plan, outcome }, plan.nodes, await agentNames(plan.nodes.map((node) => node.agentId)));
  const now = new Date();
  const finished = await prisma.plan.updateMany({
    where: { id: plan.id, status: { notIn: ["completed", "failed", "cancelled"] } },
    data: { status: outcome, outcome, reportText, finishedAt: now }
  });
  if (finished.count !== 1) return;
  await publishOrgEvent(plan.organizationId, "plan.finished", {
    text: `Plan ${outcome}: ${plan.goal.slice(0, 200)}`,
    path: `/org/${plan.organizationId}/canvas?plan=${plan.id}`,
    data: { planId: plan.id, goal: plan.goal, outcome, report: reportText.slice(0, 2000) }
  });
  if (plan.taskId) {
    await prisma.task.update({
      where: { id: plan.taskId },
      data: outcome === "completed" ? { status: "completed", completedAt: now } : { status: "blocked" }
    });
  }
  // Finishing the plan finishes the roadmap item it was launched for, and unlocks what depends on it.
  if (outcome === "completed" && plan.roadmapItemId) {
    await markRoadmapItemComplete(plan.organizationId, plan.roadmapItemId).catch((error) =>
      console.error(`[plans] could not complete roadmap item ${plan.roadmapItemId}:`, error)
    );
  }
}
