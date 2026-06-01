import { ollamaChatSafe } from "@/lib/ai/ollama";
import { anthropicChat } from "@/lib/ai/anthropic-client";
import { openaiChat } from "@/lib/ai/openai-client";

export type ModelProvider = "anthropic" | "openai" | "ollama";

export interface ModelConfig {
  provider: ModelProvider;
  modelId: string;
  supportsTools: boolean;
  contextWindow: number;
}

const MODEL_MAP: Record<string, ModelConfig> = {
  "claude-sonnet-sandbox": {
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    supportsTools: true,
    contextWindow: 200_000,
  },
  "gpt-5.4-sandbox": {
    provider: "openai",
    modelId: "gpt-4o",
    supportsTools: true,
    contextWindow: 128_000,
  },
  "gpt-5.4-mini-sandbox": {
    provider: "openai",
    modelId: "gpt-4o-mini",
    supportsTools: true,
    contextWindow: 128_000,
  },
  "local": {
    provider: "ollama",
    modelId: "mistral:latest",
    supportsTools: false,
    contextWindow: 32_000,
  },
};

export function resolveModel(agentModel: string | null | undefined): ModelConfig {
  return MODEL_MAP[agentModel ?? "local"] ?? MODEL_MAP["local"]!;
}

/** Unified chat call — routes to the correct provider, falls back to Ollama if key is missing. */
export async function callModel({
  agentModel,
  system,
  user,
}: {
  agentModel: string | null | undefined;
  system: string;
  user: string;
}): Promise<string> {
  const config = resolveModel(agentModel);

  if (config.provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("[model-router] ANTHROPIC_API_KEY not set — falling back to Ollama");
      return ollamaChatSafe({ system, user });
    }
    return anthropicChat({ system, user, modelId: config.modelId, apiKey });
  }

  if (config.provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("[model-router] OPENAI_API_KEY not set — falling back to Ollama");
      return ollamaChatSafe({ system, user });
    }
    return openaiChat({ system, user, modelId: config.modelId, apiKey });
  }

  return ollamaChatSafe({ system, user });
}
