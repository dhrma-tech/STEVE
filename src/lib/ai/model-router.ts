import { defaultTierForKind, isModelTier, supportsEffort, tierConfig, type Effort, type ModelTier } from "./model-tiers";

export type ModelProvider = "anthropic" | "openai" | "ollama";

export interface ModelConfig {
  provider: ModelProvider;
  modelId: string;
  supportsTools: boolean;
  contextWindow: number;
}

/**
 * The model choices an agent can be pinned to (Agent.model). `claude-sonnet-sandbox` is the historical value for
 * "Claude, default": it is not a pin, so those agents use their tier (see model-tiers.ts).
 */
export const TIERED_DEFAULT = "claude-sonnet-sandbox";

const MODEL_MAP: Record<string, ModelConfig> = {
  "claude-opus-5-5": { provider: "anthropic", modelId: "claude-opus-5-5", supportsTools: true, contextWindow: 1_000_000 },
  "claude-sonnet-5-5": { provider: "anthropic", modelId: "claude-sonnet-5-5", supportsTools: true, contextWindow: 1_000_000 },
  "claude-haiku-4-5": { provider: "anthropic", modelId: "claude-haiku-4-5", supportsTools: true, contextWindow: 200_000 },
  "gpt-5.4-sandbox": { provider: "openai", modelId: "gpt-4o", supportsTools: true, contextWindow: 128_000 },
  "gpt-5.4-mini-sandbox": { provider: "openai", modelId: "gpt-4o-mini", supportsTools: true, contextWindow: 128_000 },
  local: { provider: "ollama", modelId: "mistral:latest", supportsTools: false, contextWindow: 32_000 }
};

/** A pinned model by its Agent.model value, or null when the agent is not pinned. */
export function resolveModel(agentModel: string | null | undefined): ModelConfig | null {
  if (!agentModel || agentModel === TIERED_DEFAULT) return null;
  return MODEL_MAP[agentModel] ?? null;
}

export type RunModel = {
  provider: ModelProvider;
  modelId: string;
  tier: ModelTier | null;
  effort: Effort | null;
  fallbackModelId: string | null;
};

/**
 * The model a run uses: the agent's pinned model if it has one, otherwise its tier (Agent.modelTier), otherwise the
 * default tier for the kind of run. An unknown pinned value falls back to the tier rather than failing the run.
 */
export function resolveRunModel(params: { agentModel: string | null | undefined; agentTier: string | null | undefined; kind: string }): RunModel {
  const pinned = resolveModel(params.agentModel);
  if (pinned) {
    return {
      provider: pinned.provider,
      modelId: pinned.modelId,
      tier: null,
      // A pinned Claude model gets the effort of the tier that uses it, when it takes effort at all.
      effort: pinned.provider === "anthropic" ? effortFor(pinned.modelId) : null,
      fallbackModelId: null
    };
  }
  const tier = isModelTier(params.agentTier) ? params.agentTier : defaultTierForKind(params.kind);
  const config = tierConfig(tier);
  return { provider: "anthropic", modelId: config.modelId, tier, effort: config.effort, fallbackModelId: config.fallbackModelId };
}

function effortFor(modelId: string): Effort | null {
  if (!supportsEffort(modelId)) return null;
  for (const tier of ["planner", "worker", "triage"] as const) {
    const config = tierConfig(tier);
    if (config.modelId === modelId) return config.effort;
  }
  return "medium";
}
