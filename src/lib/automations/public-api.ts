import { z } from "zod";
import type { Run } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { listEvents } from "@/lib/agents/engine/run-store";
import { getPlan } from "@/lib/agents/plans/store";
import { startWork, StartWorkError } from "./start-work";
import type { ApiAuth } from "./api-keys";

/**
 * The public API behind /api/v1 (orchestration plan, Phase 9): start work, read a run's status and its event log.
 * Route handlers stay thin; everything here takes an authenticated org and plain input, so it is testable as is.
 */

export const startRunSchema = z.union([
  z.object({
    /** An agent's slug (e.g. "engineering-default") or id. */
    agent: z.string().trim().min(1).max(120),
    instruction: z.string().trim().min(3).max(8000),
    title: z.string().trim().max(80).optional()
  }),
  z.object({
    goal: z.string().trim().min(3).max(1000),
    context: z.string().trim().max(4000).optional()
  })
]);

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; code: "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT"; message: string };

export function serializeRun(run: Run) {
  let result: unknown = null;
  try {
    result = run.resultJson ? JSON.parse(run.resultJson) : null;
  } catch {
    result = null;
  }
  return {
    id: run.id,
    sessionId: run.sessionId,
    taskId: run.taskId,
    agentId: run.agentId,
    kind: run.kind,
    status: run.status,
    planId: run.planId,
    output: run.outputText,
    result,
    error: run.errorMessage,
    costCents: run.costCents,
    steps: run.steps,
    toolCalls: run.toolCalls,
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null
  };
}

export async function apiStartRun(auth: ApiAuth, body: unknown) {
  const parsed = startRunSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 422, code: "VALIDATION_ERROR", message: "Send either { agent, instruction } or { goal }." } as const;
  }
  try {
    if ("goal" in parsed.data) {
      const started = await startWork({
        orgId: auth.orgId,
        target: "goal",
        instruction: parsed.data.goal,
        context: parsed.data.context ?? null,
        origin: { source: "api", refId: auth.keyId }
      });
      if (started.kind !== "plan") throw new Error("unexpected");
      return { ok: true, status: 201, data: { plan: await getPlan(auth.orgId, started.planId), sessionId: started.sessionId } } as const;
    }
    const ref = parsed.data.agent;
    const agent = await prisma.agent.findFirst({
      where: { organizationId: auth.orgId, OR: [{ id: ref }, { slug: ref }], status: { not: "archived" } },
      select: { id: true }
    });
    if (!agent) return { ok: false, status: 404, code: "NOT_FOUND", message: `No agent "${ref}" in this workspace.` } as const;
    const started = await startWork({
      orgId: auth.orgId,
      target: "agent",
      agentId: agent.id,
      instruction: parsed.data.instruction,
      title: parsed.data.title,
      origin: { source: "api", refId: auth.keyId }
    });
    const run = await prisma.run.findUnique({ where: { sessionId: started.sessionId } });
    return { ok: true, status: 201, data: { run: run ? serializeRun(run) : null, sessionId: started.sessionId } } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof StartWorkError || /paused|budget/i.test(message)) return { ok: false, status: 409, code: "CONFLICT", message } as const;
    throw error;
  }
}

export async function apiGetRun(auth: ApiAuth, runId: string) {
  const run = await prisma.run.findFirst({ where: { id: runId, organizationId: auth.orgId } });
  if (!run) return { ok: false, status: 404, code: "NOT_FOUND", message: "Run not found." } as const;
  const children = await prisma.run.findMany({
    where: { rootRunId: run.rootRunId, parentRunId: run.id },
    select: { id: true, agentId: true, kind: true, status: true },
    orderBy: { createdAt: "asc" }
  });
  return { ok: true, status: 200, data: { run: serializeRun(run), children } } as const;
}

export async function apiListRuns(auth: ApiAuth, options: { limit?: number; status?: string | null }) {
  const runs = await prisma.run.findMany({
    where: { organizationId: auth.orgId, depth: 0, ...(options.status ? { status: options.status } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, options.limit ?? 20))
  });
  return { ok: true, status: 200, data: { runs: runs.map(serializeRun) } } as const;
}

/** A page of a run's event log after sequence number `after`; poll with the last `seq` you saw. */
export async function apiRunEvents(auth: ApiAuth, runId: string, after: number, limit = 200) {
  const run = await prisma.run.findFirst({ where: { id: runId, organizationId: auth.orgId }, select: { id: true, status: true } });
  if (!run) return { ok: false, status: 404, code: "NOT_FOUND", message: "Run not found." } as const;
  const events = await listEvents(run.id, Math.max(0, after), Math.min(500, Math.max(1, limit)));
  return {
    ok: true,
    status: 200,
    data: { runStatus: run.status, events: events.map((e) => ({ seq: e.seq, type: e.type, data: e.data, createdAt: e.createdAt })) }
  } as const;
}

export async function apiGetPlan(auth: ApiAuth, planId: string) {
  const plan = await getPlan(auth.orgId, planId);
  if (!plan) return { ok: false, status: 404, code: "NOT_FOUND", message: "Plan not found." } as const;
  return { ok: true, status: 200, data: { plan } } as const;
}
