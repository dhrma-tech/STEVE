import { getOrgCredential, globalCredentialsAllowed, integrationSettings } from "@/lib/security/vault";

import type { AgentTool, ToolContext } from "./types";

interface SupabaseConfig {
  projectRef: string;
  serviceRoleKey: string;
  projectUrl: string;
  // Management API personal access token (from supabase.com/dashboard/account/tokens)
  // Required for supabase_run_query. Falls back to SUPABASE_ACCESS_TOKEN env var.
  accessToken: string | null;
}

async function getConfig(orgId: string): Promise<SupabaseConfig | null> {
  const settings = await integrationSettings(orgId, "supabase");
  const allowGlobal = globalCredentialsAllowed();
  const projectRef = (typeof settings.projectRef === "string" && settings.projectRef) || (allowGlobal ? process.env.SUPABASE_PROJECT_REF ?? null : null);
  const serviceRoleKey = await getOrgCredential(orgId, "supabase", "serviceRoleKey", "SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = await getOrgCredential(orgId, "supabase", "accessToken", "SUPABASE_ACCESS_TOKEN");
  if (!projectRef || !serviceRoleKey) return null;
  const url = typeof settings.url === "string" && settings.url ? settings.url : allowGlobal ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined;
  return { projectRef, serviceRoleKey, projectUrl: url ?? `https://${projectRef}.supabase.co`, accessToken };
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
      // pg-meta API: accessible with service role key, no management token needed
      const res = await fetch(
        `${config.projectUrl}/pg-meta/v0/tables?schema=public`,
        {
          headers: {
            "apikey": config.serviceRoleKey,
            "Authorization": `Bearer ${config.serviceRoleKey}`
          }
        }
      );
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Supabase pg-meta ${res.status}: ${err.slice(0, 200)}`);
      }
      const tables = await res.json() as Array<{ name: string; schema: string }>;
      if (!tables.length) return "No tables found in the public schema.";
      return `Tables (${tables.length}):\n${tables.map(t => `  - ${t.name}`).join("\n")}`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const supabaseRunQueryTool: AgentTool = {
  definition: {
    name: "supabase_run_query",
    description: "Run a SELECT query against the Supabase database. Requires a Supabase Management API access token (from supabase.com/dashboard/account/tokens) set as SUPABASE_ACCESS_TOKEN or accessToken in the integration config.",
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
    if (!config.accessToken) {
      return "supabase_run_query requires a Management API access token. Set SUPABASE_ACCESS_TOKEN (generate at supabase.com/dashboard/account/tokens) or add accessToken to the Supabase integration config.";
    }
    const sql = typeof input.sql === "string" ? input.sql.trim() : "";
    if (!sql) return "Error: sql is required";
    if (!sql.toUpperCase().startsWith("SELECT")) return "Only SELECT queries are allowed for safety.";
    try {
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${config.projectRef}/database/query`,
        {
          method: "POST",
          // Management API /database/query requires the personal access token, not service role key
          headers: { "Authorization": `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: sql })
        }
      );
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Supabase Management API ${res.status}: ${err.slice(0, 200)}`);
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
