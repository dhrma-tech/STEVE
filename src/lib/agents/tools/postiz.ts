import { prisma } from "@/lib/db/client";
import type { AgentTool } from "./types";

interface PostizConfig { apiUrl: string; apiKey: string }

async function getConfig(orgId: string): Promise<PostizConfig | null> {
  try {
    const integration = await prisma.integration.findFirst({
      where: { organizationId: orgId, provider: "postiz" }
    });
    if (integration?.configJson) {
      const cfg = JSON.parse(integration.configJson) as { apiUrl?: string; apiKey?: string };
      if (cfg.apiUrl && cfg.apiKey) return { apiUrl: cfg.apiUrl, apiKey: cfg.apiKey };
    }
  } catch { /* ignore */ }
  const apiKey = process.env.POSTIZ_API_KEY;
  const apiUrl = process.env.POSTIZ_API_URL ?? "https://app.postiz.com/api";
  return apiKey ? { apiUrl, apiKey } : null;
}

function noConfig() {
  return "Postiz not configured. Add API credentials to the Postiz integration or set POSTIZ_API_KEY.";
}

export const postizCreatePostTool: AgentTool = {
  definition: {
    name: "postiz_create_post",
    description: "Create a social media post draft in Postiz.",
    input_schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Post content text" },
        platforms: {
          type: "array",
          items: { type: "string" },
          description: "Target platforms, e.g. [\"twitter\", \"linkedin\"]"
        }
      },
      required: ["content"]
    }
  },
  async execute(input, ctx) {
    const config = await getConfig(ctx.orgId);
    if (!config) return noConfig();
    const content = typeof input.content === "string" ? input.content : "";
    const platforms = Array.isArray(input.platforms) ? (input.platforms as string[]) : ["twitter"];
    try {
      const res = await fetch(`${config.apiUrl}/posts`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content, platforms, status: "draft" })
      });
      if (!res.ok) return `Error: Postiz responded with ${res.status}`;
      const post = await res.json() as { id?: string };
      return `Post draft created (ID: ${post.id ?? "unknown"}) for ${platforms.join(", ")}.`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const postizSchedulePostTool: AgentTool = {
  definition: {
    name: "postiz_schedule_post",
    description: "Schedule an existing Postiz post draft for publishing.",
    input_schema: {
      type: "object",
      properties: {
        postId: { type: "string", description: "Post ID to schedule" },
        scheduledAt: { type: "string", description: "ISO 8601 datetime to publish, e.g. 2026-06-15T10:00:00Z" }
      },
      required: ["postId", "scheduledAt"]
    }
  },
  async execute(input, ctx) {
    const config = await getConfig(ctx.orgId);
    if (!config) return noConfig();
    const postId = typeof input.postId === "string" ? input.postId : "";
    const scheduledAt = typeof input.scheduledAt === "string" ? input.scheduledAt : "";
    if (!postId || !scheduledAt) return "Error: postId and scheduledAt are required";
    try {
      const res = await fetch(`${config.apiUrl}/posts/${encodeURIComponent(postId)}/schedule`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt })
      });
      if (!res.ok) return `Error: Postiz responded with ${res.status}`;
      return `Post ${postId} scheduled for ${scheduledAt}.`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const postizListPostsTool: AgentTool = {
  definition: {
    name: "postiz_list_posts",
    description: "List recent posts in Postiz.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: draft, scheduled, published (optional)" }
      }
    }
  },
  async execute(input, ctx) {
    const config = await getConfig(ctx.orgId);
    if (!config) return noConfig();
    const statusFilter = typeof input.status === "string" ? `?status=${encodeURIComponent(input.status)}` : "";
    try {
      const res = await fetch(`${config.apiUrl}/posts${statusFilter}`, {
        headers: { "Authorization": `Bearer ${config.apiKey}` }
      });
      if (!res.ok) return `Error: Postiz responded with ${res.status}`;
      const posts = await res.json() as Array<{ id?: string; content?: string; status?: string; scheduledAt?: string }>;
      if (!posts.length) return "No posts found.";
      return posts
        .slice(0, 5)
        .map(p => `[${p.id ?? "?"}] ${p.status ?? "?"} — ${(p.content ?? "").slice(0, 80)}${(p.content?.length ?? 0) > 80 ? "…" : ""}`)
        .join("\n");
    } catch (err) { return `Error: ${String(err)}`; }
  }
};
