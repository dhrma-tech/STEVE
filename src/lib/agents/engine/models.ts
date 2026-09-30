import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AgentTool } from "../tools/types";
import type { ProviderId } from "./types";

/** A failure worth retrying later (provider overloaded, network down). The step is retried by the job queue. */
export class TransientModelError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "TransientModelError";
  }
}

export type ModelToolCall = { id: string; name: string; input: Record<string, unknown> };

export type ModelTurn = {
  text: string;
  toolCalls: ModelToolCall[];
  inputTokens: number;
  outputTokens: number;
  /** Provider-native message to append to the history. */
  assistantMessage: unknown;
};

// ── Message formats ───────────────────────────────────────────────────────────

export function initialMessages(provider: ProviderId, system: string, user: string): unknown[] {
  if (provider === "openai") {
    return [
      { role: "system", content: system },
      { role: "user", content: user }
    ];
  }
  return [{ role: "user", content: user }];
}

/** The message(s) that hand tool results back to the model, in the provider's format. */
export function toolResultMessages(provider: ProviderId, results: Array<{ id: string; output: string }>): unknown[] {
  if (provider === "openai") {
    return results.map((r) => ({ role: "tool", tool_call_id: r.id, content: r.output }));
  }
  return [{ role: "user", content: results.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.output })) }];
}

const STUB_LIMIT = 300;

function stub(text: string): string {
  return text.length > STUB_LIMIT ? `${text.slice(0, STUB_LIMIT)}\n[earlier tool output trimmed to save space]` : text;
}

/**
 * Keep a long run inside the model's context window by shortening old tool output. Recent messages stay whole;
 * the structure (which call produced which result) is preserved so the history stays valid for the provider.
 * This trims; it does not summarize.
 */
export function compactMessages(
  provider: ProviderId,
  messages: unknown[],
  options: { maxChars?: number; keepLast?: number } = {}
): unknown[] {
  const maxChars = options.maxChars ?? 120_000;
  const keepLast = options.keepLast ?? 8;
  if (JSON.stringify(messages).length <= maxChars) return messages;

  const cutoff = Math.max(0, messages.length - keepLast);
  return messages.map((message, index) => {
    if (index >= cutoff) return message;
    const m = message as { role?: string; content?: unknown };
    if (provider === "openai") {
      return m.role === "tool" && typeof m.content === "string" ? { ...m, content: stub(m.content) } : message;
    }
    if (m.role === "user" && Array.isArray(m.content)) {
      return {
        ...m,
        content: m.content.map((block: { type?: string; content?: unknown }) =>
          block.type === "tool_result" && typeof block.content === "string" ? { ...block, content: stub(block.content) } : block
        )
      };
    }
    return message;
  });
}

// ── Retry and circuit breaker ─────────────────────────────────────────────────

const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);
const NETWORK_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_SOCKET"]);

export function isRetryableModelError(error: unknown): boolean {
  const e = error as { status?: number; code?: string; message?: string } | null;
  if (!e) return false;
  if (typeof e.status === "number") return RETRYABLE_STATUS.has(e.status);
  if (e.code && NETWORK_CODES.has(e.code)) return true;
  return /fetch failed|network|socket hang up|timed? ?out|overloaded/i.test(e.message ?? "");
}

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 30_000;
const g = globalThis as typeof globalThis & { _steveCircuits?: Map<string, { failures: number; openUntil: number }> };
const circuits: Map<string, { failures: number; openUntil: number }> = (g._steveCircuits ??= new Map());

export function resetCircuits() {
  circuits.clear();
}

/** MODEL_RETRY_BASE_MS, or 500. Zero is allowed (tests use it); blank or invalid falls back to the default. */
export function retryBaseMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.MODEL_RETRY_BASE_MS?.trim();
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : 500;
}

/**
 * Run a model call with a few quick retries. After repeated failures a provider is treated as down for a
 * short time, so a queue full of runs does not hammer it; the step is then retried later by the job queue.
 */
