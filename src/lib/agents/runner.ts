import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "@/lib/db/client";
import { resolveModel } from "@/lib/ai/model-router";
import { ollamaChatSafe } from "@/lib/ai/ollama";
import { buildToolset } from "./tools/registry";
import { buildPrompt, loadOrgContext } from "@/lib/queue/sandbox-execution";
import type { AgentTool, ToolContext } from "./tools/types";

// ── Event types ───────────────────────────────────────────────────────────────

export type AgentEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_call"; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool: string; output: string; success: boolean }
  | { type: "approval_required"; tool: string; input: unknown; approvalId: string }
  | { type: "delegate_start"; childAgentSlug: string; childSessionId: string }
  | { type: "delegate_done"; childAgentSlug: string; output: string }
  | { type: "done"; output: string }
  | { type: "error"; message: string };

export interface AgentRunResult {
  output: string;
  success: boolean;
}

// ── Approval gate (Phase 5 resolves these via POST /approve) ──────────────────

export const pausedApprovals = new Map<string, {
  resolve: () => void;
  reject: (err: Error) => void;
}>();

function waitForApproval(approvalId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    pausedApprovals.set(approvalId, { resolve, reject });
    setTimeout(() => {
      if (pausedApprovals.delete(approvalId)) {
        reject(new Error("Approval timed out after 5 minutes"));
      }
    }, 5 * 60 * 1000);
  });
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runAgent(opts: {
  sessionId: string;
  agentId: string;
  orgId: string;
  task: string;
  parentSessionId?: string;
  onEvent: (event: AgentEvent) => void;
}): Promise<AgentRunResult> {
  const { sessionId, agentId, orgId, task, onEvent } = opts;
  const startedAt = new Date();

  // Load agent config
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { department: true }
  });
  if (!agent) {
    onEvent({ type: "error", message: "Agent not found" });
    return { output: "", success: false };
  }

  // Load session + its task
  const session = await prisma.taskSession.findUnique({
    where: { id: sessionId },
    include: {
      task: {
        include: {
          subtasks: { orderBy: { sortOrder: "asc" } },
          files: { where: { archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 8 }
        }
      }
    }
  });
  const taskRecord = session?.task ?? null;

  // Load org + shared context
  const [org, orgContext] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    loadOrgContext(orgId)
  ]);

  // Parse agent skill keys
  let skillKeys: string[] = [];
  let permissionMode = "review_required";
  try {
    const toolsCfg = JSON.parse(agent.toolsJson ?? "{}") as { skillKeys?: unknown };
    if (Array.isArray(toolsCfg.skillKeys)) {
      skillKeys = (toolsCfg.skillKeys as unknown[]).filter((k): k is string => typeof k === "string");
    }
  } catch { /* ignore */ }
  try {
    const permCfg = JSON.parse(agent.permissionsJson ?? "{}") as { mode?: unknown };
    if (typeof permCfg.mode === "string") permissionMode = permCfg.mode;
  } catch { /* ignore */ }

  // Parse department context
  let deptContext = "";
  try {
    const ctx = JSON.parse(agent.department.contextJson ?? "{}") as Record<string, unknown>;
    deptContext = Object.entries(ctx)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("\n");
  } catch { /* ignore */ }

  // Build toolset
  const toolset = buildToolset(skillKeys);
  const toolCtx: ToolContext = { orgId, agentId, sessionId, skillKeys };

  // Build system + user prompt
  const { system, user } = buildPrompt({
    agentName: agent.name,
    orgName: org?.name ?? "your company",
    deptName: agent.department.name,
    deptSlug: agent.department.slug,
    deptContext,
    skillNames: skillKeys,
    taskTitle: taskRecord?.title ?? task.split(/\r?\n/)[0]?.slice(0, 80) ?? task.slice(0, 80),
    taskDescription: taskRecord?.description ?? null,
    subtasks: (taskRecord?.subtasks ?? []).map(s => ({ title: s.title, status: s.status })),
    fileNames: (taskRecord?.files ?? []).map(f => f.name),
    message: task,
    hasGithub: skillKeys.includes("github-repository"),
    hasVercel: skillKeys.includes("vercel-preview"),
    businessPlan: orgContext.businessPlan,
    brandKit: orgContext.brandKit
  });

  // Resolve model and run the appropriate loop
  const modelConfig = resolveModel(agent.model);
  const loopOpts = { system, user, toolset, toolCtx, sessionId, agentId, orgId, permissionMode, onEvent };

  let output = "";
  let success = true;

  try {
    if (modelConfig.provider === "anthropic") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set — cannot use Anthropic model");
      output = await runAnthropicLoop({ ...loopOpts, apiKey, modelId: modelConfig.modelId });
    } else if (modelConfig.provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY not set — cannot use OpenAI model");
      output = await runOpenAILoop({ ...loopOpts, apiKey, modelId: modelConfig.modelId });
    } else {
      output = await ollamaChatSafe({ system, user });
      onEvent({ type: "done", output });
    }
  } catch (err) {
    const message = `Agent run failed: ${String(err)}`;
    onEvent({ type: "error", message });
    success = false;
  }

  await finalizeRun({ orgId, sessionId, taskId: taskRecord?.id ?? null, agentId, output, success, startedAt, agentName: agent.name });
  return { output, success };
}

