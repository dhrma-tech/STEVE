import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/client";
import type { AgentEvent } from "./events";
import type { AgentTool, ToolContext } from "./tools/types";
import { decide } from "./policy/engine";
import { approvalTimeoutMs, createApproval } from "./policy/approvals";
import { getEffectivePolicy } from "./policy/store";
import { summarizeToolCall, type ToolRisk } from "./policy/risk";
import { redactSecrets, sanitizeToolOutput } from "./policy/sanitize";
import { screenToolOutput, wrapUntrusted, type InjectionFinding } from "./policy/injection";
import { validateToolInput } from "./tools/validate";

export type ToolCallResult = {
  /** Text handed back to the model. Already redacted and length-capped. */
  output: string;
  success: boolean;
  outcome: "completed" | "failed" | "denied";
  /** The output looked like a prompt injection (it was wrapped as untrusted data before reaching the model). */
  injection?: InjectionFinding;
};

export type Emit = (event: AgentEvent) => Promise<void>;

/** Calls that change something outside a single read: a repeat inside one run is almost always a retry, not intent. */
const REPEAT_GUARDED: ReadonlySet<ToolRisk> = new Set<ToolRisk>(["external_write", "external_comms", "spend", "destructive"]);

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function idempotencyKey(sessionId: string, toolName: string, input: Record<string, unknown>): string {
  return createHash("sha256").update(`${sessionId}|${toolName}|${stableStringify(input)}`).digest("hex").slice(0, 32);
}

export function toolTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.AGENT_TOOL_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : 60_000;
}

export type Evaluation =
  /** Settled without running anything: unknown tool, blocked by policy, or a repeat. Already recorded and reported. */
  | { kind: "result"; result: ToolCallResult }
  /** A person has to approve before it runs. */
  | { kind: "ask"; risk: ToolRisk; reason: string; summary: string }
  | { kind: "run"; risk: ToolRisk; idempotencyKey: string | null };

/**
 * Decide what to do with one tool call:
 *   1. count it against the run tree's limits (unless a previous attempt already did),
 *   2. get a policy decision (allow / ask a human / deny),
 *   3. skip an identical outside-effect call that already completed in this run.
 * Nothing is executed here.
 */
export async function evaluateToolCall(params: {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolset: AgentTool[];
  ctx: ToolContext;
  counted: boolean;
  emit: Emit;
  /** The run has read injection-shaped content: nothing outside STEVE is pre-approved any more. */
  tainted?: boolean;
}): Promise<Evaluation> {
  const { toolName, toolInput, toolset, ctx, counted, emit } = params;
  const { orgId, agentId, sessionId, scope } = ctx;

  if (!counted) scope.tree.budget.recordToolCall(); // throws LimitExceededError when a limit is hit

  const tool = toolset.find((t) => t.definition.name === toolName);
  if (!tool) {
    const output = `Unknown tool: ${toolName}`;
    await recordAction({ orgId, sessionId, agentId, toolName, status: "failed", payload: { input: toolInput, output } });
    await emit({ type: "tool_call", tool: toolName, input: toolInput });
    await emit({ type: "tool_result", tool: toolName, output, success: false });
    return { kind: "result", result: { output, success: false, outcome: "failed" } };
  }

  // Arguments that do not match the tool's schema go back to the model to fix; nothing is asked or run.
  const check = validateToolInput(tool.definition, toolInput);
  if (!check.ok) {
    await recordAction({ orgId, sessionId, agentId, toolName, status: "failed", payload: { input: toolInput, output: check.error } });
    await emit({ type: "tool_call", tool: toolName, input: toolInput });
    await emit({ type: "tool_result", tool: toolName, output: check.error, success: false });
    return { kind: "result", result: { output: check.error, success: false, outcome: "failed" } };
  }

  const { policy } = await getEffectivePolicy(orgId, agentId);
  const decision = decide({ toolName, input: toolInput, mode: scope.mode, policy, grants: scope.tree.grants, tainted: params.tainted });

  if (decision.action === "deny") {
    const output = `Blocked by policy: ${decision.reason} This action was not run.`;
    await recordAction({
      orgId, sessionId, agentId, toolName, status: "denied",
      payload: { input: toolInput, risk: decision.risk, reason: decision.reason }
    });
    await emit({ type: "tool_call", tool: toolName, input: toolInput });
    await emit({ type: "tool_result", tool: toolName, output, success: false });
    return { kind: "result", result: { output, success: false, outcome: "denied" } };
  }

  // Repeat guard: an identical outside-effect call that already completed in this run is not run twice,
  // and nobody is asked to approve it again.
  const key = REPEAT_GUARDED.has(decision.risk) ? idempotencyKey(sessionId, toolName, toolInput) : null;
  if (key) {
    const previous = await prisma.agentAction.findFirst({
      where: {
        sessionId,
        actionType: `tool.${toolName}`,
        status: "completed",
        payloadJson: { contains: `"idempotencyKey":"${key}"` }
      }
    });
    if (previous) {
      const previousOutput = readOutput(previous.payloadJson);
      const output = `Skipped: an identical ${toolName} call already completed earlier in this run, so it was not repeated.${previousOutput ? ` Earlier result: ${previousOutput}` : ""}`;
      await recordAction({ orgId, sessionId, agentId, toolName, status: "skipped", payload: { input: toolInput, idempotencyKey: key } });
      await emit({ type: "tool_call", tool: toolName, input: toolInput });
      await emit({ type: "tool_result", tool: toolName, output, success: true });
      return { kind: "result", result: { output, success: true, outcome: "completed" } };
    }
  }

  if (decision.action === "ask") {
    return { kind: "ask", risk: decision.risk, reason: decision.reason, summary: summarizeToolCall(toolName, toolInput) };
  }
  return { kind: "run", risk: decision.risk, idempotencyKey: key };
}

