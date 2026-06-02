import { prisma } from "@/lib/db/client";
import type { AgentTool } from "./types";

function safeKey(key: string) {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
}

export const memoryStoreTool: AgentTool = {
  definition: {
    name: "memory_store",
    description: "Store a key-value fact in persistent agent memory across sessions. Use for preferences, decisions, or recurring context.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Memory key (e.g. 'preferred_stack', 'github_repo')" },
        value: { type: "string", description: "Value to remember" }
      },
      required: ["key", "value"]
    }
  },
  async execute(input, ctx) {
    const key = safeKey(typeof input.key === "string" ? input.key : "");
    const value = typeof input.value === "string" ? input.value : JSON.stringify(input.value);
    if (!key) return "Error: key is required";

    await prisma.agentMemory.upsert({
      where: { agentId_key: { agentId: ctx.agentId, key } },
      update: { value },
      create: { agentId: ctx.agentId, key, value }
    });

    return `Memory stored: ${key} = ${value.slice(0, 100)}${value.length > 100 ? "…" : ""}`;
  }
};

export const memoryRetrieveTool: AgentTool = {
  definition: {
    name: "memory_retrieve",
    description: "Retrieve a specific value from agent memory by key.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Memory key to retrieve" }
      },
      required: ["key"]
    }
  },
  async execute(input, ctx) {
    const key = safeKey(typeof input.key === "string" ? input.key : "");
    if (!key) return "Error: key is required";

    const entry = await prisma.agentMemory.findUnique({
      where: { agentId_key: { agentId: ctx.agentId, key } }
    });

    if (!entry) return `Memory key "${key}" not found.`;
    return `${entry.key}: ${entry.value}\n(last updated: ${entry.updatedAt.toISOString()})`;
  }
};

export const memoryListTool: AgentTool = {
  definition: {
    name: "memory_list",
    description: "List all keys currently stored in agent memory.",
    input_schema: { type: "object", properties: {} }
  },
  async execute(_input, ctx) {
    const entries = await prisma.agentMemory.findMany({
      where: { agentId: ctx.agentId },
      orderBy: { updatedAt: "desc" }
    });

    if (!entries.length) return "No memories stored yet.";
    return entries
      .map(e => `- ${e.key}: ${e.value.slice(0, 80)}${e.value.length > 80 ? "…" : ""}`)
      .join("\n");
  }
};
