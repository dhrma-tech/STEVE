import { estimateCostCents } from "./pricing";

export type RunLimits = {
  /** How many delegation levels below the root agent may run. Root is depth 0. */
  maxDepth: number;
  /** Model turns across the whole run tree. */
  maxSteps: number;
  /** Tool calls across the whole run tree. */
  maxToolCalls: number;
  /** Estimated model spend across the whole run tree, in cents. */
  budgetCents: number;
};

export type LimitKind = "budget" | "steps" | "tool_calls" | "depth";

export class LimitExceededError extends Error {
  constructor(public limit: LimitKind, message: string) {
    super(message);
    this.name = "LimitExceededError";
  }
}

function intFromEnv(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export const DEFAULT_DAILY_BUDGET_CENTS = 1000;

export function defaultLimits(env: NodeJS.ProcessEnv = process.env): RunLimits {
  return {
    maxDepth: intFromEnv(env, "AGENT_MAX_DEPTH", 3),
    maxSteps: intFromEnv(env, "AGENT_MAX_STEPS", 60),
    maxToolCalls: intFromEnv(env, "AGENT_MAX_TOOL_CALLS", 100),
    budgetCents: intFromEnv(env, "AGENT_RUN_BUDGET_CENTS", 200)
  };
}

export function defaultDailyBudgetCents(env: NodeJS.ProcessEnv = process.env): number {
  return intFromEnv(env, "AGENT_DAILY_BUDGET_CENTS", DEFAULT_DAILY_BUDGET_CENTS);
}

export type BudgetTotals = {
  spentCents: number;
  tokensIn: number;
  tokensOut: number;
  steps: number;
  toolCalls: number;
};

const ZERO_TOTALS: BudgetTotals = { spentCents: 0, tokensIn: 0, tokensOut: 0, steps: 0, toolCalls: 0 };

/**
 * Counters shared by every agent in one run tree (the root agent and everything it
 * delegates to). The tree stops as a whole when any limit is hit.
 *
 * The authoritative totals live on the root run's database row. A worker loads them at the start of a
 * step, records what its step used, and writes back only that step's delta (`takeDelta`), so agents
 * running in parallel on different workers add to the same totals instead of overwriting each other.
 */
export class RunBudget {
  spentCents: number;
  tokensIn: number;
  tokensOut: number;
  steps: number;
  toolCalls: number;
  private delta: BudgetTotals = { ...ZERO_TOTALS };

  constructor(public readonly limits: RunLimits, totals: Partial<BudgetTotals> = {}) {
    this.spentCents = totals.spentCents ?? 0;
    this.tokensIn = totals.tokensIn ?? 0;
    this.tokensOut = totals.tokensOut ?? 0;
    this.steps = totals.steps ?? 0;
    this.toolCalls = totals.toolCalls ?? 0;
  }

  /** What this budget object recorded since it was created or since the last call. Resets the delta. */
  takeDelta(): BudgetTotals {
    const out = this.delta;
    this.delta = { ...ZERO_TOTALS };
    return out;
  }

  /** Throws when a limit is already reached. Call before starting another model turn or tool call. */
  check(): void {
    if (this.spentCents >= this.limits.budgetCents) {
      throw new LimitExceededError(
        "budget",
        `Run budget reached (~${this.spentCents.toFixed(1)}¢ of ${this.limits.budgetCents}¢). The run was stopped.`
      );
    }
    if (this.steps >= this.limits.maxSteps) {
      throw new LimitExceededError("steps", `Step limit reached (${this.limits.maxSteps} model turns). The run was stopped.`);
    }
    if (this.toolCalls >= this.limits.maxToolCalls) {
      throw new LimitExceededError(
        "tool_calls",
        `Tool-call limit reached (${this.limits.maxToolCalls} calls). The run was stopped.`
      );
    }
  }

  recordToolCall(): void {
    this.check();
    this.toolCalls += 1;
    this.delta.toolCalls += 1;
  }

  /** Record one finished model turn. Cost is charged after the fact, so a turn can overshoot by one call. */
  recordModelTurn(params: { modelId: string; provider: string; inputTokens?: number; outputTokens?: number }): void {
    const inputTokens = params.inputTokens ?? 0;
    const outputTokens = params.outputTokens ?? 0;
    const cost = estimateCostCents({ ...params, inputTokens, outputTokens });
    this.steps += 1;
    this.tokensIn += inputTokens;
    this.tokensOut += outputTokens;
    this.spentCents += cost;
    this.delta.steps += 1;
    this.delta.tokensIn += inputTokens;
    this.delta.tokensOut += outputTokens;
    this.delta.spentCents += cost;
  }

  get totalTokens(): number {
    return this.tokensIn + this.tokensOut;
  }
}
