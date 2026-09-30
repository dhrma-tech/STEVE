import { prisma } from "@/lib/db/client";
import { maybeExtractAndSaveBrandKit } from "../prompt";
import type { RunBudget } from "../policy/limits";
import { ACTIVE_STATUSES } from "./types";
import type { Run } from "./run-store";

export type Outcome = "completed" | "failed" | "cancelled";

export function usageNote(budget: RunBudget): string {
  return `Usage: ~${budget.spentCents.toFixed(2)}¢ estimated, ${budget.totalTokens} tokens, ${budget.steps} model turns, ${budget.toolCalls} tool calls.`;
}

/**
 * Close out the records a person sees for a run: the session, the task, the agent's status, the task chat and,
 * for design work, the brand kit. Runs once, when the run reaches a final state.
 */
export async function finalizeRunRecords(params: {
  run: Run;
  agentName: string;
  outcome: Outcome;
  output: string;
  errorMessage: string | null;
  usage: string | null;
}) {
  const { run, agentName, outcome, output, errorMessage, usage } = params;
  const now = new Date();
  const elapsedMs = Math.max(1000, now.getTime() - (run.startedAt ?? run.createdAt).getTime());
  const replayUrl = `/org/${run.organizationId}/canvas?session=${run.sessionId}&replay=1`;
  const label = outcome === "completed" ? "Completed" : outcome === "cancelled" ? "Cancelled" : "Error";

  const scratchpad = [
    `# ${agentName} — ${label}`,
    "",
    ...(errorMessage ? [`**Error:** ${errorMessage}`, ""] : []),
    output.trim() || "(no output generated)",
    ...(usage ? ["", "---", usage] : [])
  ].join("\n");

  const sessionStatus = outcome === "completed" ? "completed" : outcome === "cancelled" ? "canceled" : "error";
  await prisma.taskSession.update({
    where: { id: run.sessionId },
    data: { status: sessionStatus, finishedAt: now, elapsedMs, scratchpad, replayUrl }
  });

  if (run.taskId && outcome !== "cancelled") {
    await prisma.task.update({
      where: { id: run.taskId },
      data: { status: outcome === "completed" ? "ready_to_review" : "todo" }
    });
  }

  // The agent is idle only when none of its other runs are still going.
  const others = await prisma.run.count({
    where: { agentId: run.agentId, id: { not: run.id }, status: { in: [...ACTIVE_STATUSES] } }
  });
  if (others === 0) await prisma.agent.updateMany({ where: { id: run.agentId }, data: { status: "idle" } });

  if (run.taskId && outcome !== "cancelled" && (output || errorMessage)) {
    const orgId = run.organizationId;
    const thread =
      (await prisma.chatThread.findFirst({ where: { organizationId: orgId, taskId: run.taskId, kind: "task", archivedAt: null } })) ??
      (await prisma.chatThread.create({ data: { organizationId: orgId, taskId: run.taskId, agentId: run.agentId, kind: "task", title: "Task chat" } }));

    if (errorMessage) {
      await prisma.chatMessage.create({
        data: {
          organizationId: orgId,
          threadId: thread.id,
          senderType: "system",
          senderAgentId: run.agentId,
          body: `${agentName} could not finish this task: ${errorMessage}`,
          metadataJson: JSON.stringify({ kind: "agent_error" })
        }
      });
    }
    if (output) {
      await prisma.chatMessage.create({
        data: {
          organizationId: orgId,
          threadId: thread.id,
          senderType: "agent",
          senderAgentId: run.agentId,
          body: output,
          metadataJson: JSON.stringify({ kind: "agent_output" })
        }
      });
    }
  }

  // Brand kit extraction: only for Design department agents.
  if (output && run.taskId && outcome === "completed") {
    const task = await prisma.task
      .findUnique({
        where: { id: run.taskId },
        select: { department: { select: { slug: true } }, roadmapItem: { select: { key: true } } }
      })
      .catch(() => null);
    if (task?.department?.slug === "design") {
      const metaJson = JSON.stringify({ itemKey: task.roadmapItem?.key ?? "brand_identity" });
      await maybeExtractAndSaveBrandKit(output, run.organizationId, run.sessionId, "design", metaJson).catch(() => undefined);
    }
  }
}

/** One usage row per run tree, attributed to the root run. Never fails the run. */
export async function recordTreeUsage(root: Run, budget: RunBudget) {
  if (budget.totalTokens === 0 && budget.spentCents === 0) return;
  try {
    await prisma.usageRecord.create({
      data: {
        organizationId: root.organizationId,
        category: "tokens",
        quantity: budget.totalTokens,
        unit: "tokens",
        costCents: Math.ceil(budget.spentCents),
        sourceId: `run:${root.sessionId}`,
        occurredAt: new Date()
      }
    });
  } catch (error) {
    console.error(`[engine] could not record usage for session ${root.sessionId}:`, error);
  }
}