// ── Anthropic tool-use loop ───────────────────────────────────────────────────

async function runAnthropicLoop(opts: {
  apiKey: string;
  modelId: string;
  system: string;
  user: string;
  toolset: AgentTool[];
  toolCtx: ToolContext;
  sessionId: string;
  agentId: string;
  orgId: string;
  permissionMode: string;
  onEvent: (event: AgentEvent) => void;
}): Promise<string> {
  const { apiKey, modelId, system, user, toolset, toolCtx, sessionId, agentId, orgId, permissionMode, onEvent } = opts;
  const client = new Anthropic({ apiKey });

  const toolDefs = toolset.map(t => ({
    name: t.definition.name,
    description: t.definition.description,
    input_schema: t.definition.input_schema
  })) as Anthropic.Tool[];

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  let fullOutput = "";

  for (let turn = 0; turn < 20; turn++) {
    let turnText = "";

    const stream = client.messages.stream({
      model: modelId,
      max_tokens: 4096,
      system,
      messages,
      tools: toolDefs
    });

    stream.on("text", (text: string) => {
      turnText += text;
      onEvent({ type: "text_delta", delta: text });
    });

    const message = await stream.finalMessage();
    fullOutput += turnText;

    if (message.stop_reason !== "tool_use") {
      onEvent({ type: "done", output: fullOutput });
      return fullOutput;
    }

    // Collect assistant content (text + tool_use blocks) into next messages
    messages.push({ role: "assistant", content: message.content });

    const toolResults: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
    }> = [];

    for (const block of message.content) {
      if (block.type !== "tool_use") continue;
      const toolInput = block.input as Record<string, unknown>;

      // Approval gate: delegate_agent in review_required mode pauses the loop
      if (block.name === "delegate_agent" && permissionMode === "review_required") {
        const approvalId = crypto.randomUUID();
        onEvent({ type: "approval_required", tool: block.name, input: toolInput, approvalId });
        try {
          await waitForApproval(approvalId);
        } catch (err) {
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: `Action denied: ${String(err)}` });
          continue;
        }
      }

      onEvent({ type: "tool_call", tool: block.name, input: toolInput });
      const { output: toolOutput, success: toolSuccess, actionId } = await executeAndRecord({
        toolName: block.name, toolInput, toolset, toolCtx, orgId, sessionId, agentId
      });
      onEvent({ type: "tool_result", tool: block.name, output: toolOutput, success: toolSuccess });
      void actionId; // recorded to DB inside executeAndRecord

      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: toolOutput });
    }

    messages.push({ role: "user", content: toolResults } as Anthropic.MessageParam);
  }

  // Max iterations reached
  onEvent({ type: "done", output: fullOutput });
  return fullOutput;
}

// ── OpenAI tool-use loop ──────────────────────────────────────────────────────

