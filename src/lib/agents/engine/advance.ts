import { prisma } from "@/lib/db/client";
import { resolveModel } from "@/lib/ai/model-router";
import { ollamaChatSafe } from "@/lib/ai/ollama";
import type { AgentEvent } from "../events";
import { AgentsPausedError, assertAgentsNotPaused } from "../flags";
import { buildPrompt, loadOrgContext } from "../prompt";
import { LimitExceededError, type RunBudget } from "../policy/limits";
import { cancelPendingApprovals } from "../policy/approvals";
import { isOrgPaused } from "../policy/store";
import { delegationBlockReason, parsePermissionMode, stricterMode, type RunScope } from "../run-scope";
import { evaluateToolCall, finishUnapprovedCall, requestToolApproval, runToolCall, type Emit } from "../tool-executor";
import { buildToolset } from "../tools/registry";
import type { AgentTool, ToolContext } from "../tools/types";
import { finalizeRunRecords, recordTreeUsage, usageNote } from "./finalize";
import { compactMessages, initialMessages, runModelTurn, toolResultMessages, TransientModelError } from "./models";
import {
  acquireRunLease,
  activeDescendants,
  budgetFromRoot,
  emitRunEvent,
  extendRunLease,
  flushBudget,
  getRun,
  parseChain,
  parseGrants,
  parseState,
  releaseRunLease,
  saveState,
  type Run
} from "./run-store";
import { ACTIVE_STATUSES, isTerminalStatus, type AdvanceResult, type RunState, type Slot } from "./types";
import { enqueueAdvance } from "./wake";

/** Hard cap on model turns for one agent, on top of the run tree's step limit. */
const MAX_TURNS_PER_AGENT = 20;
const TEXT_FLUSH_MS = 250;
const LOW_RISK = new Set(["read", "write_internal"]);

// ── Entry point ───────────────────────────────────────────────────────────────

/**
 * Do the next unit of work for a run, if this worker can take it. Everything a step learns is written to the
 * database before it returns, so any worker (or this one after a restart) can carry on from there.
 */
export async function advanceRun(runId: string, options: { workerId: string; leaseMs?: number }): Promise<AdvanceResult> {
  const leaseMs = options.leaseMs ?? 60_000;
  if (!(await acquireRunLease(runId, options.workerId, leaseMs))) {
    return (await getRun(runId)) ? "busy" : "gone";
  }
  const beat = setInterval(() => void extendRunLease(runId, options.workerId, leaseMs), Math.max(1000, leaseMs / 3));
  beat.unref?.();
  try {
    return await step(runId);
  } finally {
    clearInterval(beat);
    await releaseRunLease(runId, options.workerId);
  }
}

/** Fail a run from outside a step (for example when its job ran out of retries). */
export async function failRunById(runId: string, message: string): Promise<void> {
  const run = await getRun(runId);
  if (!run || isTerminalStatus(run.status)) return;
  const root = run.id === run.rootRunId ? run : await getRun(run.rootRunId);
  if (!root) return;
  await failRun(run, root, new Error(message));
}

async function step(runId: string): Promise<AdvanceResult> {
  const run = await getRun(runId);
  if (!run) return "gone";
  if (isTerminalStatus(run.status)) return "finished";

  const root = run.id === run.rootRunId ? run : await getRun(run.rootRunId);
  if (!root) {
    await failRun(run, run, new Error("The run's root is missing."));
    return "finished";
  }
  const budget = budgetFromRoot(root);

  try {
    const result = await stepInner(run, root, budget);
    await flushBudget(root.id, budget);
    return result;
  } catch (error) {
    if (error instanceof TransientModelError) {
      await flushBudget(root.id, budget);
      throw error; // the job queue retries the step later
    }
    await flushBudget(root.id, budget);
    return failRun((await getRun(run.id)) ?? run, (await getRun(root.id)) ?? root, error);
  }
}

// ── One step ──────────────────────────────────────────────────────────────────

type StepContext = {
  run: Run;
  root: Run;
  budget: RunBudget;
  agent: NonNullable<Awaited<ReturnType<typeof loadAgent>>>;
  state: RunState;
  scope: RunScope;
  toolset: AgentTool[];
  toolCtx: ToolContext;
  emit: Emit;
};

