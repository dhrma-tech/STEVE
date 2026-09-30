import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { Prisma, Run } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { listen, notify as pgNotify } from "@/lib/db/notify";
import type { AgentEvent } from "../events";
import { isForwardedEvent } from "../events";
import { defaultLimits, RunBudget, type RunLimits } from "../policy/limits";
import { ACTIVE_STATUSES, isTerminalStatus, type RunState } from "./types";

export type { Run } from "@prisma/client";

export const newRunId = () => randomUUID();

// ── Reading and writing runs ──────────────────────────────────────────────────

export const getRun = (id: string) => prisma.run.findUnique({ where: { id } });
export const getRunBySession = (sessionId: string) => prisma.run.findUnique({ where: { sessionId } });

export async function updateRun(id: string, data: Prisma.RunUpdateInput) {
  return prisma.run.update({ where: { id }, data });
}

export function parseState(run: Pick<Run, "stateJson">): RunState | null {
  if (!run.stateJson) return null;
  try {
    return JSON.parse(run.stateJson) as RunState;
  } catch {
    return null;
  }
}

export async function saveState(runId: string, state: RunState, extra: Prisma.RunUpdateInput = {}) {
  return prisma.run.update({ where: { id: runId }, data: { stateJson: JSON.stringify(state), ...extra } });
}

