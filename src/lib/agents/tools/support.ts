import { prisma } from "@/lib/db/client";
import type { AgentTool, ToolContext } from "./types";

interface SupportConfig { apiKey: string; apiUrl: string }

async function getConfig(orgId: string): Promise<SupportConfig | null> {
  try {
    const integration = await prisma.integration.findFirst({
      where: { organizationId: orgId, provider: "support" }
    });
    if (integration?.configJson) {
      const cfg = JSON.parse(integration.configJson) as { apiKey?: string; apiUrl?: string };
      if (cfg.apiKey) return {
        apiKey: cfg.apiKey,
        apiUrl: cfg.apiUrl ?? "https://core-api.uk.plain.com/graphql/v1"
      };
    }
  } catch { /* ignore */ }
  const apiKey = process.env.PLAIN_API_KEY ?? null;
  return apiKey ? { apiKey, apiUrl: process.env.SUPPORT_API_URL ?? "https://core-api.uk.plain.com/graphql/v1" } : null;
}

function noConfig() {
  return "Support not configured. Add an API key to the Support integration or set PLAIN_API_KEY.";
}

async function plainGraphql(
  query: string,
  variables: Record<string, unknown>,
  config: SupportConfig
): Promise<unknown> {
  const res = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Plain API ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json() as { data?: unknown; errors?: Array<{ message: string }> };
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data.data;
}

export const supportListThreadsTool: AgentTool = {
  definition: {
    name: "support_list_threads",
    description: "List support threads from Plain.com inbox.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: todo, snoozed, or done" },
        limit: { type: "number", description: "Number of threads to return (default 10)" }
      }
    }
  },
  async execute(input, ctx: ToolContext) {
    const config = await getConfig(ctx.orgId);
    if (!config) return noConfig();
    const limit = typeof input.limit === "number" ? Math.min(25, Math.max(1, input.limit)) : 10;
    const status = typeof input.status === "string" && ["todo", "snoozed", "done"].includes(input.status)
      ? input.status.toUpperCase() : null;
    const query = `
      query ListThreads($first: Int!, $filters: ThreadsFilterInput) {
        threads(first: $first, filters: $filters) {
          edges {
            node {
              id
              title
              status
              createdAt { iso8601 }
              customer { emailAddress }
            }
          }
        }
      }
    `;
    try {
      const data = await plainGraphql(query, {
        first: limit,
        ...(status ? { filters: { statuses: [status] } } : {})
      }, config) as {
        threads?: { edges?: Array<{ node: { id: string; title: string; status: string; createdAt: { iso8601: string }; customer: { emailAddress?: string } } }> }
      };
      const edges = data.threads?.edges ?? [];
      if (!edges.length) return "No threads found.";
      return edges
        .map(e => `${e.node.id} | ${e.node.status} | ${e.node.customer.emailAddress ?? "unknown"} | "${e.node.title}" | ${e.node.createdAt.iso8601.slice(0, 10)}`)
        .join("\n");
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const supportCreateThreadTool: AgentTool = {
  definition: {
    name: "support_create_thread",
    description: "Create a new support thread in Plain.com for a customer.",
    input_schema: {
      type: "object",
      properties: {
        customerEmail: { type: "string", description: "Customer email address" },
        title: { type: "string", description: "Thread title / subject" },
        text: { type: "string", description: "Initial message text" }
      },
      required: ["customerEmail", "title", "text"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const config = await getConfig(ctx.orgId);
    if (!config) return noConfig();
    const customerEmail = typeof input.customerEmail === "string" ? input.customerEmail.trim() : "";
    const title = typeof input.title === "string" ? input.title.trim() : "";
    const text = typeof input.text === "string" ? input.text.trim() : "";
    if (!customerEmail || !title || !text) return "Error: customerEmail, title, and text are required";
    const mutation = `
      mutation CreateThread($input: CreateThreadInput!) {
        createThread(input: $input) {
          thread { id }
          error { message }
        }
      }
    `;
    try {
      const data = await plainGraphql(mutation, {
        input: {
          customerIdentifier: { emailAddress: customerEmail },
          title,
          components: [{ componentText: { text } }]
        }
      }, config) as { createThread?: { thread?: { id: string }; error?: { message: string } } };
      const result = data.createThread;
      if (result?.error?.message) throw new Error(result.error.message);
      return `Thread created (ID: ${result?.thread?.id ?? "?"}) for ${customerEmail}`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const supportReplyToThreadTool: AgentTool = {
  definition: {
    name: "support_reply_to_thread",
    description: "Reply to an existing support thread in Plain.com.",
    input_schema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Plain.com thread ID" },
        text: { type: "string", description: "Reply message text" }
      },
      required: ["threadId", "text"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const config = await getConfig(ctx.orgId);
    if (!config) return noConfig();
    const threadId = typeof input.threadId === "string" ? input.threadId.trim() : "";
    const text = typeof input.text === "string" ? input.text.trim() : "";
    if (!threadId || !text) return "Error: threadId and text are required";
    const mutation = `
      mutation ReplyToThread($input: ReplyToThreadInput!) {
        replyToThread(input: $input) {
          thread { id }
          error { message }
        }
      }
    `;
    try {
      const data = await plainGraphql(mutation, {
        input: {
          threadId,
          components: [{ componentText: { text } }]
        }
      }, config) as { replyToThread?: { thread?: { id: string }; error?: { message: string } } };
      const result = data.replyToThread;
      if (result?.error?.message) throw new Error(result.error.message);
      return `Reply sent to thread ${threadId}`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};