async function loadAgent(agentId: string) {
  return prisma.agent.findUnique({ where: { id: agentId }, include: { department: true } });
}

async function stepInner(run: Run, root: Run, budget: RunBudget): Promise<AdvanceResult> {
  // A person may have cancelled the task or the run tree.
  const session = await prisma.taskSession.findUnique({ where: { id: run.sessionId }, select: { status: true } });
  if (session?.status === "canceled" || (root.id !== run.id && root.status === "cancelled")) {
    await cancelRun(run.id, "Cancelled.");
    return "finished";
  }

  assertAgentsNotPaused();
  budget.check();
  if (await isOrgPaused(run.organizationId, run.agentId)) {
    throw new AgentsPausedError("Agent execution is paused for this organization.");
  }

  if (run.status !== "running") {
    await setStatus(run.id, "running", { startedAt: run.startedAt ?? new Date() });
  }

  const agent = await loadAgent(run.agentId);
  if (!agent) throw new Error("Agent not found");

  let state = parseState(run);
  if (!state) {
    state = await prepareState(run, agent);
    await saveState(run.id, state);
  }

  const scope: RunScope = {
    tree: { rootRunId: root.id, rootSessionId: root.sessionId, budget, grants: parseGrants(root) },
    depth: run.depth,
    callChain: parseChain(run),
    mode: parsePermissionMode(run.mode)
  };
  const emit: Emit = async (event: AgentEvent) => {
    await emitRunEvent(run, event);
  };
  const ctx: StepContext = {
    run, root, budget, agent, state, scope, emit,
    toolset: buildToolset(state.skillKeys),
    toolCtx: { orgId: run.organizationId, agentId: run.agentId, sessionId: run.sessionId, skillKeys: state.skillKeys, scope }
  };

  return state.pending ? stepPending(ctx) : stepModelTurn(ctx);
}

/** Build the prompt and initial history from the task, the org's knowledge and the agent's memory. */
async function prepareState(run: Run, agent: NonNullable<Awaited<ReturnType<typeof loadAgent>>>): Promise<RunState> {
  const orgId = run.organizationId;
  const session = await prisma.taskSession.findUnique({
    where: { id: run.sessionId },
    include: {
      task: {
        include: {
          subtasks: { orderBy: { sortOrder: "asc" } },
          files: { where: { archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 8 }
        }
      }
    }
  });
  const task = session?.task ?? null;

  const [org, orgContext, memories] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    loadOrgContext(orgId),
    prisma.agentMemory.findMany({ where: { agentId: agent.id }, orderBy: { updatedAt: "desc" } })
  ]);

  let skillKeys: string[] = [];
  try {
    const cfg = JSON.parse(agent.toolsJson ?? "{}") as { skillKeys?: unknown };
    if (Array.isArray(cfg.skillKeys)) skillKeys = cfg.skillKeys.filter((k): k is string => typeof k === "string");
  } catch { /* ignore */ }

  let deptContext = "";
  try {
    const ctx = JSON.parse(agent.department.contextJson ?? "{}") as Record<string, unknown>;
    deptContext = Object.entries(ctx).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join("\n");
  } catch { /* ignore */ }

  const request = run.requestText;
  const { system: baseSystem, user } = buildPrompt({
    agentName: agent.name,
    orgName: org?.name ?? "your company",
    deptName: agent.department.name,
    deptSlug: agent.department.slug,
    deptContext,
    skillNames: skillKeys,
    taskTitle: task?.title ?? request.split(/\r?\n/)[0]?.slice(0, 80) ?? request.slice(0, 80),
    taskDescription: task?.description ?? null,
    subtasks: (task?.subtasks ?? []).map((s) => ({ title: s.title, status: s.status })),
    fileNames: (task?.files ?? []).map((f) => f.name),
    message: request,
    hasGithub: skillKeys.includes("github-repository"),
    hasVercel: skillKeys.includes("vercel-preview"),
    businessPlan: orgContext.businessPlan,
    brandKit: orgContext.brandKit
  });
  const system = memories.length > 0
    ? `${baseSystem}\n\n## Your Memory\n${memories.map((m) => `- ${m.key}: ${m.value}`).join("\n")}`
    : baseSystem;

  const model = resolveModel(agent.model);
  return {
    provider: model.provider,
    modelId: model.modelId,
    system,
    user,
    skillKeys,
    messages: model.provider === "ollama" ? [] : initialMessages(model.provider, system, user),
    pending: null
  };
}