export async function withRetry<T>(
  provider: string,
  fn: () => Promise<T>,
  options: { attempts?: number; baseMs?: number } = {}
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseMs = options.baseMs ?? retryBaseMs();
  const circuit = circuits.get(provider) ?? { failures: 0, openUntil: 0 };
  if (circuit.openUntil > Date.now()) {
    throw new TransientModelError(`The ${provider} model is temporarily unavailable. Retrying shortly.`);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const value = await fn();
      circuits.set(provider, { failures: 0, openUntil: 0 });
      return value;
    } catch (error) {
      lastError = error;
      if (!isRetryableModelError(error)) throw error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseMs * 2 ** attempt * (0.75 + Math.random() * 0.5)));
      }
    }
  }

  const failures = circuit.failures + 1;
  circuits.set(provider, { failures, openUntil: failures >= CIRCUIT_THRESHOLD ? Date.now() + CIRCUIT_OPEN_MS : 0 });
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new TransientModelError(`The ${provider} model did not respond (${message}).`, lastError);
}

// ── One model turn ────────────────────────────────────────────────────────────

export async function runModelTurn(params: {
  provider: Exclude<ProviderId, "ollama">;
  modelId: string;
  apiKey: string;
  system: string;
  messages: unknown[];
  tools: AgentTool[];
  onText: (delta: string) => void;
}): Promise<ModelTurn> {
  const { provider, modelId, apiKey, system, messages, tools, onText } = params;
  return withRetry(provider, () =>
    provider === "anthropic"
      ? anthropicTurn({ modelId, apiKey, system, messages, tools, onText })
      : openaiTurn({ modelId, apiKey, messages, tools, onText })
  );
}

async function anthropicTurn(p: {
  modelId: string;
  apiKey: string;
  system: string;
  messages: unknown[];
  tools: AgentTool[];
  onText: (delta: string) => void;
}): Promise<ModelTurn> {
  const client = new Anthropic({ apiKey: p.apiKey });
  const tools = p.tools.map((t) => ({
    name: t.definition.name,
    description: t.definition.description,
    input_schema: t.definition.input_schema
  })) as Anthropic.Tool[];

  let text = "";
  const stream = client.messages.stream({
    model: p.modelId,
    max_tokens: 4096,
    system: p.system,
    messages: p.messages as Anthropic.MessageParam[],
    tools
  });
  stream.on("text", (delta: string) => {
    text += delta;
    p.onText(delta);
  });
  const message = await stream.finalMessage();

  const toolCalls: ModelToolCall[] =
    message.stop_reason === "tool_use"
      ? message.content
          .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
          .map((block) => ({ id: block.id, name: block.name, input: (block.input ?? {}) as Record<string, unknown> }))
      : [];

  return {
    text,
    toolCalls,
    inputTokens: message.usage?.input_tokens ?? 0,
    outputTokens: message.usage?.output_tokens ?? 0,
    assistantMessage: { role: "assistant", content: message.content }
  };
}

async function openaiTurn(p: {
  modelId: string;
  apiKey: string;
  messages: unknown[];
  tools: AgentTool[];
  onText: (delta: string) => void;
}): Promise<ModelTurn> {
  const client = new OpenAI({ apiKey: p.apiKey });
  const tools: OpenAI.ChatCompletionTool[] = p.tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.definition.name,
      description: t.definition.description,
      parameters: t.definition.input_schema as Record<string, unknown>
    }
  }));

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  const accum: Record<number, { id: string; name: string; arguments: string }> = {};

  const stream = await client.chat.completions.create({
    model: p.modelId,
    messages: p.messages as OpenAI.ChatCompletionMessageParam[],
    tools,
    stream: true,
    stream_options: { include_usage: true }
  });

  for await (const chunk of stream) {
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
      outputTokens = chunk.usage.completion_tokens ?? outputTokens;
    }
    const delta = chunk.choices[0]?.delta;
    if (delta?.content) {
      text += delta.content;
      p.onText(delta.content);
    }
    for (const tc of delta?.tool_calls ?? []) {
      const slot = (accum[tc.index] ??= { id: "", name: "", arguments: "" });
      if (tc.id) slot.id = tc.id;
      if (tc.function?.name) slot.name += tc.function.name;
      if (tc.function?.arguments) slot.arguments += tc.function.arguments;
    }
  }

  const calls = Object.values(accum);
  const toolCalls: ModelToolCall[] = calls.map((c) => {
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(c.arguments || "{}") as Record<string, unknown>;
    } catch {
      /* the model sent malformed arguments; the tool will report what is missing */
    }
    return { id: c.id, name: c.name, input };
  });

  return {
    text,
    toolCalls,
    inputTokens,
    outputTokens,
    assistantMessage: calls.length
      ? {
          role: "assistant",
          content: text || null,
          tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } }))
        }
      : { role: "assistant", content: text }
  };
}
