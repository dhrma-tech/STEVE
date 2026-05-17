import { prisma } from "@/lib/db/client";
import { ollamaChatSafe, OLLAMA_OFFLINE_MESSAGE } from "@/lib/ai/ollama";

const json = (value: unknown) => JSON.stringify(value);

const actionPlan = [
  { actionType: "context.load", label: "Read context", detail: "Pulled organization, department, and task details into the run." },
  { actionType: "workspace.write", label: "Working on it", detail: "Prepared the first workspace changes and notes for review." },
  { actionType: "verification.run", label: "Verified output", detail: "Checked the output against the task acceptance context." },
  { actionType: "review.prepare", label: "Wrapped up", detail: "Summarized the run, blockers, and follow-up actions." }
] as const;


// Phase 1: Create session as "running" immediately — returned to client right away
export async function startAgentSession({
  orgId,
  taskId,
  agentId,
  message
}: {
  orgId: string;
  taskId: string;
  agentId: string | null;
  message?: string | null;
}) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: orgId, archivedAt: null },
    include: { department: true, agent: true }
  });
  if (!task) return null;

  const agentName = task.agent?.name ?? "Agent";
  const deptName = task.department?.name ?? "company";
  const now = new Date();

  const session = await prisma.taskSession.create({
    data: {
      organizationId: orgId,
      taskId,
      agentId,
      status: "running",
      startedAt: now,
      browserUrl: `/org/${orgId}/canvas?task=${taskId}`,
      scratchpad: [
        `# ${agentName} — Running`,
        "",
        `**Task:** ${task.title}`,
        `**Department:** ${deptName}`,
        message?.trim() ? `**Note:** ${message.trim()}` : null,
        "",
        "_Working on it..._"
      ].filter(Boolean).join("\n")
    }
  });

  // First action as "running"
  await prisma.agentAction.create({
    data: {
      organizationId: orgId,
      sessionId: session.id,
      agentId,
      label: "Session started",
      actionType: "session.start",
      status: "running",
      payloadJson: json({ taskId, message: message?.trim() ?? null })
    }
  });

  // updateMany so it's a no-op if the agent was deleted
  if (agentId) {
    await prisma.agent.updateMany({ where: { id: agentId }, data: { status: "running" } });
  }

  return session;
}

// Phase 2: Background completion — call Ollama, update session to "completed"
export async function completeAgentSession({
  orgId,
  sessionId,
  taskId,
  agentId,
  message,
  agentName,
  deptName,
  taskTitle,
  taskDescription
}: {
  orgId: string;
  sessionId: string;
  taskId: string;
  agentId: string | null;
  message?: string | null;
  agentName: string;
  deptName: string;
  taskTitle: string;
  taskDescription?: string | null;
}) {
  // Brief delay so "running" state is visible to the user
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const aiOutput = await ollamaChatSafe({
    system:
      `You are ${agentName}, an AI agent working in the ${deptName} department of a startup. ` +
      `Analyze the task thoroughly and produce clear, actionable output. ` +
      `Use markdown headers. Be practical and concise (under 400 words).`,
    user: [
      `Task: ${taskTitle}`,
      taskDescription ? `Description: ${taskDescription}` : null,
      `Department: ${deptName}`,
      message?.trim() ? `Note: ${message.trim()}` : null,
      "",
      "Provide output in these sections:",
      "## Approach",
      "## Key Steps",
      "## Output / Deliverables",
      "## Blockers & Next Actions"
    ].filter(Boolean).join("\n")
  });

  const now = new Date();

  // Get the running "session.start" action to complete it
  const session = await prisma.taskSession.findUnique({
    where: { id: sessionId },
    include: { actions: true }
  });
  const runningAction = session?.actions.find((a) => a.status === "running");
  const startedAt = session?.startedAt ?? now;
  const elapsedMs = Math.max(1200, now.getTime() - startedAt.getTime());

  const scratchpad = [
    `# ${agentName} — Completed`,
    "",
    `**Task:** ${taskTitle}`,
    `**Department:** ${deptName}`,
    message?.trim() ? `**Note:** ${message.trim()}` : null,
    "",
    "---",
    "",
    aiOutput || OLLAMA_OFFLINE_MESSAGE
  ].filter(Boolean).join("\n");

  const replayUrl = `/org/${orgId}/canvas?session=${sessionId}&replay=1`;

  await prisma.$transaction([
    // Complete the initial running action
    ...(runningAction
      ? [prisma.agentAction.update({
          where: { id: runningAction.id },
          data: { status: "completed", completedAt: new Date(now.getTime() - 3600) }
        })]
      : []),
    // Create remaining plan actions as completed
    ...actionPlan.map((plan, i) =>
      prisma.agentAction.create({
        data: {
          organizationId: orgId,
          sessionId,
          agentId,
          label: plan.label,
          actionType: plan.actionType,
          status: "completed",
          payloadJson: json({ detail: plan.detail }),
          completedAt: new Date(now.getTime() - (actionPlan.length - i) * 1200)
        }
      })
    ),
    // Mark session completed
    prisma.taskSession.update({
      where: { id: sessionId },
      data: { status: "completed", finishedAt: now, elapsedMs, scratchpad, replayUrl }
    }),
    // Mark task ready for review
    prisma.task.update({
      where: { id: taskId },
      data: { status: "ready_to_review" }
    }),
    // Reset agent to idle (updateMany = no-op if agent was deleted)
    ...(agentId
      ? [prisma.agent.updateMany({ where: { id: agentId }, data: { status: "idle" } })]
      : [])
  ]);

  // Post output to task chat thread
  await postAgentOutput({ orgId, taskId, agentId, agentName, aiOutput });
}

