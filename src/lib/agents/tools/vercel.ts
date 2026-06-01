import { prisma } from "@/lib/db/client";
import type { AgentTool } from "./types";

async function getToken(orgId: string): Promise<string | null> {
  try {
    const integration = await prisma.integration.findFirst({
      where: { organizationId: orgId, provider: "vercel" }
    });
    if (integration?.configJson) {
      const cfg = JSON.parse(integration.configJson) as { token?: string };
      if (cfg.token) return cfg.token;
    }
  } catch { /* ignore */ }
  return process.env.VERCEL_TOKEN ?? null;
}

async function vercelFetch(path: string, token: string): Promise<unknown> {
  const res = await fetch(`https://api.vercel.com${path}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vercel ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function noToken() {
  return "Vercel not configured. Add a token to the Vercel integration or set VERCEL_TOKEN.";
}

export const vercelListDeploymentsTool: AgentTool = {
  definition: {
    name: "vercel_list_deployments",
    description: "List recent Vercel deployments.",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Filter by Vercel project ID (optional)" },
        limit: { type: "number", description: "Max results to return (default: 5)" }
      }
    }
  },
  async execute(input, ctx) {
    const token = await getToken(ctx.orgId);
    if (!token) return noToken();
    const limit = typeof input.limit === "number" ? Math.min(input.limit, 20) : 5;
    const projectFilter = typeof input.projectId === "string" ? `&projectId=${encodeURIComponent(input.projectId)}` : "";
    try {
      const data = await vercelFetch(`/v6/deployments?limit=${limit}${projectFilter}`, token) as {
        deployments?: Array<{ uid: string; url: string; state: string; name: string; createdAt: number }>
      };
      const deployments = data.deployments ?? [];
      if (!deployments.length) return "No deployments found.";
      return deployments
        .map(d => `${d.name} — ${d.state} — https://${d.url}\n  (${new Date(d.createdAt).toISOString()})`)
        .join("\n");
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const vercelGetDeploymentTool: AgentTool = {
  definition: {
    name: "vercel_get_deployment",
    description: "Get details of a specific Vercel deployment.",
    input_schema: {
      type: "object",
      properties: {
        deploymentId: { type: "string", description: "Deployment UID or URL" }
      },
      required: ["deploymentId"]
    }
  },
  async execute(input, ctx) {
    const token = await getToken(ctx.orgId);
    if (!token) return noToken();
    const id = typeof input.deploymentId === "string" ? input.deploymentId : "";
    try {
      const d = await vercelFetch(`/v13/deployments/${encodeURIComponent(id)}`, token) as {
        uid: string; url: string; state: string; name: string; readyState: string
      };
      return `Name: ${d.name}\nState: ${d.state} / ${d.readyState}\nURL: https://${d.url}\nUID: ${d.uid}`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const vercelTriggerDeployTool: AgentTool = {
  definition: {
    name: "vercel_trigger_deploy",
    description: "Trigger a new deployment via a Vercel deploy hook URL.",
    input_schema: {
      type: "object",
      properties: {
        hookUrl: { type: "string", description: "Vercel deploy hook URL (must start with https://api.vercel.com)" }
      },
      required: ["hookUrl"]
    }
  },
  async execute(input) {
    const hookUrl = typeof input.hookUrl === "string" ? input.hookUrl : "";
    if (!hookUrl.startsWith("https://api.vercel.com/v1/integrations/deploy/")) {
      return "Error: hookUrl must be a valid Vercel deploy hook (https://api.vercel.com/v1/integrations/deploy/…)";
    }
    try {
      const res = await fetch(hookUrl, { method: "POST" });
      if (!res.ok) return `Error: deploy hook responded with ${res.status}`;
      return "Deployment triggered successfully via deploy hook.";
    } catch (err) { return `Error: ${String(err)}`; }
  }
};
