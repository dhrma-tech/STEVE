import { prisma } from "@/lib/db/client";
import type { AgentTool, ToolContext } from "./types";

async function getToken(orgId: string): Promise<string | null> {
  try {
    const integration = await prisma.integration.findFirst({
      where: { organizationId: orgId, provider: "apify" }
    });
    if (integration?.configJson) {
      const cfg = JSON.parse(integration.configJson) as { token?: string };
      if (cfg.token) return cfg.token;
    }
  } catch { /* ignore */ }
  return process.env.APIFY_TOKEN ?? null;
}

function noToken() {
  return "Apify not configured. Add a token to the Apify integration or set APIFY_TOKEN.";
}

export const apifySearchProspectsTool: AgentTool = {
  definition: {
    name: "apify_search_prospects",
    description: "Search the web for prospects or leads using Apify's Google Search scraper. Returns titles and URLs.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query, e.g. 'SaaS founders looking for automation tools'" },
        maxItems: { type: "number", description: "Max results to return (default 10, max 20)" }
      },
      required: ["query"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const token = await getToken(ctx.orgId);
    if (!token) return noToken();
    const query = typeof input.query === "string" ? input.query.trim() : "";
    if (!query) return "Error: query is required";
    const maxItems = typeof input.maxItems === "number" ? Math.min(20, Math.max(1, input.maxItems)) : 10;
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=60`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queries: query, maxPagesPerQuery: 1, resultsPerPage: maxItems, outputPageTitle: true })
        }
      );
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Apify ${res.status}: ${err.slice(0, 200)}`);
      }
      const items = await res.json() as Array<{ title?: string; url?: string; description?: string }>;
      if (!Array.isArray(items) || !items.length) return `No results found for "${query}".`;
      return items
        .slice(0, maxItems)
        .map((r, i) => `${i + 1}. ${r.title ?? "Untitled"}\n   ${r.url ?? ""}\n   ${r.description?.slice(0, 100) ?? ""}`)
        .join("\n\n");
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const apifyRunActorTool: AgentTool = {
  definition: {
    name: "apify_run_actor",
    description: "Run any Apify actor with a custom input and get the dataset results.",
    input_schema: {
      type: "object",
      properties: {
        actorId: { type: "string", description: "Actor ID in format owner~actor-name, e.g. apify~web-scraper" },
        input: { type: "object", description: "JSON input object for the actor" }
      },
      required: ["actorId", "input"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const token = await getToken(ctx.orgId);
    if (!token) return noToken();
    const actorId = typeof input.actorId === "string" ? input.actorId.trim() : "";
    if (!actorId) return "Error: actorId is required";
    const actorInput = input.input && typeof input.input === "object" ? input.input as Record<string, unknown> : {};
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=120`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(actorInput)
        }
      );
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Apify ${res.status}: ${err.slice(0, 200)}`);
      }
      const items = await res.json() as unknown[];
      if (!Array.isArray(items) || !items.length) return "Actor ran but returned no items.";
      const preview = items.slice(0, 5).map((item, i) => `Item ${i + 1}: ${JSON.stringify(item).slice(0, 200)}`).join("\n");
      return `Actor returned ${items.length} item(s):\n${preview}${items.length > 5 ? `\n…and ${items.length - 5} more` : ""}`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};
