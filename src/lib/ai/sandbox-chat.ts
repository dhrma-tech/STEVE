import { ollamaChatSafe, OLLAMA_OFFLINE_MESSAGE } from "@/lib/ai/ollama";
import type { ChatMention } from "@/lib/chat/data";

export type ChatAgentSummary = {
  name: string;
  description: string | null;
  status: string;
  department: string | null;
  permissionMode: string | null;
  skills: string[];
};

export async function generateChatResponse({
  body,
  organizationName,
  threadKind,
  mentions,
  attachmentNames,
  agents = []
}: {
  body: string;
  organizationName: string;
  threadKind: string;
  mentions: ChatMention[];
  attachmentNames: string[];
  agents?: ChatAgentSummary[];
}): Promise<{ body: string; metadata: Record<string, unknown> }> {
  const threadLabel =
    threadKind === "task" ? "task discussion"
    : threadKind === "department" ? "department chat"
    : "company chat";

  const agentLines = agents.length
    ? `\n\nAgents in this organization:\n${agents.map((a) =>
        `- ${a.name}${a.department ? ` [${a.department}]` : ""}: ${a.description ?? "no description"}. Status: ${a.status}. Mode: ${a.permissionMode ?? "standard"}.${a.skills.length ? ` Skills: ${a.skills.join(", ")}.` : ""}`
      ).join("\n")}`
    : "";

  const system = [
    `You are Cofounder, an AI assistant for ${organizationName}.`,
    `You help the team plan work, create tasks, run agents, and make decisions.`,
    `This is a ${threadLabel}. Be concise and direct. Give actionable answers.`,
    agentLines,
    mentions.length ? `Relevant context: ${mentions.map((m) => m.label).join(", ")}.` : "",
    attachmentNames.length ? `Attached files: ${attachmentNames.join(", ")}.` : ""
  ].filter(Boolean).join(" ");

  const content = await ollamaChatSafe({ system, user: body });

  return content
    ? { body: content, metadata: { kind: "ai_response", provider: "ollama", status: "complete" } }
    : { body: OLLAMA_OFFLINE_MESSAGE, metadata: { kind: "ai_response", provider: "ollama", status: "error" } };
}