export function parseChain(run: Pick<Run, "callChainJson">): string[] {
  try {
    const parsed = JSON.parse(run.callChainJson) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function createRun(data: {
  id?: string;
  organizationId: string;
  sessionId: string;
  taskId: string | null;
  agentId: string;
  requestText: string;
  mode: string;
  parent?: { run: Run; slotId: string };
  limits?: RunLimits;
}) {
  const id = data.id ?? newRunId();
  const parent = data.parent?.run ?? null;
  const callChain = [...(parent ? parseChain(parent) : []), data.agentId];
  return prisma.run.create({
    data: {
      id,
      organizationId: data.organizationId,
      sessionId: data.sessionId,
      taskId: data.taskId,
      agentId: data.agentId,
      parentRunId: parent?.id ?? null,
      parentSlotId: data.parent?.slotId ?? null,
      rootRunId: parent?.rootRunId ?? id,
      depth: parent ? parent.depth + 1 : 0,
      callChainJson: JSON.stringify(callChain),
      mode: data.mode,
      requestText: data.requestText,
      // Limits, grants and totals live on the root run only.
      ...(parent ? {} : { limitsJson: JSON.stringify(data.limits ?? defaultLimits()) })
    }
  });
}

// ── Tree budget and run-scoped approvals (stored on the root run) ─────────────

export function parseLimits(root: Pick<Run, "limitsJson">): RunLimits {
  if (!root.limitsJson) return defaultLimits();
  try {
    return { ...defaultLimits(), ...(JSON.parse(root.limitsJson) as Partial<RunLimits>) };
  } catch {
    return defaultLimits();
  }
}

export function budgetFromRoot(root: Run): RunBudget {
  return new RunBudget(parseLimits(root), {
    spentCents: root.spentCents,
    tokensIn: root.tokensIn,
    tokensOut: root.tokensOut,
    steps: root.steps,
    toolCalls: root.toolCalls
  });
}

/** Add what one step used to the tree totals. Safe when several workers do it at once. */
export async function flushBudget(rootRunId: string, budget: RunBudget) {
  const d = budget.takeDelta();
  if (!d.spentCents && !d.tokensIn && !d.tokensOut && !d.steps && !d.toolCalls) return;
  await prisma.run.update({
    where: { id: rootRunId },
    data: {
      spentCents: { increment: d.spentCents },
      tokensIn: { increment: d.tokensIn },
      tokensOut: { increment: d.tokensOut },
      steps: { increment: d.steps },
      toolCalls: { increment: d.toolCalls }
    }
  });
}

export function parseGrants(root: Pick<Run, "grantsJson">): Set<string> {
  try {
    const parsed = JSON.parse(root.grantsJson) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export async function addRunGrant(rootRunId: string, toolName: string) {
  await prisma.$transaction(async (tx) => {
    // Lock the root row: concurrent approvals would otherwise each read the old list and the last write would win.
    await tx.$executeRaw`SELECT 1 FROM "Run" WHERE "id" = ${rootRunId} FOR UPDATE`;
    const root = await tx.run.findUnique({ where: { id: rootRunId }, select: { grantsJson: true } });
    if (!root) return;
    const grants = parseGrants(root);
    grants.add(toolName);
    await tx.run.update({ where: { id: rootRunId }, data: { grantsJson: JSON.stringify([...grants]) } });
  });
}

// ── Event log ─────────────────────────────────────────────────────────────────

const g = globalThis as typeof globalThis & { _steveRunEvents?: EventEmitter };
const emitter: EventEmitter = (g._steveRunEvents ??= new EventEmitter().setMaxListeners(0));

/** Postgres NOTIFY channel carrying the id of a run that logged an event. */
const RUN_EVENTS_CHANNEL = "steve_run_events";

/**
 * Wake anything waiting on a run's events: events logged in this process call the listener directly, events
 * logged by another process (a standalone worker, another server) arrive through Postgres NOTIFY.
 */
export function onRunEvents(runId: string, listener: () => void): () => void {
  emitter.on(runId, listener);
  const unlisten = listen(RUN_EVENTS_CHANNEL, (payload) => {
    if (payload === runId) listener();
  });
  return () => {
    emitter.off(runId, listener);
    unlisten();
  };
}

function notify(runId: string) {
  emitter.emit(runId);
  void pgNotify(RUN_EVENTS_CHANNEL, runId);
}

export type StoredEvent = { seq: number; type: string; createdAt: Date; data: Record<string, unknown> };

/** Append one event to a run's log and return its sequence number. */
export async function appendEvent(runId: string, event: AgentEvent): Promise<number> {
  const { type, ...rest } = event;
  // One transaction: the increment locks the run row until the event row is committed, so events become visible
  // in sequence order and a reader resuming after seq N never skips an N+1 that was still being written.
  const eventSeq = await prisma.$transaction(async (tx) => {
    const { eventSeq: seq } = await tx.run.update({
      where: { id: runId },
      data: { eventSeq: { increment: 1 } },
      select: { eventSeq: true }
    });
    await tx.runEvent.create({ data: { runId, seq, type, payloadJson: JSON.stringify(rest) } });
    return seq;
  });
  notify(runId);
  return eventSeq;
}

/** Append to a run and, for events a person watching the whole tree must see, to each of its ancestors. */
export async function emitRunEvent(run: Pick<Run, "id" | "parentRunId">, event: AgentEvent) {
  await appendEvent(run.id, event);
  if (!isForwardedEvent(event)) return;
  let parentId = run.parentRunId;
  for (let hops = 0; parentId && hops < 10; hops++) {
    await appendEvent(parentId, event);
    const parent: { parentRunId: string | null } | null = await prisma.run.findUnique({
      where: { id: parentId },
      select: { parentRunId: true }
    });
    parentId = parent?.parentRunId ?? null;
  }
}

export async function listEvents(runId: string, afterSeq: number, limit = 200): Promise<StoredEvent[]> {
  const rows = await prisma.runEvent.findMany({
    where: { runId, seq: { gt: afterSeq } },
    orderBy: { seq: "asc" },
    take: limit
  });
  return rows.map((row) => {
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(row.payloadJson) as Record<string, unknown>;
    } catch {
      /* keep empty */
    }
    return { seq: row.seq, type: row.type, createdAt: row.createdAt, data };
  });
}

// ── Leases: one worker advances a run at a time ───────────────────────────────

export async function acquireRunLease(runId: string, workerId: string, ttlMs: number): Promise<boolean> {
  const now = new Date();
  const result = await prisma.run.updateMany({
    where: {
      id: runId,
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }, { lockedBy: workerId }]
    },
    data: { lockedBy: workerId, lockedUntil: new Date(now.getTime() + ttlMs) }
  });
  return result.count === 1;
}

export async function extendRunLease(runId: string, workerId: string, ttlMs: number) {
  await prisma.run.updateMany({
    where: { id: runId, lockedBy: workerId },
    data: { lockedUntil: new Date(Date.now() + ttlMs) }
  });
}

export async function releaseRunLease(runId: string, workerId: string) {
  await prisma.run.updateMany({ where: { id: runId, lockedBy: workerId }, data: { lockedBy: null, lockedUntil: null } });
}

// ── Tree helpers ──────────────────────────────────────────────────────────────

export async function activeDescendants(rootRunId: string, exceptRunId?: string) {
  return prisma.run.findMany({
    where: { rootRunId, status: { in: [...ACTIVE_STATUSES] }, ...(exceptRunId ? { id: { not: exceptRunId } } : {}) }
  });
}

/** Every unfinished run in a tree, plus a way to tell whether one run is done. */
export function isRunTerminal(run: Pick<Run, "status">): boolean {
  return isTerminalStatus(run.status);
}
