import { prisma } from "@/lib/db/client";

/**
 * Run health for Mission Control (orchestration plan, Phase 8): success rate, durations, cost per run, approval wait
 * time, replan rate, model fallbacks and suspected prompt injections, plus a table of recent runs.
 *
 * Everything is computed from rows the engine already writes (Run, RunEvent, Approval, Plan), so there is no metrics
 * pipeline to run. The window is bounded and the row reads are capped, which keeps this cheap enough to poll.
 */

const MAX_RUNS = 5000;
const MAX_USAGE_EVENTS = 20000;
const RECENT_LIMIT = 50;

export type Percentiles = { p50: number | null; p95: number | null };

export type ModelCost = { modelId: string; turns: number; costCents: number; inputTokens: number; outputTokens: number; cacheReadTokens: number };

export type RecentRun = {
  runId: string;
  rootRunId: string;
  agentName: string;
  kind: string;
  status: string;
  costCents: number;
  durationMs: number | null;
  steps: number;
  toolCalls: number;
  tokensIn: number;
  tokensOut: number;
  createdAt: string;
  errorMessage: string | null;
};

export type RunHealth = {
  windowDays: number;
  since: string;
  runs: {
    total: number;
    /** Runs started by a person or a plan (depth 0); delegated and consult runs are counted under their root. */
    roots: number;
    byStatus: Record<string, number>;
    /** completed / (completed + failed), over finished root runs; null when none finished. */
    successRate: number | null;
    durationMs: Percentiles;
  };
  cost: {
    totalCents: number;
    perRootRunCents: number | null;
    byModel: ModelCost[];
    /** Share of input tokens served from the prompt cache. */
    cacheHitRate: number | null;
  };
  approvals: { decided: number; pending: number; waitMs: Percentiles };
  plans: { total: number; replanned: number; replanRate: number | null };
  safety: { injectionsSuspected: number; fallbackTurns: number; limitStops: number };
  recent: RecentRun[];
};

/** Nearest-rank percentile of `values` (unsorted). */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1];
}

const percentiles = (values: number[]): Percentiles => ({ p50: percentile(values, 50), p95: percentile(values, 95) });

