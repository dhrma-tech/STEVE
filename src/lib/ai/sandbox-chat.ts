import type { ChatMention } from "@/lib/chat/data";

export function generateSandboxChatResponse({
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
}) {
  const cleanBody = body.trim();
  const mentionedDepartments = mentions.filter((mention) => mention.type === "department");
  const mentionSummary = mentionedDepartments.length
    ? mentionedDepartments.map((mention) => mention.label).join(", ")
    : "the active company context";
  const attachmentSummary = attachmentNames.length
    ? ` I attached ${attachmentNames.length} file${attachmentNames.length === 1 ? "" : "s"} to this thread context.`
    : "";
  const focus = threadKind === "task" ? "task thread" : threadKind === "department" ? "department thread" : "Cofounder thread";

  return {
    body: `<thinking>\nContext checked: ${organizationName}, ${focus}, ${mentionSummary}.\n</thinking>\n\nI read your note: "${truncate(cleanBody, 140)}"\n\nHere is the next useful move:\n- Keep ${mentionSummary} in the loop.\n- Convert any concrete decision into a task if it needs execution.\n- Use attached files as source context before changing workspace state.${attachmentSummary}\n\n\`\`\`plan\n1. Clarify the target outcome.\n2. Assign the right department or agent.\n3. Run the smallest verifiable next step.\n\`\`\``,
    metadata: {
      kind: "ai_response",
      provider: "sandbox",
      status: "complete",
      transport: "request_response_sse_ready",
      thinkingVisible: true,
      mentionKeys: mentions.map((mention) => mention.key),
      attachmentNames
    }
  };
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1).trim()}...`;
}
