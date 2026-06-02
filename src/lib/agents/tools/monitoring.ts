import { prisma } from "@/lib/db/client";
import type { AgentTool, ToolContext } from "./types";

async function getPostHogKey(orgId: string): Promise<string | null> {
  try {
    const integration = await prisma.integration.findFirst({
      where: { organizationId: orgId, provider: "posthog" }
    });
    if (integration?.configJson) {
      const cfg = JSON.parse(integration.configJson) as { apiKey?: string };
      if (cfg.apiKey) return cfg.apiKey;
    }
  } catch { /* ignore */ }
  return process.env.POSTHOG_API_KEY ?? null;
}

async function getSentryToken(orgId: string): Promise<string | null> {
  try {
    const integration = await prisma.integration.findFirst({
      where: { organizationId: orgId, provider: "sentry" }
    });
    if (integration?.configJson) {
      const cfg = JSON.parse(integration.configJson) as { authToken?: string };
      if (cfg.authToken) return cfg.authToken;
    }
  } catch { /* ignore */ }
  return process.env.SENTRY_AUTH_TOKEN ?? null;
}

export const posthogGetEventsTool: AgentTool = {
  definition: {
    name: "posthog_get_events",
    description: "Fetch recent events from PostHog analytics.",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "PostHog project ID (numeric)" },
        limit: { type: "number", description: "Number of events to return (default 20, max 100)" }
      },
      required: ["projectId"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const key = await getPostHogKey(ctx.orgId);
    if (!key) return "PostHog not configured. Add an API key to the PostHog integration or set POSTHOG_API_KEY.";
    const projectId = typeof input.projectId === "string" ? input.projectId.trim() : String(input.projectId ?? "");
    if (!projectId) return "Error: projectId is required";
    const limit = typeof input.limit === "number" ? Math.min(100, Math.max(1, input.limit)) : 20;
    try {
      const res = await fetch(
        `https://app.posthog.com/api/projects/${projectId}/events/?limit=${limit}`,
        { headers: { "Authorization": `Bearer ${key}` } }
      );
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`PostHog ${res.status}: ${err.slice(0, 200)}`);
      }
      const data = await res.json() as {
        results?: Array<{ event: string; distinct_id: string; timestamp: string; properties?: Record<string, unknown> }>
      };
      const events = data.results ?? [];
      if (!events.length) return "No events found.";
      return events
        .map(e => `${e.timestamp.slice(0, 19)} | ${e.event} | ${e.distinct_id.slice(0, 20)}`)
        .join("\n");
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const sentryListIssuesTool: AgentTool = {
  definition: {
    name: "sentry_list_issues",
    description: "List recent error issues from Sentry.",
    input_schema: {
      type: "object",
      properties: {
        organizationSlug: { type: "string", description: "Sentry organization slug" },
        projectSlug: { type: "string", description: "Optional Sentry project slug to filter by" },
        limit: { type: "number", description: "Number of issues to return (default 10, max 25)" }
      },
      required: ["organizationSlug"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const token = await getSentryToken(ctx.orgId);
    if (!token) return "Sentry not configured. Add an auth token to the Sentry integration or set SENTRY_AUTH_TOKEN.";
    const orgSlug = typeof input.organizationSlug === "string" ? input.organizationSlug.trim() : "";
    if (!orgSlug) return "Error: organizationSlug is required";
    const limit = typeof input.limit === "number" ? Math.min(25, Math.max(1, input.limit)) : 10;
    const projectFilter = typeof input.projectSlug === "string" && input.projectSlug.trim()
      ? `&project=${encodeURIComponent(input.projectSlug.trim())}` : "";
    try {
      const res = await fetch(
        `https://sentry.io/api/0/organizations/${encodeURIComponent(orgSlug)}/issues/?limit=${limit}${projectFilter}`,
        { headers: { "Authorization": `Bearer ${token}` } }
      );
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Sentry ${res.status}: ${err.slice(0, 200)}`);
      }
      const issues = await res.json() as Array<{
        title: string; culprit?: string; count: string; lastSeen: string; level: string
      }>;
      if (!Array.isArray(issues) || !issues.length) return "No issues found.";
      return issues
        .map(i => `[${i.level.toUpperCase()}] ${i.title}\n  culprit: ${i.culprit ?? "unknown"} | occurrences: ${i.count} | last: ${i.lastSeen.slice(0, 19)}`)
        .join("\n\n");
    } catch (err) { return `Error: ${String(err)}`; }
  }
};
