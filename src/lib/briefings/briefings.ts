import type { Briefing, Run } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { startAgentRun } from "@/lib/agents/run-service";
import { ensureOrchestrator } from "@/lib/agents/plans/system-agents";
import { getRunBySession } from "@/lib/agents/engine/run-store";
import { emailBriefing } from "@/lib/notifications/email";

/**
 * Briefings: what shipped, what is blocked, what needs the founder and what it cost. The facts come from the records;
 * the Chief of Staff writes them up. If it cannot (no model key, an error), the briefing is built from the facts
 * alone, so the founder always gets one.
 */

export type BriefingPeriod = "daily" | "weekly" | "manual";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A briefing still being written after this long gets the records-only version. */
const WRITING_TIMEOUT_MS = 20 * 60 * 1000;
/** Orgs with no activity in this long get no daily briefing (nothing to say). */
const QUIET_ORG_MS = 7 * DAY_MS;

export function briefingHour(env: NodeJS.ProcessEnv = process.env): number {
  const hour = Number(env.BRIEFING_HOUR);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 8;
}

// ── Facts ─────────────────────────────────────────────────────────────────────

export async function briefingFacts(orgId: string, since: Date, until: Date) {
  const window = { gte: since, lt: until };
  const [completedTasks, blockedTasks, failedRuns, completedRuns, plansDone, plansStopped, plansRunning, approvals, questions, plansToReview, memoriesToReview, usage] =
    await Promise.all([
      prisma.task.findMany({
        where: { organizationId: orgId, status: "completed", completedAt: window, archivedAt: null },
        select: { title: true, agent: { select: { name: true } } },
        orderBy: { completedAt: "desc" },
        take: 15
      }),
      prisma.task.findMany({
        where: { organizationId: orgId, status: "blocked", archivedAt: null },
        select: { title: true, agent: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 10
      }),
      prisma.run.findMany({
        where: { organizationId: orgId, status: "failed", finishedAt: window, parentRunId: null },
        select: { errorMessage: true, agentId: true, requestText: true },
        take: 10
      }),
      prisma.run.count({ where: { organizationId: orgId, status: "completed", finishedAt: window } }),
      prisma.plan.findMany({ where: { organizationId: orgId, status: "completed", finishedAt: window }, select: { goal: true } }),
      prisma.plan.findMany({ where: { organizationId: orgId, status: "failed", finishedAt: window }, select: { goal: true, errorMessage: true } }),
      prisma.plan.findMany({ where: { organizationId: orgId, status: { in: ["running", "replanning", "reporting"] } }, select: { goal: true } }),
      prisma.approval.findMany({
        where: { organizationId: orgId, status: "pending", kind: "tool" },
        select: { description: true, title: true },
        take: 10
      }),
      prisma.approval.findMany({ where: { organizationId: orgId, status: "pending", kind: "question" }, select: { title: true }, take: 10 }),
      prisma.plan.findMany({ where: { organizationId: orgId, status: "proposed" }, select: { goal: true } }),
      prisma.orgMemory.count({ where: { organizationId: orgId, status: "proposed" } }),
      prisma.usageRecord.findMany({ where: { organizationId: orgId, category: "tokens", occurredAt: window }, select: { costCents: true } })
    ]);
  const agentNames = new Map(
    (await prisma.agent.findMany({ where: { id: { in: failedRuns.map((run) => run.agentId) } }, select: { id: true, name: true } })).map((a) => [a.id, a.name])
  );

  return {
    since: since.toISOString(),
    until: until.toISOString(),
    shipped: {
      tasks: completedTasks.map((task) => ({ title: task.title, agent: task.agent?.name ?? null })),
      plans: plansDone.map((plan) => plan.goal),
      runsCompleted: completedRuns
    },
    blocked: {
      tasks: blockedTasks.map((task) => ({ title: task.title, agent: task.agent?.name ?? null })),
      failedRuns: failedRuns.map((run) => ({
        agent: agentNames.get(run.agentId) ?? "Agent",
        request: run.requestText.split(/\r?\n/)[0]!.slice(0, 120),
        error: (run.errorMessage ?? "").slice(0, 200)
      })),
      plansStopped: plansStopped.map((plan) => ({ goal: plan.goal, why: plan.errorMessage })),
      plansRunning: plansRunning.map((plan) => plan.goal)
    },
    needsYou: {
      approvals: approvals.map((approval) => approval.description ?? approval.title),
      questions: questions.map((question) => question.title),
      plansToReview: plansToReview.map((plan) => plan.goal),
      memoriesToReview
    },
    spend: { cents: usage.reduce((sum, row) => sum + row.costCents, 0) }
  };
}

export type BriefingFacts = Awaited<ReturnType<typeof briefingFacts>>;

const list = (items: string[], empty: string) => (items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${empty}`);

/** The briefing from the facts alone. */
export function renderFallbackBriefing(facts: BriefingFacts): string {
  const needs = [
    ...facts.needsYou.approvals.map((a) => `Approve: ${a}`),
    ...facts.needsYou.questions.map((q) => `Answer: ${q}`),
    ...facts.needsYou.plansToReview.map((p) => `Review the plan: ${p}`),
    ...(facts.needsYou.memoriesToReview ? [`Review ${facts.needsYou.memoriesToReview} proposed memor${facts.needsYou.memoriesToReview === 1 ? "y" : "ies"}`] : [])
  ];
  const lead = needs.length
    ? `${needs.length} thing${needs.length === 1 ? "" : "s"} need${needs.length === 1 ? "s" : ""} you.`
    : facts.shipped.tasks.length || facts.shipped.plans.length
      ? "Work shipped and nothing is waiting on you."
      : "A quiet period: nothing shipped and nothing is waiting on you.";
  return [
    lead,
    "",
    "**Shipped**",
    list([...facts.shipped.plans.map((p) => `Plan done: ${p}`), ...facts.shipped.tasks.map((t) => `${t.title}${t.agent ? ` (${t.agent})` : ""}`)], "Nothing finished."),
    "",
    "**Blocked**",
    list(
      [
        ...facts.blocked.plansStopped.map((p) => `Plan stopped: ${p.goal}${p.why ? ` — ${p.why}` : ""}`),
        ...facts.blocked.failedRuns.map((r) => `${r.agent} failed: ${r.request}${r.error ? ` — ${r.error}` : ""}`),
        ...facts.blocked.tasks.map((t) => `${t.title}${t.agent ? ` (${t.agent})` : ""}`)
      ],
      "Nothing blocked."
    ),
    "",
    "**Needs you**",
    list(needs, "Nothing."),
    "",
    "**Spend**",
    `- About ${Math.round(facts.spend.cents)}¢ on agent work.`
  ].join("\n");
}

// ── Creating and finishing ────────────────────────────────────────────────────

function windowFor(period: BriefingPeriod, now: Date): { start: Date; end: Date; key: Date } {
  const end = new Date(now);
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  if (period === "daily") return { start: new Date(end.getTime() - DAY_MS), end, key: day };
  if (period === "weekly") return { start: new Date(end.getTime() - 7 * DAY_MS), end, key: day };
  return { start: new Date(end.getTime() - DAY_MS), end, key: end };
}

async function finish(briefing: Pick<Briefing, "id" | "organizationId" | "period" | "dataJson">, text: string | null) {
  const facts = JSON.parse(briefing.dataJson) as BriefingFacts;
  const final = text?.trim() || renderFallbackBriefing(facts);
  const updated = await prisma.briefing.updateMany({ where: { id: briefing.id, status: "writing" }, data: { status: "ready", text: final } });
  if (updated.count !== 1) return;
  const sent = await emailBriefing({ id: briefing.id, organizationId: briefing.organizationId, text: final, period: briefing.period }).catch(() => 0);
  if (sent > 0) await prisma.briefing.update({ where: { id: briefing.id }, data: { emailedAt: new Date() } });
}

/**
 * Create a briefing for an org. Daily and weekly briefings are made once per day (a second call returns the first);
 * manual ones whenever asked. The Chief of Staff writes it; without a model it is built from the facts.
 */
export async function createBriefing(orgId: string, period: BriefingPeriod, now = new Date()): Promise<Briefing> {
  const { start, end, key } = windowFor(period, now);
  const existing = await prisma.briefing.findUnique({ where: { organizationId_period_periodStart: { organizationId: orgId, period, periodStart: key } } });
  if (existing) return existing;

  const facts = await briefingFacts(orgId, start, end);
  let briefing: Briefing;
  try {
    briefing = await prisma.briefing.create({
      data: { organizationId: orgId, period, periodStart: key, periodEnd: end, dataJson: JSON.stringify(facts) }
    });
  } catch {
    // Another worker created it at the same moment.
    return prisma.briefing.findUniqueOrThrow({ where: { organizationId_period_periodStart: { organizationId: orgId, period, periodStart: key } } });
  }

  try {
    const chief = await ensureOrchestrator(orgId);
    const task = await prisma.task.create({
      data: {
        organizationId: orgId,
        departmentId: chief.departmentId,
        agentId: chief.id,
        title: `${period === "weekly" ? "Weekly" : "Daily"} briefing`,
        description: "The Chief of Staff's briefing for the founder.",
        type: "agent_briefing",
        status: "queued",
        archivedAt: now,
        metadataJson: JSON.stringify({ source: "briefing", briefingId: briefing.id })
      }
    });
    const request = [
      `Write the founder's ${period} briefing for ${start.toDateString()} to ${end.toDateString()} from these facts:`,
      JSON.stringify(facts, null, 1)
    ].join("\n\n");
    const session = await startAgentRun({ orgId, taskId: task.id, agentId: chief.id, message: request, kind: "briefing", includeArchived: true });
    const run = session ? await getRunBySession(session.id) : null;
    if (!run) throw new Error("the Chief of Staff could not be started");
    return prisma.briefing.update({ where: { id: briefing.id }, data: { runId: run.id } });
  } catch {
    await finish(briefing, null);
    return prisma.briefing.findUniqueOrThrow({ where: { id: briefing.id } });
  }
}

