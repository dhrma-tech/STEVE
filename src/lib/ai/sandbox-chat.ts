import { ollamaChatSafe, OLLAMA_OFFLINE_MESSAGE } from "@/lib/ai/ollama";
import type { ChatMention } from "@/lib/chat/data";

export async function generateChatResponse({
  body,
  organizationName,
  threadKind,
  mentions,
  attachmentNames
}: {
  body: string;
  organizationName: string;
  threadKind: string;
  mentions: ChatMention[];
  attachmentNames: string[];
}): Promise<{ body: string; metadata: Record<string, unknown> }> {
  const threadLabel =
    threadKind === "task" ? "task discussion"
    : threadKind === "department" ? "department chat"
    : "company chat";

  const system = [
    `You are Cofounder, an AI assistant for ${organizationName}.`,
    `You help the team plan work, create tasks, run agents, and make decisions.`,
    `This is a ${threadLabel}. Be concise and direct. Give actionable answers.`,
    mentions.length ? `Relevant: ${mentions.map((m) => m.label).join(", ")}.` : "",
    attachmentNames.length ? `Files: ${attachmentNames.join(", ")}.` : ""
  ].filter(Boolean).join(" ");

  const content = await ollamaChatSafe({ system, user: body });

  return content
    ? { body: content, metadata: { kind: "ai_response", provider: "ollama", status: "complete" } }
    : { body: OLLAMA_OFFLINE_MESSAGE, metadata: { kind: "ai_response", provider: "ollama", status: "error" } };
}
