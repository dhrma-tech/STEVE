import { prisma } from "@/lib/db/client";
import { renderHits, searchKnowledge } from "@/lib/knowledge/search";
import {
  agentScope,
  departmentScope,
  orgScope,
  recall,
  remember,
  REVIEW_BELOW_CONFIDENCE,
  scopesFor,
  visibleMemories
} from "@/lib/memory/store";
import type { AgentTool, ToolContext } from "./types";

/** The scopes the calling agent sees: the company, its department, its own notes. */
async function agentScopes(ctx: ToolContext) {
  const agent = await prisma.agent.findUnique({
    where: { id: ctx.agentId },
    select: { id: true, slug: true, department: { select: { slug: true, name: true } } }
  });
  if (!agent) return null;
  return { agent, scopes: scopesFor({ id: agent.id, departmentSlug: agent.department.slug }) };
}

export const memoryStoreTool: AgentTool = {
  definition: {
    name: "memory_store",
    description:
      "Save a durable fact so the team remembers it in later runs. Choose who needs it: 'org' for facts about the " +
      "company everyone should use (brand voice, ideal customer, pricing, decisions), 'department' for your " +
      "department's working knowledge, 'self' for your own notes. Saving an existing key replaces its value (the old " +
      "one is kept in history). Never store secrets; store where they live instead.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Short name, e.g. 'brand_voice', 'ideal_customer', 'github_repo'." },
        value: { type: "string", description: "The fact, in one or two sentences." },
        scope: { type: "string", enum: ["org", "department", "self"], description: "Who should know it. Default: self." },
        confidence: {
          type: "number",
          description: "0 to 1: how sure you are. Below 0.6 the founder reviews it before the team sees it."
        }
      },
      required: ["key", "value"]
    }
  },
  async execute(input, ctx) {
    const found = await agentScopes(ctx);
    if (!found) return "Error: agent not found";
    const scopeName = input.scope === "org" || input.scope === "department" ? input.scope : "self";
    const scope = scopeName === "org" ? orgScope : scopeName === "department" ? departmentScope(found.agent.department.slug) : agentScope(found.agent.id);
    const confidence = typeof input.confidence === "number" && Number.isFinite(input.confidence) ? Math.min(1, Math.max(0, input.confidence)) : null;
    const value = typeof input.value === "string" ? input.value : JSON.stringify(input.value ?? "");
    if (/(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value)) {
      return "Error: that looks like a secret. Store where the secret lives (for example 'Stripe key: in Env & Secrets'), never the secret itself.";
    }
    const proposed = confidence !== null && confidence < REVIEW_BELOW_CONFIDENCE;

    const result = await remember({
      orgId: ctx.orgId,
      scope,
      key: typeof input.key === "string" ? input.key : "",
      value,
      confidence,
      source: `agent:${found.agent.slug}`,
      status: proposed ? "proposed" : "active"
    });
    if ("skipped" in result) return `Not stored: ${result.skipped}.`;
    const where = scopeName === "org" ? "for the whole company" : scopeName === "department" ? `for the ${found.agent.department.name} department` : "in your own notes";
    if (proposed) return `Proposed "${result.memory.key}" ${where}. The founder will review it before the team relies on it.`;
    return result.previous !== null
      ? `Updated "${result.memory.key}" ${where} (was: ${result.previous.slice(0, 100)}).`
      : `Remembered "${result.memory.key}" ${where}.`;
  }
};

export const memoryRetrieveTool: AgentTool = {
  definition: {
    name: "memory_retrieve",
    description: "Look up one fact by key, from your own notes, your department's or the company's memory (nearest first).",
    input_schema: {
      type: "object",
      properties: { key: { type: "string", description: "Memory key to retrieve" } },
      required: ["key"]
    }
  },
  async execute(input, ctx) {
    const found = await agentScopes(ctx);
    if (!found) return "Error: agent not found";
    const entry = await recall(ctx.orgId, found.scopes, typeof input.key === "string" ? input.key : "");
    if (!entry) return `Nothing remembered under "${String(input.key ?? "")}". Try memory_list or search_knowledge.`;
    return `${entry.key}: ${entry.value}\n(${entry.scope}, last updated ${entry.updatedAt.toISOString()})`;
  }
};

export const memoryListTool: AgentTool = {
  definition: {
    name: "memory_list",
    description: "List the facts you can see: the company's, your department's and your own notes.",
    input_schema: { type: "object", properties: {} }
  },
  async execute(_input, ctx) {
    const found = await agentScopes(ctx);
    if (!found) return "Error: agent not found";
    const entries = await visibleMemories(ctx.orgId, found.scopes, 100);
    if (!entries.length) return "No memories stored yet.";
    const label = (scope: string) => (scope === orgScope ? "company" : scope.startsWith("department:") ? "department" : "own");
    return entries.map((e) => `- [${label(e.scope)}] ${e.key}: ${e.value.slice(0, 120)}${e.value.length > 120 ? "…" : ""}`).join("\n");
  }
};

export const searchKnowledgeTool: AgentTool = {
  definition: {
    name: "search_knowledge",
    description:
      "Search the company's knowledge: files (including the business plan), chat with the founder, what past runs " +
      "produced, and saved memory. Use it before asking the founder something the company may already have written down.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What you are looking for, in plain words." },
        limit: { type: "number", description: "How many results, 1 to 10. Default 5." }
      },
      required: ["query"]
    }
  },
  async execute(input, ctx) {
    const query = typeof input.query === "string" ? input.query : "";
    if (!query.trim()) return "Error: query is required";
    const found = await agentScopes(ctx);
    const hits = await searchKnowledge({
      orgId: ctx.orgId,
      query,
      limit: typeof input.limit === "number" ? Math.min(10, Math.max(1, Math.floor(input.limit))) : 5,
      memoryScopes: found?.scopes ?? [orgScope]
    });
    return renderHits(hits);
  }
};
