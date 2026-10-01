import { prisma } from "@/lib/db/client";
import { resolveRunModel } from "@/lib/ai/model-router";
import { bindsThinkingToConversation } from "@/lib/ai/model-tiers";
import { log, reportError } from "@/lib/observability/log";
import { UNTRUSTED_DATA_RULE } from "../policy/injection";
import { publishOrgEvent } from "@/lib/automations/channels";
import { ollamaChatSafe } from "@/lib/ai/ollama";
import type { AgentEvent } from "../events";
import { AgentsPausedError, assertAgentsNotPaused } from "../flags";
import { buildPrompt, loadOrgContext } from "../prompt";
import { LimitExceededError, type RunBudget } from "../policy/limits";
import { approvalTimeoutMs, cancelPendingApprovals, createQuestion } from "../policy/approvals";
import { collaborationGuide, loadDirectory, renderDirectory } from "../directory";
import { isOrgPaused } from "../policy/store";
import { delegationBlockReason, parsePermissionMode, stricterMode, type RunScope } from "../run-scope";
import { evaluateToolCall, finishUnapprovedCall, requestToolApproval, runToolCall, type Emit } from "../tool-executor";
import { buildToolset } from "../tools/registry";
import { recordProposedPlan } from "../plans/proposal";
import { planRunSystemPrompt, PLAN_PROMPT_KINDS } from "../plans/prompts";
import { isSystemAgentSlug } from "../plans/system-agents";
import { enqueuePlanAdvance } from "../plans/wake";
import { captureRunLearning } from "@/lib/memory/learning";
import { finishBriefingForRun } from "@/lib/briefings/briefings";
import { rankMemories, renderMemorySection, scopesFor, visibleMemories } from "@/lib/memory/store";
import type { AgentTool, ToolContext } from "../tools/types";
import { finalizeRunRecords, recordTreeUsage, usageNote } from "./finalize";
import {
  handoffForParent,
  handoffFromText,
  parseHandoffInput,
  parseStoredHandoff,
  renderHandoff,
  type Handoff,
  type HandoffInput
} from "./handoff";
import { compactMessages, initialMessages, ModelRefusalError, runModelTurn, toolResultMessages, TransientModelError } from "./models";
import {
  acquireRunLease,
  activeDescendants,
  addRunCost,
  assertWithinBudgetCaps,
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
import { ACTIVE_STATUSES, isTerminalStatus, type AdvanceResult, type RunState, type Slot, type SlotChild } from "./types";
import { enqueueAdvance } from "./wake";

/** Hard cap on model turns for one agent, on top of the run tree's step limit. */
const MAX_TURNS_PER_AGENT = 20;
const TEXT_FLUSH_MS = 250;
const LOW_RISK = new Set(["read", "write_internal"]);

/**
 * Runs that must end with a particular tool call: work handed over by another agent (or by the plan) ends with a
 * structured handoff, the Reviewer ends with its verdict, and planning ends with a plan.
 */
function requiredEnding(kind: string): "finish_run" | "propose_plan" | null {
  if (kind === "delegation" || kind === "plan_node" || kind === "review") return "finish_run";
  if (kind === "plan") return "propose_plan";
  return null;
}

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
  await assertWithinBudgetCaps(run);
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
    // Work started by an outside event (a webhook trigger) carries outside text in its instruction: tainted from the start.
    const origin = run.taskId ? await prisma.task.findUnique({ where: { id: run.taskId }, select: { metadataJson: true } }) : null;
    const untrusted = untrustedOrigin(origin?.metadataJson ?? null);
    if (untrusted) state.injectionSuspected = untrusted;
    // A brief from a run that read injection-shaped content may carry it along: the child starts tainted too.
    if (run.parentRunId) {
      const parent = await prisma.run.findUnique({ where: { id: run.parentRunId }, select: { stateJson: true } });
      const inherited = parent ? parseState(parent)?.injectionSuspected : null;
      if (inherited) state.injectionSuspected = inherited;
    }
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
    toolset: buildToolset(state.skillKeys, { kind: run.kind }),
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

  const memoryScopes = scopesFor({ id: agent.id, departmentSlug: agent.department.slug });
  const [org, orgContext, memories, directory] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    loadOrgContext(orgId),
    visibleMemories(orgId, memoryScopes),
    loadDirectory(orgId)
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
  const model = resolveRunModel({ agentModel: agent.model, agentTier: agent.modelTier, kind: run.kind });
  // Only the memories that matter for this request, bounded in count and size (company, department, own notes).
  const memorySection = renderMemorySection(rankMemories(memories, `${task?.title ?? ""}\n${request}`, memoryScopes), {
    departmentName: agent.department.name,
    scopes: memoryScopes
  });

  // The Chief of Staff and the Reviewer steer the team instead of doing department work: their own prompts.
  if (PLAN_PROMPT_KINDS.has(run.kind)) {
    const plan = run.planId ? await prisma.plan.findUnique({ where: { id: run.planId }, select: { status: true } }) : null;
    const system = [
      planRunSystemPrompt({
        kind: run.kind,
        agentName: agent.name,
        orgName: org?.name ?? "your company",
        replanning: plan?.status === "replanning",
        businessPlan: orgContext.businessPlan,
        brandKit: orgContext.brandKit,
        team: renderDirectory(directory, agent.id)
      }),
      memorySection,
      UNTRUSTED_DATA_RULE
    ]
      .filter(Boolean)
      .join("\n\n");
    return {
      provider: model.provider,
      modelId: model.modelId,
      tier: model.tier,
      effort: model.effort,
      fallbackModelId: model.fallbackModelId,
      system,
      user: request,
      skillKeys,
      messages: model.provider === "ollama" ? [] : initialMessages(model.provider, system, request),
      pending: null
    };
  }

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
    // A delegated brief or a question is already the task description; repeating it as a note adds nothing.
    message: run.kind === "task" ? request : null,
    hasGithub: skillKeys.includes("github-repository"),
    hasVercel: skillKeys.includes("vercel-preview"),
    businessPlan: orgContext.businessPlan,
    brandKit: orgContext.brandKit
  });
  const sections = [baseSystem];
  if (memorySection) sections.push(memorySection);
  if (run.kind === "consult") {
    sections.push(
      "## A teammate's question\n" +
        "Another agent on your team is asking you a question in your area. Answer it directly and concisely from what you " +
        "know. You have read-only tools only: you cannot change anything, delegate or contact anyone. Say so if you do not know."
    );
  } else {
    const team = renderDirectory(directory, agent.id);
    if (team) sections.push(team);
    sections.push(collaborationGuide({ mustHandOff: requiredEnding(run.kind) === "finish_run" }));
  }
  sections.push(UNTRUSTED_DATA_RULE);
  const system = sections.join("\n\n");

  return {
    provider: model.provider,
    modelId: model.modelId,
    tier: model.tier,
    effort: model.effort,
    fallbackModelId: model.fallbackModelId,
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
    await addRunCost(run, budget.recordModelTurn({ modelId: state.modelId, provider: "ollama" }));
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

  // Models that bind thinking to the conversation need an append-only history: their old tool output is cleared
  // server-side (see models.ts). Others are trimmed here when the history grows long.
  if (!(state.provider === "anthropic" && bindsThinkingToConversation(state.modelId))) {
    state.messages = compactMessages(state.provider, state.messages);
  }
  const flusher = new TextFlusher(emit);
  const started = Date.now();
  let turn;
  try {
    turn = await runModelTurn({
      provider: state.provider,
      modelId: state.modelId,
      apiKey,
      system: state.system,
      messages: state.messages,
      tools: ctx.toolset,
      onText: (delta) => flusher.push(delta),
      effort: state.effort ?? null,
      fallbackModelId: state.fallbackModelId ?? null
    });
  } finally {
    await flusher.flush();
  }
  // Priced as the model that actually answered (a fallback after an outage or a refusal costs what it costs).
  const servedModelId = turn.servedModelId ?? state.modelId;
  const cost = budget.recordModelTurn({
    modelId: servedModelId,
    provider: state.provider,
    inputTokens: turn.inputTokens,
    outputTokens: turn.outputTokens,
    cacheReadTokens: turn.cacheReadTokens,
    cacheWriteTokens: turn.cacheWriteTokens
  });
  await addRunCost(run, cost);
  // One usage record per model turn: cost per run, per agent and (divided by the calls it made) per tool call.
  await emit({
    type: "model_usage",
    modelId: servedModelId,
    requestedModelId: state.modelId,
    tier: state.tier ?? null,
    inputTokens: turn.inputTokens,
    outputTokens: turn.outputTokens,
    cacheReadTokens: turn.cacheReadTokens ?? 0,
    cacheWriteTokens: turn.cacheWriteTokens ?? 0,
    costCents: Math.round(cost * 10_000) / 10_000,
    toolCalls: turn.toolCalls.map((call) => call.name),
    latencyMs: Date.now() - started
  });
  log.info("model turn", {
    runId: run.id,
    sessionId: run.sessionId,
    orgId: run.organizationId,
    model: servedModelId,
    costCents: cost,
    toolCalls: turn.toolCalls.length,
    latencyMs: Date.now() - started
  });

  state.messages.push(turn.assistantMessage);
  const outputText = run.outputText + turn.text;

  if (turn.toolCalls.length === 0) {
    state.pending = null;
    // Delegated work must end with a structured handoff, and planning with a plan. Ask once; after that, delegated
    // work's text is wrapped so the parent still gets a handoff, and the scheduler reports a plan that never came.
    const ending = requiredEnding(run.kind);
    if (ending && !state.nudgedToFinish && run.turnCount + 1 < MAX_TURNS_PER_AGENT) {
      state.nudgedToFinish = true;
      state.messages.push({
        role: "user",
        content:
          ending === "propose_plan"
            ? "You ended without calling propose_plan. Record the plan now with propose_plan (a summary and the steps), " +
              "or ask the founder with ask_user if the goal is too unclear to plan."
            : "You ended without calling finish_run. The agent that delegated this work needs a structured handoff: call " +
              "finish_run now with your status, a short summary, artifacts, findings and next steps."
      });
      await saveState(run.id, state, { outputText, turnCount: { increment: 1 } });
      return "more";
    }
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
  // finish_run was called: the run ends here instead of asking the model for another turn.
  if (state.finish) return complete(ctx, run.outputText);
  return "more";
}

async function processSlots(ctx: StepContext): Promise<"waiting_approval" | "waiting_children" | "done"> {
  const slots = ctx.state.pending ?? [];
  let waitingApproval = false;

  for (const slot of slots) {
    if (slot.status === "done") continue;

    if (slot.status === "waiting_child") {
      await pollChildren(ctx, slot);
      continue;
    }

    if (slot.status === "waiting_approval") {
      const approval = slot.approvalId ? await prisma.approval.findUnique({ where: { id: slot.approvalId } }) : null;
      if (approval && approval.status === "pending") {
        waitingApproval = true;
        break;
      }
      if (approval?.kind === "question") {
        const answered = approval.status === "approved";
        settle(slot, {
          output: answered
            ? `The founder answered: ${approval.responseText ?? ""}`
            : "The founder did not answer in time. Continue with your best judgment and say what you assumed, or stop and report that you need this answer.",
          success: answered
        });
        await ctx.emit({ type: "question_answered", approvalId: approval.id, answer: approval.responseText ?? null, status: approval.status });
        await saveState(ctx.run.id, ctx.state);
        continue;
      }
      if (approval && approval.status === "approved") {
        slot.approved = true;
        slot.status = "pending";
        // Edit & approve: the person approved changed arguments, so the call runs with exactly those.
        const edited = parseEditedInput(approval.editedPayloadJson);
        if (edited) {
          slot.input = edited;
          await ctx.emit({ type: "tool_call", tool: slot.name, input: edited });
        }
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

    if (slot.name === "delegate_agent" || slot.name === "delegate_many" || slot.name === "ask_agent") {
      await startChildren(ctx, slot);
      await saveState(ctx.run.id, ctx.state);
      continue;
    }

    if (slot.name === "ask_user") {
      const waiting = await askUser(ctx, slot);
      await saveState(ctx.run.id, ctx.state);
      if (waiting) {
        waitingApproval = true;
        break;
      }
      continue;
    }

    if (slot.name === "propose_plan") {
      if (!slot.counted) {
        ctx.scope.tree.budget.recordToolCall();
        slot.counted = true;
      }
      const result =
        ctx.run.kind === "plan"
          ? await recordProposedPlan(ctx.run, slot.input)
          : ({ ok: false, error: "Error: only the Chief of Staff's planning run can propose a plan." } as const);
      if (result.ok) {
        // Proposing the plan ends the planning run, like finish_run.
        ctx.state.finish = { status: "done", summary: result.summary, artifacts: [], findings: [], nextSteps: [], openQuestions: [] };
        settle(slot, { output: result.message, success: true });
      } else {
        settle(slot, { output: result.error, success: false });
      }
      await saveState(ctx.run.id, ctx.state);
      continue;
    }

    if (slot.name === "finish_run") {
      const parsed = parseHandoffInput(slot.input);
      if (parsed.ok) {
        ctx.state.finish = parsed.handoff;
        settle(slot, { output: "Handoff recorded. Your run ends after this turn's other calls finish.", success: true });
      } else {
        settle(slot, { output: parsed.error, success: false });
      }
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

function parseEditedInput(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
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
      toolName: slot.name, toolInput: slot.input, toolset, ctx: toolCtx, counted: !!slot.counted, emit,
      tainted: !!ctx.state.injectionSuspected
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
  if (result.injection && !ctx.state.injectionSuspected) {
    // From here on this run gets no pre-approved outside actions (see policy/engine.ts).
    ctx.state.injectionSuspected = { tool: slot.name, excerpt: result.injection.excerpt };
    log.warn("prompt injection suspected", { runId: run.id, sessionId: run.sessionId, orgId: run.organizationId, tool: slot.name, pattern: result.injection.pattern });
  }
  settle(slot, result);
  await saveState(run.id, ctx.state);
  return false;
}

// ── Delegation, consults and questions ────────────────────────────────────────

type Brief = {
  agentSlug: string;
  objective: string;
  context?: string;
  constraints?: string;
  acceptanceCriteria?: string[];
  deadline?: string;
  budgetCents?: number;
};

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function readBrief(input: Record<string, unknown>): Brief | string {
  const agentSlug = str(input.agentSlug);
  // `task` is the field name from before the typed protocol.
  const objective = str(input.objective) || str(input.task);
  if (!agentSlug || !objective) return "agentSlug and objective are required";
  const criteria = Array.isArray(input.acceptanceCriteria)
    ? input.acceptanceCriteria.map(str).filter(Boolean)
    : str(input.acceptanceCriteria)
      ? [str(input.acceptanceCriteria)]
      : [];
  const budget = Number(input.budgetCents);
  return {
    agentSlug,
    objective,
    context: str(input.context) || undefined,
    constraints: str(input.constraints) || undefined,
    acceptanceCriteria: criteria.length ? criteria : undefined,
    deadline: str(input.deadline) || undefined,
    budgetCents: Number.isFinite(budget) && budget > 0 ? budget : undefined
  };
}

/** The briefs one call asks for: one for delegate_agent and ask_agent, several for delegate_many. */
function briefsOf(slot: Slot): Array<Brief | string> {
  if (slot.name === "ask_agent") {
    const agentSlug = str(slot.input.agentSlug);
    const question = str(slot.input.question);
    return [agentSlug && question ? { agentSlug, objective: question } : "agentSlug and question are required"];
  }
  if (slot.name === "delegate_many") {
    const list = Array.isArray(slot.input.delegations) ? slot.input.delegations : [];
    if (list.length === 0) return ["delegations must list at least one teammate"];
    return list
      .slice(0, 8)
      .map((item) => (item && typeof item === "object" ? readBrief(item as Record<string, unknown>) : "each delegation must be an object"));
  }
  return [readBrief(slot.input)];
}

function briefText(brief: Brief, fromAgent: string): string {
  return [
    `Objective: ${brief.objective}`,
    brief.context ? `\nContext:\n${brief.context}` : "",
    brief.constraints ? `\nConstraints:\n${brief.constraints}` : "",
    brief.acceptanceCriteria?.length ? `\nAcceptance criteria:\n${brief.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}` : "",
    brief.deadline ? `\nDeadline: ${brief.deadline}` : "",
    `\nDelegated by: ${fromAgent}`
  ]
    .filter(Boolean)
    .join("\n");
}

/** A consult is a small, read-only exchange; it never gets more than this, whatever the parent's budget. */
const CONSULT_CAP_CENTS = 25;
const CHILD_TOOLS = new Set(["delegate_agent", "delegate_many", "ask_agent"]);

/**
 * What each new child of this turn may spend. The parent's remaining budget (its own share, or the whole tree's)
 * is split equally among every teammate it starts in this turn; an explicit request can only lower a share.
 */
function childBudgetCaps(ctx: StepContext, briefs: Brief[], consult: boolean): number[] {
  const { run, budget } = ctx;
  const remaining =
    run.budgetCapCents !== null
      ? Math.max(0, run.budgetCapCents - run.costCents)
      : Math.max(0, budget.limits.budgetCents - budget.spentCents);
  const childrenInTurn = (ctx.state.pending ?? []).reduce((count, slot) => {
    if (!CHILD_TOOLS.has(slot.name)) return count;
    const many = slot.name === "delegate_many" && Array.isArray(slot.input.delegations);
    return count + (many ? Math.min(8, (slot.input.delegations as unknown[]).length) : 1);
  }, 0);
  const share = remaining / Math.max(1, childrenInTurn, briefs.length);
  return briefs.map((brief) => {
    const cap = brief.budgetCents !== undefined ? Math.min(brief.budgetCents, share) : share;
    return consult ? Math.min(cap, CONSULT_CAP_CENTS) : cap;
  });
}

async function startChildren(ctx: StepContext, slot: Slot) {
  const { run, scope, emit } = ctx;
  if (!slot.counted) {
    scope.tree.budget.recordToolCall(); // throws LimitExceededError at the limit
    slot.counted = true;
  }

  const consult = slot.name === "ask_agent";
  const parsed = briefsOf(slot);
  const caps = childBudgetCaps(ctx, parsed.filter((b): b is Brief => typeof b !== "string"), consult);
  const self = ctx.agent;
  const children: SlotChild[] = [];
  let validIndex = 0;

  for (let i = 0; i < parsed.length; i++) {
    const brief = parsed[i];
    if (typeof brief === "string") {
      children.push({ agentSlug: "?", result: `Error: ${brief}`, success: false });
      continue;
    }
    const cap = caps[validIndex++];
    const refuse = (reason: string) => children.push({ agentSlug: brief.agentSlug, result: `Error: ${reason}`, success: false });

    const child = await prisma.agent.findFirst({ where: { organizationId: run.organizationId, slug: brief.agentSlug, archivedAt: null } });
    if (!child) {
      refuse(`no agent with slug "${brief.agentSlug}" in this organization. Check Your team for the right slug.`);
      continue;
    }
    if (isSystemAgentSlug(child.slug)) {
      refuse(`"${brief.agentSlug}" coordinates the team and does not take delegated work. Pick a teammate from Your team.`);
      continue;
    }
    // Loops and runaway depth are refused before anything is created; the reason goes back to the model.
    const blocked = delegationBlockReason(scope, child.id);
    if (blocked) {
      refuse(`cannot ${consult ? "ask" : "delegate to"} "${brief.agentSlug}". ${blocked}`);
      continue;
    }

    // One child per (parent run, call, position): a retried step finds the child it already created.
    const parentSlotId = parsed.length === 1 ? slot.id : `${slot.id}#${i}`;
    let childRun = await prisma.run.findUnique({ where: { parentRunId_parentSlotId: { parentRunId: run.id, parentSlotId } } });
    let created = false;
    if (!childRun) {
      if (cap <= 0) {
        refuse("there is no budget left to hand out. Finish this part yourself.");
        continue;
      }
      let childOwnMode = parsePermissionMode(undefined);
      try {
        childOwnMode = parsePermissionMode((JSON.parse(child.permissionsJson ?? "{}") as { mode?: unknown }).mode);
      } catch {
        /* ignore */
      }
      const mode = stricterMode(scope.mode, childOwnMode);
      const now = new Date();
      const request = consult ? `Question from ${self.name}: ${brief.objective}` : briefText(brief, self.name);
      const due = brief.deadline && !Number.isNaN(Date.parse(brief.deadline)) ? new Date(brief.deadline) : null;

      childRun = await prisma.$transaction(async (tx) => {
        const childTask = await tx.task.create({
          data: {
            organizationId: run.organizationId,
            departmentId: child.departmentId,
            agentId: child.id,
            title: (consult ? `Question from ${self.name}` : (brief.objective.split(/\r?\n/)[0] ?? brief.objective)).slice(0, 80),
            description: request,
            type: consult ? "agent_consult" : "agent_task",
            status: "running",
            priority: 1,
            startedAt: now,
            dueAt: due,
            // A consult is a conversation between agents, not work anyone needs in the task list.
            archivedAt: consult ? now : null
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
            scratchpad: `# ${child.name} — Running\n\n**${consult ? "Asked" : "Delegated"} by:** ${self.name} (session ${run.sessionId})`
          }
        });
        return tx.run.create({
          data: {
            id: crypto.randomUUID(),
            organizationId: run.organizationId,
            sessionId: childSession.id,
            taskId: childTask.id,
            agentId: child.id,
            parentRunId: run.id,
            parentSlotId,
            rootRunId: run.rootRunId,
            depth: run.depth + 1,
            callChainJson: JSON.stringify([...scope.callChain, child.id]),
            mode,
            kind: consult ? "consult" : "delegation",
            budgetCapCents: cap,
            requestText: request
          }
        });
      });
      created = true;
      await prisma.agent.updateMany({ where: { id: child.id }, data: { status: "running" } });
    }

    children.push({ agentSlug: brief.agentSlug, runId: childRun.id });
    if (created) {
      await emit({
        type: "delegate_start",
        childAgentSlug: brief.agentSlug,
        childSessionId: childRun.sessionId,
        kind: consult ? "consult" : "delegation",
        objective: brief.objective.slice(0, 300)
      });
    }
    await enqueueAdvance(childRun.id);
  }

  slot.children = children;
  if (children.some((c) => c.runId && c.result === undefined)) {
    slot.status = "waiting_child";
  } else {
    settleChildren(slot);
  }
}

/** What a finished child hands back to the model: its handoff (delegation) or its answer (consult). */
function childResult(child: Run, slug: string): { result: string; success: boolean; status: string; summary: string } {
  if (child.kind === "consult") {
    if (child.status === "completed") {
      const answer = child.outputText.trim() || "(no answer)";
      return { result: JSON.stringify({ agent: slug, answer }), success: true, status: "done", summary: answer.slice(0, 300) };
    }
    const why = child.status === "cancelled" ? "was cancelled" : `could not answer: ${child.errorMessage ?? "unknown error"}`;
    return { result: JSON.stringify({ agent: slug, answer: null, error: `${slug} ${why}` }), success: false, status: child.status, summary: why };
  }

  const stored = parseStoredHandoff(child.resultJson);
  let handoff: Handoff;
  if (stored && child.status === "completed") {
    handoff = { ...stored, costCents: child.costCents };
  } else if (child.status === "completed") {
    handoff = { ...handoffFromText(child.outputText), costCents: child.costCents };
  } else {
    const reason = child.status === "cancelled" ? "The work was cancelled." : `The agent did not finish: ${child.errorMessage ?? "unknown error"}`;
    const text = child.outputText ? `${reason}\nPartial output:\n${child.outputText}` : reason;
    handoff = { ...handoffFromText(text, "failed"), costCents: child.costCents };
  }
  return { result: handoffForParent(slug, handoff), success: handoff.status === "done", status: handoff.status, summary: handoff.summary.slice(0, 300) };
}

async function pollChildren(ctx: StepContext, slot: Slot) {
  // Runs saved before delegate_many kept a single child on the slot.
  if (!slot.children && slot.childRunId) slot.children = [{ agentSlug: slot.childAgentSlug ?? "agent", runId: slot.childRunId }];

  for (const entry of slot.children ?? []) {
    if (entry.result !== undefined || !entry.runId) continue;
    const child = await getRun(entry.runId);
    if (!child) {
      entry.result = `Error: agent "${entry.agentSlug}" could not be found.`;
      entry.success = false;
      continue;
    }
    if (!isTerminalStatus(child.status)) continue;
    const outcome = childResult(child, entry.agentSlug);
    entry.result = outcome.result;
    entry.success = outcome.success;
    await ctx.emit({
      type: "delegate_done",
      childAgentSlug: entry.agentSlug,
      childSessionId: child.sessionId,
      output: child.outputText,
      status: outcome.status,
      summary: outcome.summary,
      costCents: Math.round(child.costCents * 100) / 100
    });
  }

  if ((slot.children ?? []).every((c) => c.result !== undefined)) settleChildren(slot);
  await saveState(ctx.run.id, ctx.state);
}

function settleChildren(slot: Slot) {
  const children = slot.children ?? [];
  if (slot.name === "delegate_many") {
    settle(slot, { output: `[${children.map((c) => c.result ?? "null").join(",\n")}]`, success: children.some((c) => c.success) });
  } else {
    const only = children[0];
    settle(slot, { output: only?.result ?? "Error: nothing was delegated.", success: !!only?.success });
  }
}

/** Ask the founder. Returns true when the run now waits for the answer. */
async function askUser(ctx: StepContext, slot: Slot): Promise<boolean> {
  if (!slot.counted) {
    ctx.scope.tree.budget.recordToolCall();
    slot.counted = true;
  }
  const question = str(slot.input.question);
  if (!question) {
    settle(slot, { output: "Error: question is required", success: false });
    return false;
  }
  const options = Array.isArray(slot.input.options) ? slot.input.options.map(str).filter(Boolean).slice(0, 8) : [];
  const context = str(slot.input.context) || null;

  const row = await createQuestion({
    orgId: ctx.run.organizationId,
    sessionId: ctx.run.sessionId,
    agentId: ctx.run.agentId,
    question: question.slice(0, 2000),
    context,
    options,
    timeoutMs: approvalTimeoutMs()
  });
  slot.status = "waiting_approval";
  slot.approvalId = row.id;
  await ctx.emit({ type: "question_asked", approvalId: row.id, question, context, options });
  return true;
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

/**
 * The structured result of a finished run: what it gave `finish_run`, or, for delegated work that only answered in
 * text, that text wrapped as a handoff. Task runs and consults that did not call finish_run have none.
 */
function finalHandoff(ctx: StepContext, output: string): HandoffInput | null {
  if (ctx.state.finish) return ctx.state.finish;
  if (requiredEnding(ctx.run.kind) === "finish_run") return handoffFromText(output);
  return null;
}

async function complete(ctx: StepContext, text: string): Promise<AdvanceResult> {
  const { run, root, budget, emit } = ctx;
  await flushBudget(root.id, budget);
  const handoffInput = finalHandoff(ctx, text);
  let output = text;
  let resultJson: string | null = null;
  if (handoffInput) {
    const costCents = (await getRun(run.id))?.costCents ?? run.costCents;
    const handoff: Handoff = { ...handoffInput, costCents };
    resultJson = JSON.stringify(handoff);
    const rendered = renderHandoff(handoff);
    output = ctx.state.finish ? (text.trim() ? `${text.trim()}\n\n---\n\n${rendered}` : rendered) : text;
  }
  const extra = resultJson ? { finishedAt: new Date(), resultJson, outputText: output } : { finishedAt: new Date() };
  if (!(await setStatus(run.id, "completed", extra))) return "finished";
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
  // Expected stops (limits, pauses, a declined request, a missing key) are logged; anything else is a bug worth reporting.
  const expected = error instanceof LimitExceededError || error instanceof AgentsPausedError || error instanceof ModelRefusalError || /API_KEY is not set/.test(message);
  if (expected) log.warn("run failed", { runId: run.id, sessionId: run.sessionId, orgId: run.organizationId, reason: message });
  else await reportError(error, { runId: run.id, sessionId: run.sessionId, orgId: run.organizationId, kind: run.kind });
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
  // What the run produced becomes searchable, and its findings are proposed to memory. Never fails the run.
  await captureRunLearning(fresh);
  // A briefing run hands its text (or, if it failed, the records-only version) to its briefing.
  await finishBriefingForRun(fresh).catch((error) => console.error(`[briefings] run ${run.id}:`, error));
  if (run.parentRunId) await enqueueAdvance(run.parentRunId);
  // People and outside tools hear about work they started finishing (planning, review and briefing runs report
  // through their plan or briefing instead).
  if (isRoot && (run.kind === "task" || run.kind === "plan_node")) {
    const name = await agentName(run.agentId);
    await publishOrgEvent(run.organizationId, result.outcome === "completed" ? "run.completed" : "run.failed", {
      text: result.outcome === "completed" ? `${name} finished: ${result.output.trim().slice(0, 240) || "done"}` : `${name} failed: ${result.errorMessage ?? "unknown error"}`,
      path: `/org/${run.organizationId}/mission`,
      data: { runId: run.id, sessionId: run.sessionId, taskId: run.taskId, kind: run.kind, agentId: run.agentId, outcome: result.outcome, costCents: rootFresh.costCents, error: result.errorMessage }
    });
  }
  await markClosedOut(run.id);
  // After the close-out: the plan reads the step's task and result, which the close-out writes.
  if (run.planId) await enqueuePlanAdvance(run.planId);
}

async function markClosedOut(runId: string) {
  await prisma.run.updateMany({ where: { id: runId, closedOutAt: null }, data: { closedOutAt: new Date() } });
}

/**
 * Finish the close-out of runs that reached a final state but whose worker stopped before updating the session,
 * task and parent (the status change and the close-out are separate writes). Each run is claimed first, so two
 * sweepers never both repair it. Returns how many were repaired.
 */
export async function repairUnclosedRuns(olderThanMs: number): Promise<number> {
  const stale = await prisma.run.findMany({
    where: { status: { in: ["completed", "failed", "cancelled"] }, closedOutAt: null, finishedAt: { lt: new Date(Date.now() - olderThanMs) } },
    take: 50
  });
  let repaired = 0;
  for (const run of stale) {
    const claimed = await prisma.run.updateMany({ where: { id: run.id, closedOutAt: null }, data: { closedOutAt: new Date() } });
    if (claimed.count !== 1) continue;
    const outcome = run.status as "completed" | "failed" | "cancelled";
    const isRoot = run.id === run.rootRunId;
    const root = isRoot ? run : ((await getRun(run.rootRunId)) ?? run);
    await finalizeRunRecords({
      run,
      agentName: await agentName(run.agentId),
      outcome,
      output: run.outputText,
      errorMessage: outcome === "completed" ? null : run.errorMessage,
      usage: isRoot && outcome !== "cancelled" ? usageNote(budgetFromRoot(root)) : null
    });
    if (isRoot && outcome !== "cancelled") await recordTreeUsage(root, budgetFromRoot(root));
    if (run.parentRunId) await enqueueAdvance(run.parentRunId);
    if (run.planId) await enqueuePlanAdvance(run.planId);
    repaired += 1;
  }
  return repaired;
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
  await markClosedOut(run.id);
  // After the close-out: the plan reads the step's task and result, which the close-out writes.
  if (run.planId) await enqueuePlanAdvance(run.planId);
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

/** The untrusted origin recorded on a task started by an outside event (see src/lib/automations/start-work.ts). */
function untrustedOrigin(metadataJson: string | null): { tool: string; excerpt: string } | null {
  if (!metadataJson) return null;
  try {
    const meta = JSON.parse(metadataJson) as { untrusted?: { tool?: unknown; excerpt?: unknown } };
    if (!meta.untrusted || typeof meta.untrusted.tool !== "string") return null;
    return { tool: meta.untrusted.tool, excerpt: typeof meta.untrusted.excerpt === "string" ? meta.untrusted.excerpt : "" };
  } catch {
    return null;
  }
}
