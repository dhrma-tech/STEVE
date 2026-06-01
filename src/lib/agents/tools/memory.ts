import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { AgentTool } from "./types";

// File-system backed memory for Phase 2.
// Phase 6 adds AgentMemory to the DB schema; at that point update these
// handlers to use prisma.agentMemory instead.

function memoryDir(agentId: string) {
  return path.join(os.tmpdir(), "steve-sessions", "memory", agentId);
}

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
    const dir = memoryDir(ctx.agentId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, `${key}.json`),
      JSON.stringify({ key, value, updatedAt: new Date().toISOString() }),
      "utf-8"
    );
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
    try {
      const raw = await fs.readFile(path.join(memoryDir(ctx.agentId), `${key}.json`), "utf-8");
      const entry = JSON.parse(raw) as { key: string; value: string; updatedAt: string };
      return `${entry.key}: ${entry.value}\n(last updated: ${entry.updatedAt})`;
    } catch {
      return `Memory key "${key}" not found.`;
    }
  }
};

export const memoryListTool: AgentTool = {
  definition: {
    name: "memory_list",
    description: "List all keys currently stored in agent memory.",
    input_schema: { type: "object", properties: {} }
  },
  async execute(_input, ctx) {
    const dir = memoryDir(ctx.agentId);
    try {
      await fs.mkdir(dir, { recursive: true });
      const files = await fs.readdir(dir);
      const keys = files.filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, ""));
      if (!keys.length) return "No memories stored yet.";
      const entries = await Promise.all(
        keys.map(async (k) => {
          try {
            const raw = await fs.readFile(path.join(dir, `${k}.json`), "utf-8");
            const e = JSON.parse(raw) as { value: string };
            return `- ${k}: ${e.value.slice(0, 80)}${e.value.length > 80 ? "…" : ""}`;
          } catch {
            return `- ${k}: (unreadable)`;
          }
        })
      );
      return entries.join("\n");
    } catch {
      return "No memories stored yet.";
    }
  }
};