// ── Model turn ────────────────────────────────────────────────────────────────

/** Batches streamed text into a few events per second instead of one write per token. */
class TextFlusher {
  private buffer = "";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();

  constructor(private emit: Emit) {}

  push(delta: string) {
    this.buffer += delta;
    if (!this.timer) this.timer = setTimeout(() => this.schedule(), TEXT_FLUSH_MS);
  }

  private schedule() {
    this.timer = null;
    const text = this.buffer;
    this.buffer = "";
    if (text) this.chain = this.chain.then(() => this.emit({ type: "text_delta", delta: text })).catch(() => undefined);
  }

  async flush() {
    if (this.timer) clearTimeout(this.timer);
    this.schedule();
    await this.chain;
  }
}

async function stepModelTurn(ctx: StepContext): Promise<AdvanceResult> {
  const { run, budget, state, emit } = ctx;

  if (run.turnCount >= MAX_TURNS_PER_AGENT) {
    return complete(ctx, run.outputText);
  }

  if (state.provider === "ollama") {
    const text = await ollamaChatSafe({ system: state.system, user: state.user });
    budget.recordModelTurn({ modelId: state.modelId, provider: "ollama" });
    await prisma.run.update({ where: { id: run.id }, data: { outputText: text, turnCount: { increment: 1 } } });
    return complete(ctx, text);
  }

  const apiKey = state.provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      state.provider === "anthropic"
        ? "ANTHROPIC_API_KEY is not set. Add it to .env.local, or switch this agent to the local model (Ollama, no tools)."
        : "OPENAI_API_KEY is not set. Add it to .env.local, or switch this agent to another model."
    );
  }

  state.messages = compactMessages(state.provider, state.messages);
  const flusher = new TextFlusher(emit);
  let turn;
  try {
    turn = await runModelTurn({
      provider: state.provider,
      modelId: state.modelId,
      apiKey,
      system: state.system,
      messages: state.messages,
      tools: ctx.toolset,
      onText: (delta) => flusher.push(delta)
    });
  } finally {
    await flusher.flush();
  }
  budget.recordModelTurn({
    modelId: state.modelId,
    provider: state.provider,
    inputTokens: turn.inputTokens,
    outputTokens: turn.outputTokens
  });

  state.messages.push(turn.assistantMessage);
  const outputText = run.outputText + turn.text;

  if (turn.toolCalls.length === 0) {
    state.pending = null;
    await saveState(run.id, state, { outputText, turnCount: { increment: 1 } });
    return complete(ctx, outputText);
  }

  state.pending = turn.toolCalls.map((call) => ({ id: call.id, name: call.name, input: call.input, status: "pending" as const }));
  await saveState(run.id, state, { outputText, turnCount: { increment: 1 } });
  return "more";
}

// ── Tool calls ────────────────────────────────────────────────────────────────

async function stepPending(ctx: StepContext): Promise<AdvanceResult> {
  const { run, state } = ctx;
  const outcome = await processSlots(ctx);

  if (outcome === "waiting_approval" || outcome === "waiting_children") {
    await setStatus(run.id, outcome, { updatedAt: new Date() });
    return "waiting";
  }

  // Every call of this turn has an outcome: hand the results back and let the model continue.
  const slots = state.pending ?? [];
  state.messages.push(...toolResultMessages(state.provider, slots.map((s) => ({ id: s.id, output: s.output ?? "" }))));
  state.pending = null;
  await saveState(run.id, state);
  return "more";
}

