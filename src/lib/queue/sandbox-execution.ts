import { prisma } from "@/lib/db/client";

const json = (value: unknown) => JSON.stringify(value);

const actionPlan = [
  {
    actionType: "context.load",
    label: "Loaded company and task context",
    detail: "Pulled organization, department, roadmap, and task details into the run."
  },
  {
    actionType: "workspace.write",
    label: "Writing to workspace",
    detail: "Prepared the first workspace changes and notes for review."
  },
  {
    actionType: "verification.run",
    label: "Ran verification checks",
    detail: "Checked the output against the task acceptance context."
  },
  {
    actionType: "review.prepare",
    label: "Prepared review handoff",
    detail: "Summarized the run, blockers, and follow-up actions."
  }
] as const;

export async function createSandboxSessionForTask({
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

  if (!task) {
    return null;
  }

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
        `# ${task.agent?.name ?? "Agent"} run`,
        "",
        `Task: ${task.title}`,
        task.department ? `Department: ${task.department.name}` : null,
        message?.trim() ? `Launch note: ${message.trim()}` : null,
        "",
        "Sandbox execution is deterministic and reviewable."
      ].filter(Boolean).join("\n")
    }
  });

  await prisma.$transaction([
    prisma.agentAction.create({
      data: {
        organizationId: orgId,
        sessionId: session.id,
        agentId,
        label: "Task session started",
        actionType: "session.start",
        status: "completed",
        payloadJson: json({ taskId, message: message?.trim() ?? null }),
        completedAt: now
      }
    }),
    prisma.agentAction.create({
      data: {
        organizationId: orgId,
        sessionId: session.id,
        agentId,
        label: actionPlan[0].label,
        actionType: actionPlan[0].actionType,
        status: "running",
        payloadJson: json({ detail: actionPlan[0].detail })
      }
    }),
    prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: task.startedAt ?? now }
    }),
    ...(agentId
      ? [
          prisma.agent.update({
            where: { id: agentId },
            data: { status: "running" }
          })
        ]
      : [])
  ]);

  return session;
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

  if (!session) {
    return null;
  }

  if (session.status === "completed" || session.status === "canceled") {
    return session;
  }

  const now = new Date();
  const runningAction = session.actions.find((action) => action.status === "running");
  const currentIndex = runningAction ? actionPlan.findIndex((item) => item.actionType === runningAction.actionType) : -1;
  const nextPlan = finish ? null : actionPlan[currentIndex + 1] ?? null;
  const elapsedMs = session.startedAt ? Math.max(1000, now.getTime() - session.startedAt.getTime()) : 1000;
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
      prisma.taskSession.update({
        where: { id: sessionId },
        data: { elapsedMs }
      })
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
      prisma.task.update({
        where: { id: session.taskId },
        data: { status: "ready_to_review" }
      }),
      ...(session.agentId
        ? [
            prisma.agent.update({
              where: { id: session.agentId },
              data: { status: "idle" }
            })
          ]
        : [])
    );
  }

  await prisma.$transaction(updates);
  await ensureRunMessage({ orgId, taskId: session.taskId, agentId: session.agentId, completed: !nextPlan });

  return prisma.taskSession.findFirst({
    where: { id: sessionId, organizationId: orgId },
    include: { actions: { orderBy: { createdAt: "asc" } } }
  });
}

async function ensureRunMessage({
  orgId,
  taskId,
  agentId,
  completed
}: {
  orgId: string;
  taskId: string;
  agentId: string | null;
  completed: boolean;
}) {
  const thread = await prisma.chatThread.findFirst({
    where: { organizationId: orgId, taskId, kind: "task", archivedAt: null }
  }) ?? await prisma.chatThread.create({
    data: {
      organizationId: orgId,
      taskId,
      agentId,
      kind: "task",
      title: "Task chat"
    }
  });

  await prisma.chatMessage.create({
    data: {
      organizationId: orgId,
      threadId: thread.id,
      senderType: "system",
      senderAgentId: agentId,
      body: completed ? "Ran 4 actions and prepared this task for review." : "Writing to workspace and saving run state.",
      metadataJson: json({ kind: "agent_action_log", completed })
    }
  });
}