async function runOpenAILoop(opts: {
  apiKey: string;
  modelId: string;
  system: string;
  user: string;
  toolset: AgentTool[];
  toolCtx: ToolContext;
  sessionId: string;
  agentId: string;
  orgId: string;
  permissionMode: string;
  onEvent: (event: AgentEvent) => void;
}): Promise<string> {
  const { apiKey, modelId, system, user, toolset, toolCtx, sessionId, agentId, orgId, permissionMode, onEvent } = opts;
  const client = new OpenAI({ apiKey });

  const toolDefs: OpenAI.ChatCompletionTool[] = toolset.map(t => ({
    type: "function" as const,
    function: {
      name: t.definition.name,
      description: t.definition.description,
      parameters: t.definition.input_schema as Record<string, unknown>
    }
  }));

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
  let fullOutput = "";

  for (let turn = 0; turn < 20; turn++) {
    let turnText = "";
    const tcAccum: Record<number, { id: string; name: string; arguments: string }> = {};

    const stream = await client.chat.completions.create({
      model: modelId,
      messages,
      tools: toolDefs,
      stream: true
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        turnText += delta.content;
        onEvent({ type: "text_delta", delta: delta.content });
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!tcAccum[tc.index]) tcAccum[tc.index] = { id: "", name: "", arguments: "" };
          if (tc.id) tcAccum[tc.index].id = tc.id;
          if (tc.function?.name) tcAccum[tc.index].name += tc.function.name;
          if (tc.function?.arguments) tcAccum[tc.index].arguments += tc.function.arguments;
        }
      }
    }

    fullOutput += turnText;
    const toolCalls = Object.values(tcAccum);

    if (!toolCalls.length) {
      onEvent({ type: "done", output: fullOutput });
      return fullOutput;
    }

    // Append assistant message with tool_calls
    messages.push({
      role: "assistant",
      content: turnText || null,
      tool_calls: toolCalls.map(tc => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments }
      }))
    });

    // Execute each tool call and append its result
    for (const tc of toolCalls) {
      let toolInput: Record<string, unknown> = {};
      try { toolInput = JSON.parse(tc.arguments) as Record<string, unknown>; } catch { /* ignore */ }

      if (tc.name === "delegate_agent" && permissionMode === "review_required") {
        const approvalId = crypto.randomUUID();
        onEvent({ type: "approval_required", tool: tc.name, input: toolInput, approvalId });
        try {
          await waitForApproval(approvalId);
        } catch (err) {
          messages.push({ role: "tool", tool_call_id: tc.id, content: `Action denied: ${String(err)}` });
          continue;
        }
      }

      onEvent({ type: "tool_call", tool: tc.name, input: toolInput });
      const { output: toolOutput, success: toolSuccess } = await executeAndRecord({
        toolName: tc.name, toolInput, toolset, toolCtx, orgId, sessionId, agentId
      });
      onEvent({ type: "tool_result", tool: tc.name, output: toolOutput, success: toolSuccess });

      messages.push({ role: "tool", tool_call_id: tc.id, content: toolOutput });
    }
  }

  onEvent({ type: "done", output: fullOutput });
  return fullOutput;
}

// ── Tool executor + DB recorder ───────────────────────────────────────────────

async function executeAndRecord({
  toolName, toolInput, toolset, toolCtx, orgId, sessionId, agentId
}: {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolset: AgentTool[];
  toolCtx: ToolContext;
  orgId: string;
  sessionId: string;
  agentId: string;
}): Promise<{ output: string; success: boolean; actionId: string }> {
  const action = await prisma.agentAction.create({
    data: {
      organizationId: orgId,
      sessionId,
      agentId,
      label: `Tool: ${toolName}`,
      actionType: `tool.${toolName}`,
      status: "running",
      payloadJson: JSON.stringify({ input: toolInput })
    }
  });

  const tool = toolset.find(t => t.definition.name === toolName);
  let output = "";
  let success = true;

  if (!tool) {
    output = `Unknown tool: ${toolName}`;
    success = false;
  } else {
    try {
      output = await tool.execute(toolInput, toolCtx);
    } catch (err) {
      output = `Tool error: ${String(err)}`;
      success = false;
    }
  }

  await prisma.agentAction.update({
    where: { id: action.id },
    data: {
      status: success ? "completed" : "failed",
      completedAt: new Date(),
      payloadJson: JSON.stringify({ input: toolInput, output: output.slice(0, 2000) })
    }
  });

  return { output, success, actionId: action.id };
}

// ── Session + task finalizer ──────────────────────────────────────────────────

async function finalizeRun({
  orgId, sessionId, taskId, agentId, output, success, startedAt, agentName
}: {
  orgId: string;
  sessionId: string;
  taskId: string | null;
  agentId: string;
  output: string;
  success: boolean;
  startedAt: Date;
  agentName: string;
}) {
  const now = new Date();
  const elapsedMs = Math.max(1000, now.getTime() - startedAt.getTime());
  const replayUrl = `/org/${orgId}/canvas?session=${sessionId}&replay=1`;

  const scratchpad = [
    `# ${agentName} — ${success ? "Completed" : "Error"}`,
    "",
    output.trim() || "(no output generated)"
  ].join("\n");

  await prisma.$transaction([
    prisma.taskSession.update({
      where: { id: sessionId },
      data: { status: success ? "completed" : "error", finishedAt: now, elapsedMs, scratchpad, replayUrl }
    }),
    ...(taskId
      ? [prisma.task.update({ where: { id: taskId }, data: { status: success ? "ready_to_review" : "todo" } })]
      : []),
    prisma.agent.updateMany({ where: { id: agentId }, data: { status: "idle" } })
  ]);

  if (output && taskId) {
    const thread =
      (await prisma.chatThread.findFirst({ where: { organizationId: orgId, taskId, kind: "task", archivedAt: null } })) ??
      (await prisma.chatThread.create({ data: { organizationId: orgId, taskId, agentId, kind: "task", title: "Task chat" } }));

    await prisma.chatMessage.create({
      data: {
        organizationId: orgId,
        threadId: thread.id,
        senderType: "agent",
        senderAgentId: agentId,
        body: output,
        metadataJson: JSON.stringify({ kind: "agent_output" })
      }
    });
  }
}