async function processSlots(ctx: StepContext): Promise<"waiting_approval" | "waiting_children" | "done"> {
  const slots = ctx.state.pending ?? [];
  let waitingApproval = false;

  for (const slot of slots) {
    if (slot.status === "done") continue;

    if (slot.status === "waiting_child") {
      await pollChild(ctx, slot);
      continue;
    }

    if (slot.status === "waiting_approval") {
      const approval = slot.approvalId ? await prisma.approval.findUnique({ where: { id: slot.approvalId } }) : null;
      if (approval && approval.status === "pending") {
        waitingApproval = true;
        break;
      }
      if (approval && approval.status === "approved") {
        slot.approved = true;
        slot.status = "pending";
      } else {
        const status = approval?.status === "denied" ? "denied" : approval?.status === "cancelled" ? "cancelled" : "expired";
        const result = await finishUnapprovedCall({
          toolName: slot.name, toolInput: slot.input, actionId: slot.actionId ?? null,
          approvalId: slot.approvalId ?? "", status, emit: ctx.emit
        });
        settle(slot, result);
        await saveState(ctx.run.id, ctx.state);
        continue;
      }
    }

    if (slot.status === "executing") {
      // A worker stopped in the middle of this call. Safe calls are simply run again; for anything with an outside
      // effect nobody knows whether it happened, so it is reported instead of repeated.
      if (slot.risk && LOW_RISK.has(slot.risk)) {
        slot.status = "pending";
      } else {
        settle(slot, {
          output: "This call was interrupted by a restart, and it is not known whether it completed. Check the result before trying it again.",
          success: false
        });
        await saveState(ctx.run.id, ctx.state);
        continue;
      }
    }

    if (slot.name === "delegate_agent") {
      await startChild(ctx, slot);
      await saveState(ctx.run.id, ctx.state);
      continue;
    }

    if (await runSlot(ctx, slot)) {
      waitingApproval = true;
      break;
    }
  }

  if (waitingApproval) return "waiting_approval";
  if (slots.some((s) => s.status === "waiting_child")) return "waiting_children";
  return "done";
}

function settle(slot: Slot, result: { output: string; success: boolean }) {
  slot.status = "done";
  slot.output = result.output;
  slot.success = result.success;
}

/** Run one tool call. Returns true when it now needs a human's approval and the run must wait. */
async function runSlot(ctx: StepContext, slot: Slot): Promise<boolean> {
  const { run, toolset, toolCtx, emit } = ctx;

  if (!slot.approved) {
    const evaluation = await evaluateToolCall({
      toolName: slot.name, toolInput: slot.input, toolset, ctx: toolCtx, counted: !!slot.counted, emit
    });
    slot.counted = true;

    if (evaluation.kind === "result") {
      settle(slot, evaluation.result);
      await saveState(run.id, ctx.state);
      return false;
    }
    if (evaluation.kind === "ask") {
      const { approvalId, actionId } = await requestToolApproval({
        toolName: slot.name, toolInput: slot.input, ctx: toolCtx, taskId: run.taskId,
        risk: evaluation.risk, reason: evaluation.reason, summary: evaluation.summary, emit
      });
      slot.status = "waiting_approval";
      slot.approvalId = approvalId;
      slot.actionId = actionId;
      slot.risk = evaluation.risk;
      await saveState(run.id, ctx.state);
      return true;
    }
    slot.risk = evaluation.risk;
    slot.idempotencyKey = evaluation.idempotencyKey;
  }

  const tool = toolset.find((t) => t.definition.name === slot.name);
  if (!tool) {
    settle(slot, { output: `Unknown tool: ${slot.name}`, success: false });
    await saveState(run.id, ctx.state);
    return false;
  }

  slot.status = "executing";
  await saveState(run.id, ctx.state);
  const result = await runToolCall({
    toolName: slot.name, toolInput: slot.input, tool, ctx: toolCtx,
    risk: slot.risk ?? "external_write",
    idempotencyKey: slot.idempotencyKey ?? null,
    actionId: slot.actionId ?? null,
    approvalId: slot.approvalId ?? null,
    emit
  });
  slot.actionId = result.actionId;
  settle(slot, result);
  await saveState(run.id, ctx.state);
  return false;
}

// ── Delegation ────────────────────────────────────────────────────────────────

