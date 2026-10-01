import { prisma } from "@/lib/db/client";
import { startAgentRun } from "@/lib/agents/run-service";
import { createGoalPlan } from "@/lib/agents/plans/store";

/**
 * Start a piece of work on behalf of a schedule, a trigger or the public API, the same way a person would:
 *   goal  → the Chief of Staff plans it (createGoalPlan); the plan waits for review unless auto-approve applies
 *   agent → one agent does it on a new task (startAgentRun)
 *
 * `untrusted` marks work whose instruction carries outside text (a webhook event). Its runs start tainted: nothing
 * outside STEVE is pre-approved for them (policy/engine.ts), and a goal from outside never skips plan review.
 */

export type WorkTarget = "goal" | "agent";

export type StartWorkInput = {
  orgId: string;
  target: WorkTarget;
  /** The goal or the instruction. */
  instruction: string;
  /** agent target: who does it. */
  agentId?: string | null;
  /** Extra context for the Chief of Staff or appended to the agent's instruction. */
  context?: string | null;
  /** A short task title (agent target). */
  title?: string;
  autoApprove?: boolean;
  userId?: string | null;
  origin: { source: "schedule" | "trigger" | "api"; refId?: string; untrusted?: { tool: string; excerpt: string } };
};

export type StartedWork =
  | { kind: "plan"; planId: string; sessionId: string }
  | { kind: "run"; taskId: string; sessionId: string };

export class StartWorkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StartWorkError";
  }
}

export async function startWork(input: StartWorkInput): Promise<StartedWork> {
  if (input.target === "goal") {
    const { plan, sessionId } = await createGoalPlan({
      orgId: input.orgId,
      userId: input.userId ?? null,
      goal: input.instruction.slice(0, 1000),
      context: input.context ?? null,
      // Outside text never gets to skip review.
      autoApprove: !!input.autoApprove && !input.origin.untrusted,
      origin: input.origin
    });
    return { kind: "plan", planId: plan.id, sessionId };
  }

  if (!input.agentId) throw new StartWorkError("Pick the agent that should do this.");
  const agent = await prisma.agent.findFirst({
    where: { id: input.agentId, organizationId: input.orgId, status: { not: "archived" } },
    select: { id: true, departmentId: true }
  });
  if (!agent) throw new StartWorkError("That agent no longer exists in this workspace.");

  const message = input.context ? `${input.instruction}\n\n${input.context}` : input.instruction;
  const task = await prisma.task.create({
    data: {
      organizationId: input.orgId,
      agentId: agent.id,
      departmentId: agent.departmentId,
      createdByUserId: input.userId ?? null,
      title: (input.title ?? input.instruction.split(/\r?\n/)[0] ?? "Automated task").slice(0, 80),
      description: message.slice(0, 8000),
      type: "agent_task",
      status: "queued",
      metadataJson: JSON.stringify({
        source: input.origin.source,
        originId: input.origin.refId ?? null,
        ...(input.origin.untrusted ? { untrusted: input.origin.untrusted } : {})
      })
    }
  });
  const session = await startAgentRun({ orgId: input.orgId, taskId: task.id, agentId: agent.id, message });
  if (!session) throw new StartWorkError("The agent could not be started.");
  return { kind: "run", taskId: task.id, sessionId: session.id };
}
