/**
 * Model tiers: which model does which kind of work, in configuration rather than code.
 *
 *   planner  — planning, replanning, reports and briefings (the Chief of Staff)      claude-opus-5-5, effort high
 *   worker   — department agents doing the work, and the Reviewer                    claude-sonnet-5-5, effort medium
 *   triage   — quick read-only questions between agents (ask_agent)                  claude-haiku-4-5
 *
 * Each tier can be changed with environment variables (MODEL_PLANNER, MODEL_PLANNER_EFFORT, MODEL_PLANNER_FALLBACK,
 * and the same for WORKER and TRIAGE). An agent can be pinned to a tier (Agent.modelTier) or to a specific model
 * (Agent.model); a pinned model wins over the tier.
 *
 * Model IDs and capabilities follow the Claude API reference as of 2026-09: Opus 5.5 and Sonnet 5.5 think adaptively
 * (thinking cannot be turned off; effort is the control, and Opus 5.5 defaults to `medium`, so it is set explicitly),
 * Haiku 4.5 takes no `effort`.
 */

export type ModelTier = "triage" | "worker" | "planner";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type TierConfig = {
  tier: ModelTier;
  modelId: string;
  /** null: do not send `effort` (the model does not take it). */
  effort: Effort | null;
  /** Tried when the primary model is unavailable (retries exhausted or its circuit is open). */
  fallbackModelId: string | null;
};

const DEFAULTS: Record<ModelTier, Omit<TierConfig, "tier">> = {
  planner: { modelId: "claude-opus-5-5", effort: "high", fallbackModelId: "claude-sonnet-5-5" },
  worker: { modelId: "claude-sonnet-5-5", effort: "medium", fallbackModelId: "claude-opus-5-5" },
  triage: { modelId: "claude-haiku-4-5", effort: null, fallbackModelId: "claude-sonnet-5-5" }
};

const EFFORTS: ReadonlySet<string> = new Set(["low", "medium", "high", "xhigh", "max"]);
export const MODEL_TIERS: readonly ModelTier[] = ["triage", "worker", "planner"];

export function isModelTier(value: unknown): value is ModelTier {
  return typeof value === "string" && (MODEL_TIERS as readonly string[]).includes(value);
}

export function tierConfig(tier: ModelTier, env: NodeJS.ProcessEnv = process.env): TierConfig {
  const prefix = `MODEL_${tier.toUpperCase()}`;
  const base = DEFAULTS[tier];
  const modelId = env[prefix]?.trim() || base.modelId;
  const effortRaw = env[`${prefix}_EFFORT`]?.trim().toLowerCase();
  const fallbackRaw = env[`${prefix}_FALLBACK`]?.trim();
  const effort = !supportsEffort(modelId) ? null : effortRaw && EFFORTS.has(effortRaw) ? (effortRaw as Effort) : (base.effort ?? "medium");
  return {
    tier,
    modelId,
    effort,
    fallbackModelId: fallbackRaw === "none" ? null : fallbackRaw || base.fallbackModelId
  };
}

/** The tier a run uses when its agent is not pinned: planning-type work on the planner, consults on triage. */
export function defaultTierForKind(kind: string): ModelTier {
  if (kind === "plan" || kind === "plan_report" || kind === "briefing") return "planner";
  if (kind === "consult") return "triage";
  return "worker";
}

// ── Capabilities (from the Claude API reference) ──────────────────────────────

/** Haiku 4.5 and older models reject `output_config.effort`. */
export function supportsEffort(modelId: string): boolean {
  return /^claude-(opus|sonnet|fable|mythos)-(5|4-[6-9])/.test(modelId);
}

/**
 * Models whose thinking blocks are bound to the conversation that produced them ("preserved thinking"): their
 * history must stay append-only, so old tool results are cleared server-side instead of trimmed client-side.
 */
export function bindsThinkingToConversation(modelId: string): boolean {
  return /^claude-(opus-5-5|sonnet-5-5|fable-5-1)/.test(modelId);
}

/** Models that take the server-side refusal fallback in its `"default"` form on the Claude API. */
export function supportsServerFallback(modelId: string): boolean {
  return /^claude-(opus-5-5|opus-5|sonnet-5-5|fable-5-1|fable-5)$/.test(modelId);
}