function parse(json: string): Record<string, unknown> {
  try {
    const value = JSON.parse(json) as unknown;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/** Sum per-turn usage records into cost by model, and count turns a fallback model answered. */
export function summarizeUsage(payloads: Array<Record<string, unknown>>): { byModel: ModelCost[]; fallbackTurns: number; cacheHitRate: number | null } {
  const byModel = new Map<string, ModelCost>();
  let fallbackTurns = 0;
  let freshInput = 0;
  let cachedInput = 0;
  for (const usage of payloads) {
    const modelId = typeof usage.modelId === "string" ? usage.modelId : "unknown";
    const entry = byModel.get(modelId) ?? { modelId, turns: 0, costCents: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
    entry.turns += 1;
    entry.costCents += num(usage.costCents);
    entry.inputTokens += num(usage.inputTokens);
    entry.outputTokens += num(usage.outputTokens);
    entry.cacheReadTokens += num(usage.cacheReadTokens);
    byModel.set(modelId, entry);
    if (typeof usage.requestedModelId === "string" && usage.requestedModelId !== modelId) fallbackTurns += 1;
    freshInput += num(usage.inputTokens) + num(usage.cacheWriteTokens);
    cachedInput += num(usage.cacheReadTokens);
  }
  const totalInput = freshInput + cachedInput;
  return {
    byModel: [...byModel.values()].sort((a, b) => b.costCents - a.costCents),
    fallbackTurns,
    cacheHitRate: totalInput > 0 ? cachedInput / totalInput : null
  };
}

export async function getRunHealth(orgId: string, windowDays = 7): Promise<RunHealth> {
  const days = Math.min(90, Math.max(1, Math.round(windowDays)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [runs, usageEvents, safetyEvents, approvals, plans] = await Promise.all([
    prisma.run.findMany({
      where: { organizationId: orgId, createdAt: { gte: since } },
      select: {
        id: true, rootRunId: true, agentId: true, depth: true, kind: true, status: true, costCents: true, steps: true,
        toolCalls: true, tokensIn: true, tokensOut: true, createdAt: true, startedAt: true, finishedAt: true, errorMessage: true
      },
      orderBy: { createdAt: "desc" },
      take: MAX_RUNS
    }),
    prisma.runEvent.findMany({
      where: { type: "model_usage", createdAt: { gte: since }, run: { organizationId: orgId } },
      select: { payloadJson: true },
      orderBy: { createdAt: "desc" },
      take: MAX_USAGE_EVENTS
    }),
    prisma.runEvent.groupBy({
      by: ["type"],
      where: { type: { in: ["injection_suspected", "limit_reached"] }, createdAt: { gte: since }, run: { organizationId: orgId } },
      _count: { _all: true }
    }),
    prisma.approval.findMany({
      where: { organizationId: orgId, createdAt: { gte: since } },
      select: { status: true, createdAt: true, reviewedAt: true }
    }),
    prisma.plan.findMany({ where: { organizationId: orgId, createdAt: { gte: since } }, select: { replanCount: true } })
  ]);

  const byStatus: Record<string, number> = {};
  for (const run of runs) byStatus[run.status] = (byStatus[run.status] ?? 0) + 1;

  const roots = runs.filter((run) => run.depth === 0);
  const completedRoots = roots.filter((run) => run.status === "completed").length;
  const failedRoots = roots.filter((run) => run.status === "failed").length;
  const durationOf = (run: (typeof runs)[number]) =>
    run.finishedAt ? run.finishedAt.getTime() - (run.startedAt ?? run.createdAt).getTime() : null;
  const rootDurations = roots.map(durationOf).filter((ms): ms is number => ms !== null && ms >= 0);
  // A root run's costCents already includes everything under it.
  const rootCost = roots.reduce((sum, run) => sum + run.costCents, 0);

  const usage = summarizeUsage(usageEvents.map((event) => parse(event.payloadJson)));

  const decided = approvals.filter((a) => a.reviewedAt && a.status !== "pending");
  const counts = Object.fromEntries(safetyEvents.map((group) => [group.type, group._count._all]));

  const agentIds = [...new Set(runs.slice(0, RECENT_LIMIT).map((run) => run.agentId))];
  const agents = await prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } });
  const agentName = new Map(agents.map((agent) => [agent.id, agent.name]));

  return {
    windowDays: days,
    since: since.toISOString(),
    runs: {
      total: runs.length,
      roots: roots.length,
      byStatus,
      successRate: completedRoots + failedRoots > 0 ? completedRoots / (completedRoots + failedRoots) : null,
      durationMs: percentiles(rootDurations)
    },
    cost: {
      totalCents: rootCost,
      perRootRunCents: roots.length > 0 ? rootCost / roots.length : null,
      byModel: usage.byModel,
      cacheHitRate: usage.cacheHitRate
    },
    approvals: {
      decided: decided.length,
      pending: approvals.filter((a) => a.status === "pending").length,
      waitMs: percentiles(decided.map((a) => a.reviewedAt!.getTime() - a.createdAt.getTime()).filter((ms) => ms >= 0))
    },
    plans: {
      total: plans.length,
      replanned: plans.filter((plan) => plan.replanCount > 0).length,
      replanRate: plans.length > 0 ? plans.filter((plan) => plan.replanCount > 0).length / plans.length : null
    },
    safety: {
      injectionsSuspected: counts.injection_suspected ?? 0,
      fallbackTurns: usage.fallbackTurns,
      limitStops: counts.limit_reached ?? 0
    },
    recent: runs.slice(0, RECENT_LIMIT).map((run) => ({
      runId: run.id,
      rootRunId: run.rootRunId,
      agentName: agentName.get(run.agentId) ?? "Agent",
      kind: run.kind,
      status: run.status,
      costCents: run.costCents,
      durationMs: durationOf(run),
      steps: run.steps,
      toolCalls: run.toolCalls,
      tokensIn: run.tokensIn,
      tokensOut: run.tokensOut,
      createdAt: run.createdAt.toISOString(),
      errorMessage: run.errorMessage
    }))
  };
}