/** Record the pending call and the approval a human must answer, and announce it. The run then waits. */
export async function requestToolApproval(params: {
  toolName: string;
  toolInput: Record<string, unknown>;
  ctx: ToolContext;
  taskId: string | null;
  risk: ToolRisk;
  reason: string;
  summary: string;
  emit: Emit;
}): Promise<{ approvalId: string; actionId: string }> {
  const { toolName, toolInput, ctx, taskId, risk, reason, summary, emit } = params;
  const actionId = await recordAction({
    orgId: ctx.orgId, sessionId: ctx.sessionId, agentId: ctx.agentId, toolName, status: "waiting_approval",
    payload: { input: toolInput, risk, summary }
  });
  const approval = await createApproval({
    orgId: ctx.orgId, sessionId: ctx.sessionId, taskId, agentId: ctx.agentId, agentActionId: actionId, toolName,
    input: toolInput, risk, summary, timeoutMs: approvalTimeoutMs()
  });
  await emit({ type: "approval_required", tool: toolName, input: toolInput, approvalId: approval.id, risk, summary, reason });
  return { approvalId: approval.id, actionId };
}

/** A human said no (or nobody answered in time): close out the pending call and tell the agent. */
export async function finishUnapprovedCall(params: {
  toolName: string;
  toolInput: Record<string, unknown>;
  actionId: string | null;
  approvalId: string;
  status: "denied" | "expired" | "cancelled";
  emit: Emit;
}): Promise<ToolCallResult> {
  const { toolName, toolInput, actionId, approvalId, status, emit } = params;
  const output =
    status === "expired"
      ? "Action not run: no one approved it in time. Continue without it, or ask the user again later."
      : status === "cancelled"
        ? "Action not run: the run was cancelled."
        : "Action denied by the user. Do not retry it; continue with another approach or explain what is blocked.";
  if (actionId) await updateAction(actionId, { status: "denied", payload: { input: toolInput, approvalId, outcome: status } });
  await emit({ type: "tool_call", tool: toolName, input: toolInput });
  await emit({ type: "tool_result", tool: toolName, output, success: false });
  return { output, success: false, outcome: "denied" };
}

/** Run an approved (or allowed) tool call with a timeout, and record and report the outcome. */
export async function runToolCall(params: {
  toolName: string;
  toolInput: Record<string, unknown>;
  tool: AgentTool;
  ctx: ToolContext;
  risk: ToolRisk;
  idempotencyKey: string | null;
  actionId: string | null;
  approvalId: string | null;
  emit: Emit;
}): Promise<ToolCallResult & { actionId: string }> {
  const { toolName, toolInput, tool, ctx, risk, idempotencyKey: key, approvalId, emit } = params;

  await emit({ type: "tool_call", tool: toolName, input: toolInput });
  const startPayload = {
    input: toolInput,
    risk,
    ...(key ? { idempotencyKey: key } : {}),
    ...(approvalId ? { approvalId } : {})
  };
  let actionId = params.actionId;
  if (actionId) await updateAction(actionId, { status: "running", payload: startPayload });
  else actionId = await recordAction({ orgId: ctx.orgId, sessionId: ctx.sessionId, agentId: ctx.agentId, toolName, status: "running", payload: startPayload });

  let output: string;
  let success = true;
  try {
    output = await withTimeout(tool.execute(toolInput, ctx), toolTimeoutMs(), toolName);
  } catch (error) {
    output = `Tool error: ${error instanceof Error ? error.message : String(error)}`;
    success = false;
  }
  output = sanitizeToolOutput(output);
  // Outside content that reads like instructions to the agent is passed on as marked, untrusted data.
  const injection = success ? (screenToolOutput(toolName, output) ?? undefined) : undefined;
  if (injection) output = wrapUntrusted(toolName, output);

  await updateAction(actionId, {
    status: success ? "completed" : "failed",
    payload: { ...startPayload, output: output.slice(0, 2000), ...(injection ? { injectionSuspected: injection.pattern } : {}) }
  });
  await emit({ type: "tool_result", tool: toolName, output, success });
  if (injection) await emit({ type: "injection_suspected", tool: toolName, excerpt: injection.excerpt });
  return { output, success, outcome: success ? "completed" : "failed", actionId, ...(injection ? { injection } : {}) };
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    timer.unref?.();
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function readOutput(payloadJson: string | null): string {
  if (!payloadJson) return "";
  try {
    const parsed = JSON.parse(payloadJson) as { output?: unknown };
    return typeof parsed.output === "string" ? parsed.output.slice(0, 500) : "";
  } catch {
    return "";
  }
}

async function recordAction(params: {
  orgId: string;
  sessionId: string;
  agentId: string;
  toolName: string;
  status: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const action = await prisma.agentAction.create({
    data: {
      organizationId: params.orgId,
      sessionId: params.sessionId,
      agentId: params.agentId,
      label: `Tool: ${params.toolName}`,
      actionType: `tool.${params.toolName}`,
      status: params.status,
      payloadJson: redactSecrets(JSON.stringify(params.payload)),
      ...(params.status === "running" || params.status === "waiting_approval" ? {} : { completedAt: new Date() })
    }
  });
  return action.id;
}

async function updateAction(actionId: string, params: { status: string; payload: Record<string, unknown> }) {
  await prisma.agentAction.update({
    where: { id: actionId },
    data: {
      status: params.status,
      payloadJson: redactSecrets(JSON.stringify(params.payload)),
      ...(params.status === "running" ? {} : { completedAt: new Date() })
    }
  });
}