async function startChild(ctx: StepContext, slot: Slot) {
  const { run, scope, emit } = ctx;
  if (!slot.counted) {
    scope.tree.budget.recordToolCall(); // throws LimitExceededError at the limit
    slot.counted = true;
  }

  const agentSlug = typeof slot.input.agentSlug === "string" ? slot.input.agentSlug : "";
  const task = typeof slot.input.task === "string" ? slot.input.task : "";
  if (!agentSlug || !task) return settle(slot, { output: "Error: agentSlug and task are required", success: false });

  const child = await prisma.agent.findFirst({ where: { organizationId: run.organizationId, slug: agentSlug, archivedAt: null } });
  if (!child) return settle(slot, { output: `Error: no agent with slug "${agentSlug}" found in this org`, success: false });

  // Loops and runaway depth are refused before anything is created; the reason goes back to the model.
  const blocked = delegationBlockReason(scope, child.id);
  if (blocked) return settle(slot, { output: `Error: cannot delegate to "${agentSlug}". ${blocked}`, success: false });

  let childRun = await prisma.run.findUnique({ where: { parentRunId_parentSlotId: { parentRunId: run.id, parentSlotId: slot.id } } });
  let created = false;
  if (!childRun) {
    let childOwnMode = parsePermissionMode(undefined);
    try {
      childOwnMode = parsePermissionMode((JSON.parse(child.permissionsJson ?? "{}") as { mode?: unknown }).mode);
    } catch { /* ignore */ }
    const mode = stricterMode(scope.mode, childOwnMode);
    const now = new Date();

    childRun = await prisma.$transaction(async (tx) => {
      const childTask = await tx.task.create({
        data: {
          organizationId: run.organizationId,
          departmentId: child.departmentId,
          agentId: child.id,
          title: task.split(/\r?\n/)[0]?.slice(0, 80) ?? task.slice(0, 80),
          description: task,
          type: "agent_task",
          status: "running",
          priority: 1,
          startedAt: now
        }
      });
      const childSession = await tx.taskSession.create({
        data: {
          organizationId: run.organizationId,
          taskId: childTask.id,
          agentId: child.id,
          parentSessionId: run.sessionId,
          status: "running",
          startedAt: now,
          scratchpad: `# ${child.name} — Running\n\n**Delegated from session:** ${run.sessionId}`
        }
      });
      const id = crypto.randomUUID();
      return tx.run.create({
        data: {
          id,
          organizationId: run.organizationId,
          sessionId: childSession.id,
          taskId: childTask.id,
          agentId: child.id,
          parentRunId: run.id,
          parentSlotId: slot.id,
          rootRunId: run.rootRunId,
          depth: run.depth + 1,
          callChainJson: JSON.stringify([...scope.callChain, child.id]),
          mode,
          requestText: task
        }
      });
    });
    created = true;
    await prisma.agent.updateMany({ where: { id: child.id }, data: { status: "running" } });
  }

  slot.status = "waiting_child";
  slot.childRunId = childRun.id;
  slot.childAgentSlug = agentSlug;
  if (created) {
    await emit({ type: "delegate_start", childAgentSlug: agentSlug, childSessionId: childRun.sessionId });
  }
  await enqueueAdvance(childRun.id);
}

async function pollChild(ctx: StepContext, slot: Slot) {
  const child = slot.childRunId ? await getRun(slot.childRunId) : null;
  const slug = slot.childAgentSlug ?? "agent";
  if (!child) return settle(slot, { output: `Agent "${slug}" could not be found.`, success: false });
  if (!isTerminalStatus(child.status)) return;

  let output: string;
  let success = false;
  if (child.status === "completed") {
    output = child.outputText || `Agent "${slug}" completed with no output.`;
    success = true;
  } else if (child.status === "cancelled") {
    output = `Agent "${slug}" was cancelled.`;
  } else {
    output = `Agent "${slug}" did not finish: ${child.errorMessage ?? "unknown error"}${child.outputText ? `\nPartial output:\n${child.outputText}` : ""}`;
  }
  settle(slot, { output, success });
  await ctx.emit({ type: "delegate_done", childAgentSlug: slug, output: child.outputText });
  await saveState(ctx.run.id, ctx.state);
}

// ── Finishing ─────────────────────────────────────────────────────────────────

