import { prisma } from "@/lib/db/client";
import { startAgentRun } from "@/lib/agents/run-service";
import { AgentsPausedError } from "@/lib/agents/flags";
import type { ChatMessagePreparation } from "@/lib/chat/data";

const RUN_COMMAND = /^\/run(?:\s+([\s\S]+))?$/i;
const USAGE =
  "To have an agent do work, write `/run` followed by the instruction. Mention an agent or a department to choose who runs it, for example `/run @engineering build the pricing page`. In a task thread, `/run` runs that task's agent.";

export type ChatRunResponse = { body: string; metadata: Record<string, unknown> };

/** Returns the instruction after `/run`, "" when the command has no instruction, or null when the message is not a run command. */
export function parseRunCommand(body: string): string | null {
  const match = RUN_COMMAND.exec(body.trim());
  if (!match) return null;
  return (match[1] ?? "").trim();
}

/**
 * Handles `/run <instruction>` in chat: picks an agent, creates (or reuses) a task and
 * starts a real run through the same entry point as every other launch path.
 * Returns null for ordinary messages so the caller falls through to normal chat.
 */
export async function maybeRunFromChat({
  orgId,
  preparation
}: {
  orgId: string;
  preparation: ChatMessagePreparation;
}): Promise<ChatRunResponse | null> {
  const instruction = parseRunCommand(preparation.trimmedBody);
  if (instruction === null) return null;
  if (!instruction) return { body: USAGE, metadata: { kind: "run_usage" } };

  const { thread, mentions, userId } = preparation;

  const agent = await resolveAgent({ orgId, thread, mentions });
  if (!agent) {
    return {
      body: `I could not find an agent to run that. ${USAGE}`,
      metadata: { kind: "run_usage", reason: "no_agent" }
    };
  }

  const existingTaskId = thread.taskId;
  const task = existingTaskId
    ? await prisma.task.findFirst({ where: { id: existingTaskId, organizationId: orgId, archivedAt: null } })
    : await prisma.task.create({
        data: {
          organizationId: orgId,
          departmentId: agent.departmentId,
          agentId: agent.id,
          createdByUserId: userId,
          title: taskTitleFrom(instruction),
          description: instruction,
          type: "agent_task",
          status: "queued",
          priority: 1,
          metadataJson: JSON.stringify({ source: "chat", threadId: thread.id })
        }
      });
  if (!task) return { body: "That task no longer exists.", metadata: { kind: "run_error" } };

  try {
    const session = await startAgentRun({ orgId, taskId: task.id, agentId: agent.id, message: instruction });
    if (!session) return { body: "I could not start that run.", metadata: { kind: "run_error" } };

    return {
      body: `${agent.name} is on it: "${task.title}". Follow progress in the Tasks tab or the agent workspace.`,
      metadata: { kind: "agent_run_started", agentId: agent.id, taskId: task.id, sessionId: session.id }
    };
  } catch (error) {
    if (error instanceof AgentsPausedError) {
      return { body: error.message, metadata: { kind: "run_error", reason: "paused" } };
    }
    throw error;
  }
}

/** First line of the instruction, without leading @mentions, capped for the task list. */
export function taskTitleFrom(instruction: string): string {
  const firstLine = instruction.split(/\r?\n/)[0] ?? "";
  const withoutMentions = firstLine.replace(/^(?:@[\w-]+\s+)+/, "").trim();
  return (withoutMentions || firstLine.trim() || "Chat request").slice(0, 80);
}

async function resolveAgent({
  orgId,
  thread,
  mentions
}: {
  orgId: string;
  thread: ChatMessagePreparation["thread"];
  mentions: ChatMessagePreparation["mentions"];
}) {
  const activeAgent = (where: Record<string, unknown>) =>
    prisma.agent.findFirst({
      where: { organizationId: orgId, archivedAt: null, ...where },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
    });

  const agentMention = mentions.find((m) => m.type === "agent");
  if (agentMention) {
    const agent = await activeAgent({ id: agentMention.id });
    if (agent) return agent;
  }

  const departmentMention = mentions.find((m) => m.type === "department");
  if (departmentMention) {
    const agent = await activeAgent({ departmentId: departmentMention.id });
    if (agent) return agent;
  }

  const threadAgentId = thread.agentId ?? thread.task?.agentId ?? null;
  return threadAgentId ? activeAgent({ id: threadAgentId }) : null;
}