/** Called at a briefing run's close-out: keep what the Chief of Staff wrote, or fall back to the facts. */
export async function finishBriefingForRun(run: Pick<Run, "id" | "kind" | "status" | "outputText">) {
  if (run.kind !== "briefing") return;
  const briefing = await prisma.briefing.findFirst({ where: { runId: run.id } });
  if (!briefing) return;
  await finish(briefing, run.status === "completed" ? run.outputText : null);
}

/**
 * Housekeeping from the worker's sweep: give each active org its daily briefing once the briefing hour has passed,
 * and finish briefings whose writer never came back.
 */
export async function ensureDailyBriefings(now = new Date()): Promise<number> {
  const stuck = await prisma.briefing.findMany({ where: { status: "writing", createdAt: { lt: new Date(now.getTime() - WRITING_TIMEOUT_MS) } }, take: 20 });
  for (const briefing of stuck) await finish(briefing, null);

  if (process.env.DAILY_BRIEFINGS === "off" || now.getHours() < briefingHour()) return 0;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const active = await prisma.organization.findMany({
    where: {
      status: "active",
      deletedAt: null,
      runs: { some: { createdAt: { gte: new Date(now.getTime() - QUIET_ORG_MS) } } },
      briefings: { none: { period: "daily", periodStart: today } }
    },
    select: { id: true },
    take: 20
  });
  for (const org of active) await createBriefing(org.id, "daily", now).catch((error) => console.error(`[briefings] ${org.id}:`, error));
  return active.length;
}

export async function listBriefings(orgId: string, take = 14) {
  const rows = await prisma.briefing.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take });
  const runs = await prisma.run.findMany({
    where: { id: { in: rows.map((row) => row.runId).filter((id): id is string => !!id) } },
    select: { id: true, status: true }
  });
  const runStatus = new Map(runs.map((run) => [run.id, run.status]));
  return rows.map((row) => ({
    id: row.id,
    period: row.period,
    status: row.status,
    text: row.text,
    facts: JSON.parse(row.dataJson) as BriefingFacts,
    periodEnd: row.periodEnd.toISOString(),
    emailedAt: row.emailedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    // Written by the Chief of Staff only when its run finished; otherwise it is the records-only version.
    byChiefOfStaff: !!row.runId && runStatus.get(row.runId) === "completed"
  }));
}