/** Set a run's status unless it has already reached a final state (for example, it was cancelled meanwhile). */
async function setStatus(runId: string, status: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  const result = await prisma.run.updateMany({
    where: { id: runId, status: { notIn: ["completed", "failed", "cancelled"] } },
    data: { status, ...extra }
  });
  return result.count === 1;
}

async function agentName(agentId: string): Promise<string> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { name: true } });
  return agent?.name ?? "Agent";
}

async function complete(ctx: StepContext, output: string): Promise<AdvanceResult> {
  const { run, root, budget, emit } = ctx;
  await flushBudget(root.id, budget);
  if (!(await setStatus(run.id, "completed", { finishedAt: new Date() }))) return "finished";
  await emit({ type: "done", output });
  await closeOut(run, root, { outcome: "completed", output, errorMessage: null });
  return "finished";
}

async function failRun(run: Run, root: Run, error: unknown): Promise<AdvanceResult> {
  const message = error instanceof Error ? error.message : String(error);
  const current = (await getRun(run.id)) ?? run;
  if (!(await setStatus(run.id, "failed", { errorMessage: message, finishedAt: new Date() }))) return "finished";
  if (error instanceof LimitExceededError) {
    await emitRunEvent(current, { type: "limit_reached", limit: error.limit, message: error.message });
  }
  await emitRunEvent(current, { type: "error", message: `Agent run failed: ${message}` });
  // Nothing under a failed run should keep going.
  await cancelDescendants(run);
  await closeOut(current, root, { outcome: "failed", output: current.outputText, errorMessage: message });
  return "finished";
}

/** The records people see, usage for a finished tree, and waking whoever was waiting on this run. */
async function closeOut(run: Run, root: Run, result: { outcome: "completed" | "failed"; output: string; errorMessage: string | null }) {
  const fresh = (await getRun(run.id)) ?? run;
  const isRoot = run.id === run.rootRunId;
  const rootFresh = isRoot ? fresh : ((await getRun(root.id)) ?? root);
  const totals = budgetFromRoot(rootFresh);

  await finalizeRunRecords({
    run: fresh,
    agentName: await agentName(run.agentId),
    outcome: result.outcome,
    output: result.output,
    errorMessage: result.errorMessage,
    usage: isRoot ? usageNote(totals) : null
  });
  if (isRoot) await recordTreeUsage(rootFresh, totals);
  if (run.parentRunId) await enqueueAdvance(run.parentRunId);
}

/** Cancel a run and everything it delegated to. Safe to call more than once. */
export async function cancelRun(runId: string, reason = "Cancelled by a user."): Promise<void> {
  const run = await getRun(runId);
  if (!run || isTerminalStatus(run.status)) return;
  if (!(await setStatus(run.id, "cancelled", { errorMessage: reason, finishedAt: new Date() }))) return;
  await emitRunEvent(run, { type: "error", message: reason });
  await cancelDescendants(run);
  await cancelPendingApprovals([run.sessionId]);
  await finalizeRunRecords({
    run: (await getRun(run.id)) ?? run,
    agentName: await agentName(run.agentId),
    outcome: "cancelled",
    output: run.outputText,
    errorMessage: reason,
    usage: null
  });
  if (run.parentRunId) await enqueueAdvance(run.parentRunId);
}

async function cancelDescendants(run: Run) {
  const active = await activeDescendants(run.rootRunId, run.id);
  const byId = new Map(active.map((r) => [r.id, r]));
  // A run belongs under `run` if following its parent links reaches `run`.
  const isDescendant = (candidate: Run) => {
    let parentId = candidate.parentRunId;
    for (let hops = 0; parentId && hops < 10; hops++) {
      if (parentId === run.id) return true;
      parentId = byId.get(parentId)?.parentRunId ?? null;
    }
    return false;
  };
  for (const child of active.filter(isDescendant)) {
    await cancelRun(child.id, "Cancelled because the run that started it stopped.");
  }
}

/** Cancel every unfinished run started for a task (used when the task itself is cancelled). */
export async function cancelRunsForTask(taskId: string, reason = "The task was cancelled."): Promise<void> {
  const runs = await prisma.run.findMany({ where: { taskId, status: { in: [...ACTIVE_STATUSES] } } });
  for (const run of runs) await cancelRun(run.id, reason);
}
