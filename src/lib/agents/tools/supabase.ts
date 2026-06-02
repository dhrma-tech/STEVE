import { prisma } from "@/lib/db/client";
import type { AgentTool, ToolContext } from "./types";

interface SupabaseConfig { projectRef: string; serviceRoleKey: string; projectUrl: string }

async function getConfig(orgId: string): Promise<SupabaseConfig | null> {
  try {
    const integration = await prisma.integration.findFirst({
      where: { organizationId: orgId, provider: "supabase" }
    });
    if (integration?.configJson) {
      const cfg = JSON.parse(integration.configJson) as { projectRef?: string; serviceRoleKey?: string; url?: string };
      if (cfg.projectRef && cfg.serviceRoleKey) return {
        projectRef: cfg.projectRef,
        serviceRoleKey: cfg.serviceRoleKey,
        projectUrl: cfg.url ?? `https://${cfg.projectRef}.supabase.co`
      };
    }
  } catch { /* ignore */ }
  const projectRef = process.env.SUPABASE_PROJECT_REF ?? null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  if (projectRef && key) return {
    projectRef,
    serviceRoleKey: key,
    projectUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? `https://${projectRef}.supabase.co`
  };
  return null;
}

function noConfig() {
  return "Supabase not configured. Add project credentials to the Supabase integration or set SUPABASE_PROJECT_REF and SUPABASE_SERVICE_ROLE_KEY.";
}

export const supabaseListTablesTool: AgentTool = {
  definition: {
    name: "supabase_list_tables",
    description: "List tables in the Supabase project database.",
    input_schema: { type: "object", properties: {} }
  },
  async execute(_input, ctx: ToolContext) {
    const config = await getConfig(ctx.orgId);
    if (!config) return noConfig();
    try {
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${config.projectRef}/database/tables`,
        { headers: { "Authorization": `Bearer ${config.serviceRoleKey}` } }
      );
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Supabase Management API ${res.status}: ${err.slice(0, 200)}`);
      }
      const tables = await res.json() as Array<{ name: string; schema: string }>;
      const publicTables = tables.filter(t => t.schema === "public");
      if (!publicTables.length) return "No tables found in the public schema.";
      return `Tables (${publicTables.length}):\n${publicTables.map(t => `  - ${t.name}`).join("\n")}`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const supabaseRunQueryTool: AgentTool = {
  definition: {
    name: "supabase_run_query",
    description: "Run a SELECT query against the Supabase database. Only read queries are permitted.",
    input_schema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL SELECT statement to execute" }
      },
      required: ["sql"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const config = await getConfig(ctx.orgId);
    if (!config) return noConfig();
    const sql = typeof input.sql === "string" ? input.sql.trim() : "";
    if (!sql) return "Error: sql is required";
    if (!sql.toUpperCase().startsWith("SELECT")) return "Only SELECT queries are allowed for safety.";
    try {
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${config.projectRef}/database/query`,
        {
          method: "POST",
          headers: { "Authorization": `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: sql })
        }
      );
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Supabase ${res.status}: ${err.slice(0, 200)}`);
      }
      const rows = await res.json() as unknown[];
      if (!Array.isArray(rows) || !rows.length) return "Query returned no rows.";
      const preview = rows.slice(0, 20);
      return `${rows.length} row(s) returned (showing ${preview.length}):\n${preview.map((r, i) => `${i + 1}: ${JSON.stringify(r).slice(0, 150)}`).join("\n")}`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const supabaseCreateBucketTool: AgentTool = {
  definition: {
    name: "supabase_create_bucket",
    description: "Create a Supabase Storage bucket.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Bucket name (lowercase, alphanumeric, hyphens)" },
        public: { type: "boolean", description: "Whether the bucket is publicly accessible (default false)" }
      },
      required: ["name"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const config = await getConfig(ctx.orgId);
    if (!config) return noConfig();
    const name = typeof input.name === "string" ? input.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") : "";
    if (!name) return "Error: name is required";
    const isPublic = typeof input.public === "boolean" ? input.public : false;
    try {
      const res = await fetch(`${config.projectUrl}/storage/v1/bucket`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.serviceRoleKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id: name, name, public: isPublic })
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Supabase Storage ${res.status}: ${err.slice(0, 200)}`);
      }
      return `Bucket '${name}' created (public: ${isPublic})`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};