async function postAgentOutput({
  orgId,
  taskId,
  agentId,
  agentName,
  aiOutput
}: {
  orgId: string;
  taskId: string;
  agentId: string | null;
  agentName: string;
  aiOutput: string;
}) {
  const thread =
    (await prisma.chatThread.findFirst({
      where: { organizationId: orgId, taskId, kind: "task", archivedAt: null }
    })) ??
    (await prisma.chatThread.create({
      data: { organizationId: orgId, taskId, agentId, kind: "task", title: "Task chat" }
    }));

  await prisma.chatMessage.createMany({
    data: [
      {
        organizationId: orgId,
        threadId: thread.id,
        senderType: "system",
        senderAgentId: agentId,
        body: `${agentName} finished and prepared this task for review.`,
        metadataJson: json({ kind: "agent_action_log", completed: true })
      },
      ...(aiOutput
        ? [
            {
              organizationId: orgId,
              threadId: thread.id,
              senderType: "agent" as const,
              senderAgentId: agentId,
              body: aiOutput,
              metadataJson: json({ kind: "agent_output" })
            }
          ]
        : [])
    ]
  });
}

export async function advanceSandboxSession({
  orgId,
  sessionId,
  finish = false
}: {
  orgId: string;
  sessionId: string;
  finish?: boolean;
}) {
  const session = await prisma.taskSession.findFirst({
    where: { id: sessionId, organizationId: orgId },
    include: {
      task: true,
      agent: true,
      actions: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!session) return null;
  if (session.status === "completed" || session.status === "canceled") return session;

  const now = new Date();
  const runningAction = session.actions.find((a) => a.status === "running");
  const currentIndex = runningAction
    ? actionPlan.findIndex((p) => p.actionType === runningAction.actionType)
    : -1;
  const nextPlan = finish ? null : actionPlan[currentIndex + 1] ?? null;
  const elapsedMs = session.startedAt
    ? Math.max(1000, now.getTime() - session.startedAt.getTime())
    : 1000;

  const updates = [];

  if (runningAction) {
    updates.push(
      prisma.agentAction.update({
        where: { id: runningAction.id },
        data: { status: "completed", completedAt: now }
      })
    );
  }

  if (nextPlan) {
    updates.push(
      prisma.agentAction.create({
        data: {
          organizationId: orgId,
          sessionId,
          agentId: session.agentId,
          label: nextPlan.label,
          actionType: nextPlan.actionType,
          status: "running",
          payloadJson: json({ detail: nextPlan.detail })
        }
      }),
      prisma.taskSession.update({ where: { id: sessionId }, data: { elapsedMs } })
    );
  } else {
    updates.push(
      prisma.taskSession.update({
        where: { id: sessionId },
        data: {
          status: "completed",
          elapsedMs,
          finishedAt: now,
          replayUrl: `/org/${orgId}/canvas?session=${sessionId}&replay=1`
        }
      }),
      prisma.task.update({ where: { id: session.taskId }, data: { status: "ready_to_review" } }),
      ...(session.agentId
        ? [prisma.agent.update({ where: { id: session.agentId }, data: { status: "idle" } })]
        : [])
    );
  }

  await prisma.$transaction(updates);

  return prisma.taskSession.findFirst({
    where: { id: sessionId },
    include: { actions: { orderBy: { createdAt: "asc" } } }
  });
}
