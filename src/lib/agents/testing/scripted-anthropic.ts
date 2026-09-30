/**
 * Scripted stand-in for the Anthropic SDK, for orchestration tests.
 *
 * Usage (in a test file):
 *   vi.mock("@anthropic-ai/sdk", async () => (await import("@/lib/agents/testing/scripted-anthropic")).anthropicModuleMock);
 *   scriptedModel.load([{ toolCalls: [{ name: "delegate_agent", input: {...} }] }, { text: "done" }]);
 *
 * Turns are consumed in the order the runner asks for them, across every agent in
 * the run tree. That is deterministic because the runner is sequential today.
 */

export type ScriptedToolCall = { name: string; input: Record<string, unknown> };
export type ScriptedTurn = {
  text?: string;
  toolCalls?: ScriptedToolCall[];
  /** Token usage reported for this turn. Defaults to 100 in / 50 out so budgets see some spend. */
  usage?: { input: number; output: number };
  /** Make this turn fail like a provider error (for example { status: 503 }) instead of answering. */
  error?: { status?: number; message: string };
};

export type RecordedCall = {
  model: string;
  system: string;
  messages: unknown[];
  toolNames: string[];
};

class ScriptedModel {
  private turns: ScriptedTurn[] = [];
  calls: RecordedCall[] = [];
  private toolSeq = 0;

  load(turns: ScriptedTurn[]) {
    this.turns = [...turns];
    this.calls = [];
    this.toolSeq = 0;
  }

  get remaining() {
    return this.turns.length;
  }

  next(call: RecordedCall) {
    this.calls.push(call);
    const turn = this.turns.shift();
    if (!turn) throw new Error("ScriptedModel: script exhausted (the runner asked for more turns than scripted)");
    if (turn.error) throw Object.assign(new Error(turn.error.message), { status: turn.error.status });
    const content: Array<Record<string, unknown>> = [];
    if (turn.text) content.push({ type: "text", text: turn.text });
    for (const tc of turn.toolCalls ?? []) {
      content.push({ type: "tool_use", id: `toolu_${++this.toolSeq}`, name: tc.name, input: tc.input });
    }
    return {
      turn,
      content,
      stop_reason: turn.toolCalls?.length ? "tool_use" : "end_turn",
      usage: { input_tokens: turn.usage?.input ?? 100, output_tokens: turn.usage?.output ?? 50 }
    };
  }
}

export const scriptedModel = new ScriptedModel();

class ScriptedAnthropic {
  messages = {
    stream: (params: { model: string; system: string; messages: unknown[]; tools?: Array<{ name: string }> }) => {
      const handlers: Record<string, Array<(text: string) => void>> = {};
      return {
        on(event: string, cb: (text: string) => void) {
          (handlers[event] ??= []).push(cb);
          return this;
        },
        async finalMessage() {
          const { turn, content, stop_reason, usage } = scriptedModel.next({
            model: params.model,
            system: params.system,
            messages: structuredClone(params.messages),
            toolNames: (params.tools ?? []).map((t) => t.name)
          });
          if (turn.text) for (const cb of handlers.text ?? []) cb(turn.text);
          return { content, stop_reason, usage };
        }
      };
    }
  };
}

/** Return value for `vi.mock("@anthropic-ai/sdk", ...)`. */
export const anthropicModuleMock = { default: ScriptedAnthropic };
