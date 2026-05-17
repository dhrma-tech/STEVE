import type { Prisma } from "@prisma/client";
import { errorResponse } from "@/lib/api/responses";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { completeAgentSession, startAgentSession } from "@/lib/queue/sandbox-execution";
import {
  activeTaskStatuses,
  appTargetOptions,
  executeModeOptions,
  isTaskStatus,
  isTaskType,
  isTaskView,
  taskStatusOptions,
  type ExecuteModeValue,
  type TaskStatusValue,
  type TaskTypeValue,
  type TaskViewValue
} from "@/data/tasks";

const json = (value: unknown) => JSON.stringify(value);

const taskSummaryInclude = {
  department: true,
  agent: true,
  roadmapItem: { include: { stage: true } },
  createdBy: true,
  assignedUser: true,
  subtasks: { orderBy: { sortOrder: "asc" as const } },
  files: { where: { archivedAt: null }, orderBy: { updatedAt: "desc" as const }, take: 4 },
  approvals: { orderBy: { createdAt: "desc" as const } },
  sessions: { orderBy: { createdAt: "desc" as const }, take: 1 },
  chatThreads: {
    where: { kind: "task", archivedAt: null },
    include: { _count: { select: { messages: true } } },
    take: 2
  }
} satisfies Prisma.TaskInclude;

const taskDetailInclude = {
  ...taskSummaryInclude,
  files: { where: { archivedAt: null }, orderBy: { updatedAt: "desc" as const } },
  sessions: {
    orderBy: { createdAt: "desc" as const },
    include: { actions: { orderBy: { createdAt: "desc" as const }, take: 10 } }
  },
  chatThreads: {
    where: { kind: "task", archivedAt: null },
    include: {
      messages: {
        orderBy: { createdAt: "asc" as const },
        include: { senderUser: true, senderAgent: true }
      },
      _count: { select: { messages: true } }
    },
    orderBy: { updatedAt: "desc" as const }
  }
} satisfies Prisma.TaskInclude;

type TaskSummaryRecord = Prisma.TaskGetPayload<{ include: typeof taskSummaryInclude }>;
type TaskDetailRecord = Prisma.TaskGetPayload<{ include: typeof taskDetailInclude }>;

export type TaskQuery = {
  status?: string | null;
  departmentId?: string | null;
  agentId?: string | null;
  assigneeId?: string | null;
  type?: string | null;
  view?: string | null;
  q?: string | null;
};

export type TaskWorkspaceData = Awaited<ReturnType<typeof getTaskWorkspaceData>>;
export type TaskDetailData = Awaited<ReturnType<typeof getTaskDetail>>;

export async function getTaskWorkspaceData(orgId: string, query: TaskQuery = {}) {
  await requireOrgMember(orgId);
  const filters = normalizeTaskFilters(query);
  const where = taskWhere(orgId, filters);

  const [tasks, departments, members, suggestedItems] = await Promise.all([
    prisma.task.findMany({
      where,
      include: taskSummaryInclude,
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }]
    }),
    prisma.department.findMany({
      where: { organizationId: orgId },
      include: {
        agents: {
          where: { archivedAt: null },
          orderBy: [{ isDefault: "desc" }, { name: "asc" }]
        }
      },
      orderBy: { sortOrder: "asc" }
    }),
    prisma.membership.findMany({
      where: { organizationId: orgId, user: { deletedAt: null } },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.roadmapItem.findMany({
      where: { organizationId: orgId, status: { in: ["available", "locked"] } },
      include: { stage: true, department: true },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
      take: 8
    })
  ]);

  const serializedTasks = tasks.map(serializeTaskSummary);

  return {
    filters,
    tasks: serializedTasks,
    board: taskStatusOptions.map((status) => ({
      status: status.value,
      label: status.boardLabel,
      tasks: serializedTasks.filter((task) => task.status === status.value)
    })),
    calendar: buildCalendar(serializedTasks),
    catalog: {
      departments: departments.map((department) => ({
        id: department.id,
        slug: department.slug,
        name: department.name,
        availability: department.availability,
        agents: department.agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          status: agent.status,
          isDefault: agent.isDefault,
          departmentId: agent.departmentId
        }))
      })),
      agents: departments.flatMap((department) =>
        department.agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          status: agent.status,
          isDefault: agent.isDefault,
          departmentId: department.id,
          departmentName: department.name
        }))
      ),
      members: members.map((membership) => ({
        id: membership.user.id,
        name: membership.user.preferredName ?? membership.user.name ?? membership.user.email ?? "Member",
        email: membership.user.email,
        role: membership.role
      }))
    },
    suggestedTasks: suggestedItems.map((item) => ({
      id: item.id,
      key: item.key,
      title: item.title,
      status: item.status,
      workType: item.workType,
      stage: item.stage.name,
      department: item.department ? { id: item.department.id, name: item.department.name, slug: item.department.slug } : null
    })),
    statusCounts: taskStatusOptions.map((status) => ({
      status: status.value,
      label: status.label,
      count: serializedTasks.filter((task) => task.status === status.value).length
    }))
  };
}

export async function getTaskDetail(orgId: string, taskId: string) {
  await requireOrgMember(orgId);
  const task = await prisma.task.findFirst({
    where: {
      organizationId: orgId,
      id: taskId,
      archivedAt: null
    },
    include: taskDetailInclude
  });

  return task ? serializeTaskDetail(task) : null;
}

export async function createTask({
  orgId,
  title,
  description,
  departmentId,
  agentId,
  assignedUserId,
  roadmapItemId,
  type,
  executeMode,
  autoAssign,
  appTarget,
  priority,
  dueAt,
  fileIds = [],
  attachmentNames = [],
  source
}: {
  orgId: string;
  title: string;
  description?: string | null;
  departmentId?: string | null;
  agentId?: string | null;
  assignedUserId?: string | null;
  roadmapItemId?: string | null;
  type: TaskTypeValue;
  executeMode: ExecuteModeValue;
  autoAssign: boolean;
  appTarget?: string | null;
  priority?: number | null;
  dueAt?: string | null;
  fileIds?: string[];
  attachmentNames?: string[];
  source?: string | null;
}) {
  const { user } = await requireOrgMember(orgId);
  const assignment = await resolveAssignment({ orgId, departmentId, agentId, assignedUserId, type, autoAssign });
  const normalizedTitle = title.trim() || firstLine(description) || "Untitled task";
  const normalizedDescription = description?.trim() || null;
  const normalizedExecuteMode = executeModeOptions.some((option) => option.value === executeMode) ? executeMode : "queue";
  const normalizedAppTarget = appTargetOptions.some((option) => option.value === appTarget) ? appTarget : "staging";
  const normalizedPriority = typeof priority === "number" && Number.isFinite(priority) ? Math.max(0, Math.min(3, Math.round(priority))) : 0;
  const parsedDueAt = dueAt ? new Date(dueAt) : null;
  const startsNow = normalizedExecuteMode === "now" && type === "agent_task";
  const needsApproval = type === "approval_task";
  const task = await prisma.task.create({
    data: {
      organizationId: orgId,
      departmentId: assignment.departmentId,
      agentId: assignment.agentId,
      assignedUserId: assignment.assignedUserId ?? (type === "user_task" ? user.id : null),
      roadmapItemId: roadmapItemId ?? null,
      createdByUserId: user.id,
      title: normalizedTitle,
      description: normalizedDescription,
      type,
      status: needsApproval ? "blocked" : startsNow ? "running" : "queued",
      priority: normalizedPriority,
      dueAt: parsedDueAt && !Number.isNaN(parsedDueAt.getTime()) ? parsedDueAt : null,
      startedAt: startsNow ? new Date() : null,
      metadataJson: json({
        source: source ?? "manual",
        executeMode: normalizedExecuteMode,
        autoAssign,
        appTarget: normalizedAppTarget
      })
    }
  });

  await attachFilesToTask({
    orgId,
    taskId: task.id,
    departmentId: assignment.departmentId,
    userId: user.id,
    fileIds,
    attachmentNames
  });

  if (needsApproval) {
    await prisma.approval.create({
      data: {
        organizationId: orgId,
        taskId: task.id,
        requestedByAgentId: assignment.agentId,
        title: `Approval needed: ${normalizedTitle}`,
        description: normalizedDescription ?? "Review this task before an agent executes a potentially sensitive action.",
        riskLevel: "medium",
        status: "pending"
      }
    });
  }

  if (startsNow) {
    await createSessionForTask({ orgId, taskId: task.id, agentId: assignment.agentId });
  }

  return getTaskDetail(orgId, task.id);
}

export async function updateTask({
  orgId,
  taskId,
  title,
  description,
  status,
  departmentId,
  agentId,
  assignedUserId,
  priority,
  dueAt
}: {
  orgId: string;
  taskId: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  departmentId?: string | null;
  agentId?: string | null;
  assignedUserId?: string | null;
  priority?: number | null;
  dueAt?: string | null;
}) {
  await requireOrgMember(orgId);
  const existing = await prisma.task.findFirst({ where: { id: taskId, organizationId: orgId, archivedAt: null } });
  if (!existing) return null;

  const nextStatus = status && isTaskStatus(status) ? status : null;
  const parsedDueAt = dueAt ? new Date(dueAt) : dueAt === null ? null : undefined;
  const data: Prisma.TaskUpdateInput = {
    ...(title !== undefined ? { title: title?.trim() || existing.title } : {}),
    ...(description !== undefined ? { description: description?.trim() || null } : {}),
    ...(nextStatus ? { status: nextStatus } : {}),
    ...(priority !== undefined && priority !== null ? { priority: Math.max(0, Math.min(3, Math.round(priority))) } : {}),
    ...(parsedDueAt !== undefined ? { dueAt: parsedDueAt && !Number.isNaN(parsedDueAt.getTime()) ? parsedDueAt : null } : {}),
    ...(nextStatus === "running" ? { startedAt: existing.startedAt ?? new Date() } : {}),
    ...(nextStatus === "completed" ? { completedAt: existing.completedAt ?? new Date() } : {}),
    ...(nextStatus && nextStatus !== "completed" ? { completedAt: null } : {})
  };

  if (departmentId !== undefined) {
    const department = departmentId ? await prisma.department.findFirst({ where: { id: departmentId, organizationId: orgId } }) : null;
    data.department = department ? { connect: { id: department.id } } : { disconnect: true };
  }
  if (agentId !== undefined) {
    const agent = agentId ? await prisma.agent.findFirst({ where: { id: agentId, organizationId: orgId, archivedAt: null } }) : null;
    data.agent = agent ? { connect: { id: agent.id } } : { disconnect: true };
  }
  if (assignedUserId !== undefined) {
    const assignedUser = assignedUserId ? await prisma.user.findFirst({ where: { id: assignedUserId, deletedAt: null, memberships: { some: { organizationId: orgId } } } }) : null;
    data.assignedUser = assignedUser ? { connect: { id: assignedUser.id } } : { disconnect: true };
  }

  await prisma.task.update({ where: { id: taskId }, data });
  return getTaskDetail(orgId, taskId);
}

export async function createSubtask({ orgId, taskId, title }: { orgId: string; taskId: string; title: string }) {
  await requireOrgMember(orgId);
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: orgId, archivedAt: null },
    include: { _count: { select: { subtasks: true } } }
  });
  if (!task) return null;

  await prisma.subtask.create({
    data: {
      taskId,
      title: title.trim(),
      status: "queued",
      sortOrder: task._count.subtasks
    }
  });

  return getTaskDetail(orgId, taskId);
}

export async function updateSubtask({
  orgId,
  taskId,
  subtaskId,
  title,
  status
}: {
  orgId: string;
  taskId: string;
  subtaskId: string;
  title?: string | null;
  status?: string | null;
}) {
  await requireOrgMember(orgId);
  const subtask = await prisma.subtask.findFirst({ where: { id: subtaskId, task: { id: taskId, organizationId: orgId, archivedAt: null } } });
  if (!subtask) return null;

  await prisma.subtask.update({
    where: { id: subtaskId },
    data: {
      ...(title !== undefined ? { title: title?.trim() || subtask.title } : {}),
      ...(status ? { status } : {})
    }
  });

  return getTaskDetail(orgId, taskId);
}

export async function addTaskComment({
  orgId,
  taskId,
  body,
  fileIds = []
}: {
  orgId: string;
  taskId: string;
  body: string;
  fileIds?: string[];
}) {
  const { user } = await requireOrgMember(orgId);
  const task = await prisma.task.findFirst({ where: { id: taskId, organizationId: orgId, archivedAt: null } });
  if (!task) return null;

  const thread = await ensureTaskThread({ orgId, taskId, userId: user.id, title: task.title });
  await prisma.chatMessage.create({
    data: {
      organizationId: orgId,
      threadId: thread.id,
      senderType: "user",
      senderUserId: user.id,
      body: body.trim(),
      metadataJson: json({ fileIds })
    }
  });

  if (fileIds.length) {
    await prisma.file.updateMany({
      where: { organizationId: orgId, id: { in: fileIds }, archivedAt: null },
      data: { taskId }
    });
  }

  return getTaskDetail(orgId, taskId);
}

export async function addTaskAttachments({
  orgId,
  taskId,
  fileIds = [],
  attachmentNames = []
}: {
  orgId: string;
  taskId: string;
  fileIds?: string[];
  attachmentNames?: string[];
}) {
  const { user } = await requireOrgMember(orgId);
  const task = await prisma.task.findFirst({ where: { id: taskId, organizationId: orgId, archivedAt: null } });
  if (!task) return null;

  await attachFilesToTask({
    orgId,
    taskId,
    departmentId: task.departmentId,
    userId: user.id,
    fileIds,
    attachmentNames
  });

  return getTaskDetail(orgId, taskId);
}

export async function startTask({ orgId, taskId }: { orgId: string; taskId: string }) {
  await requireOrgMember(orgId);
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: orgId, archivedAt: null },
    include: { approvals: true }
  });
  if (!task) return { kind: "not_found" as const };

  const pendingApproval = task.approvals.find((approval) => approval.status === "pending");
  if (pendingApproval) {
    return { kind: "approval_required" as const, approval: pendingApproval };
  }

  const session = await createSessionForTask({ orgId, taskId, agentId: task.agentId });
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "running", startedAt: task.startedAt ?? new Date() }
  });

  return { kind: "started" as const, session, task: await getTaskDetail(orgId, taskId) };
}

export async function cancelTask({ orgId, taskId }: { orgId: string; taskId: string }) {
  await requireOrgMember(orgId);
  const task = await prisma.task.findFirst({ where: { id: taskId, organizationId: orgId, archivedAt: null } });
  if (!task) return null;

  await prisma.$transaction([
    prisma.taskSession.updateMany({
      where: { organizationId: orgId, taskId, status: { in: ["queued", "running"] } },
      data: { status: "canceled", finishedAt: new Date() }
    }),
    prisma.task.update({
      where: { id: taskId },
      data: { status: "canceled" }
    })
  ]);

  return getTaskDetail(orgId, taskId);
}

export async function createTaskApproval({
  orgId,
  taskId,
  title,
  description,
  riskLevel
}: {
  orgId: string;
  taskId: string;
  title: string;
  description?: string | null;
  riskLevel?: string | null;
}) {
  await requireOrgMember(orgId);
  const task = await prisma.task.findFirst({ where: { id: taskId, organizationId: orgId, archivedAt: null } });
  if (!task) return null;

  await prisma.$transaction([
    prisma.approval.create({
      data: {
        organizationId: orgId,
        taskId,
        requestedByAgentId: task.agentId,
        title: title.trim(),
        description: description?.trim() || null,
        riskLevel: riskLevel ?? "medium",
        status: "pending"
      }
    }),
    prisma.task.update({
      where: { id: taskId },
      data: { status: "blocked" }
    })
  ]);

  return getTaskDetail(orgId, taskId);
}

export async function reviewTaskApproval({
  orgId,
  taskId,
  approvalId,
  status
}: {
  orgId: string;
  taskId: string;
  approvalId: string;
  status: "approved" | "rejected";
}) {
  const { user } = await requireOrgMember(orgId);
  const approval = await prisma.approval.findFirst({
    where: { id: approvalId, organizationId: orgId, taskId }
  });
  if (!approval) return null;

  await prisma.$transaction([
    prisma.approval.update({
      where: { id: approvalId },
      data: {
        status,
        reviewedByUserId: user.id,
        reviewedAt: new Date()
      }
    }),
    prisma.task.update({
      where: { id: taskId },
      data: { status: status === "approved" ? "queued" : "blocked" }
    })
  ]);

  return getTaskDetail(orgId, taskId);
}

export function taskNotFoundResponse() {
  return errorResponse("NOT_FOUND", "Task not found", 404);
}

function normalizeTaskFilters(query: TaskQuery) {
  const view = query.view && isTaskView(query.view) ? query.view : "list";
  const status = query.status && isTaskStatus(query.status) ? query.status : null;
  const type = query.type && isTaskType(query.type) ? query.type : null;

  return {
    view,
    status,
    departmentId: cleanFilter(query.departmentId),
    agentId: cleanFilter(query.agentId),
    assigneeId: cleanFilter(query.assigneeId),
    type,
    q: query.q?.trim() ?? ""
  } satisfies {
    view: TaskViewValue;
    status: TaskStatusValue | null;
    departmentId: string | null;
    agentId: string | null;
    assigneeId: string | null;
    type: TaskTypeValue | null;
    q: string;
  };
}

function taskWhere(orgId: string, filters: ReturnType<typeof normalizeTaskFilters>): Prisma.TaskWhereInput {
  return {
    organizationId: orgId,
    archivedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.agentId ? { agentId: filters.agentId } : {}),
    ...(filters.assigneeId ? { assignedUserId: filters.assigneeId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q } },
            { description: { contains: filters.q } },
            { department: { name: { contains: filters.q } } },
            { agent: { name: { contains: filters.q } } }
          ]
        }
      : {})
  };
}

function serializeTaskSummary(task: TaskSummaryRecord) {
  const commentsCount = task.chatThreads.reduce((count, thread) => count + thread._count.messages, 0);
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.status === "completed").length;
  const pendingApproval = task.approvals.find((approval) => approval.status === "pending") ?? null;

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    status: normalizeStatus(task.status),
    priority: task.priority,
    dueAt: task.dueAt?.toISOString() ?? null,
    startedAt: task.startedAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    metadata: parseJsonObject(task.metadataJson),
    department: task.department ? { id: task.department.id, name: task.department.name, slug: task.department.slug, color: task.department.color } : null,
    agent: task.agent ? { id: task.agent.id, name: task.agent.name, status: task.agent.status } : null,
    roadmapItem: task.roadmapItem
      ? { id: task.roadmapItem.id, key: task.roadmapItem.key, title: task.roadmapItem.title, stage: task.roadmapItem.stage?.name ?? null }
      : null,
    createdBy: task.createdBy ? serializeUser(task.createdBy) : null,
    assignedUser: task.assignedUser ? serializeUser(task.assignedUser) : null,
    subtasksCount: task.subtasks.length,
    completedSubtasks,
    commentsCount,
    filesCount: task.files.length,
    approvalsCount: task.approvals.length,
    pendingApproval: pendingApproval ? serializeApproval(pendingApproval) : null,
    latestSession: task.sessions[0] ? serializeSession(task.sessions[0]) : null
  };
}

function serializeTaskDetail(task: TaskDetailRecord) {
  const summary = serializeTaskSummary(task);
  const thread = task.chatThreads[0] ?? null;

  return {
    ...summary,
    subtasks: task.subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      status: subtask.status,
      sortOrder: subtask.sortOrder,
      createdAt: subtask.createdAt.toISOString(),
      updatedAt: subtask.updatedAt.toISOString()
    })),
    comments: thread
      ? thread.messages.map((message) => ({
          id: message.id,
          senderType: message.senderType,
          body: message.body,
          metadata: parseJsonObject(message.metadataJson),
          createdAt: message.createdAt.toISOString(),
          senderUser: message.senderUser ? serializeUser(message.senderUser) : null,
          senderAgent: message.senderAgent ? { id: message.senderAgent.id, name: message.senderAgent.name } : null
        }))
      : [],
    attachments: task.files.map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      visibility: file.visibility,
      storageKey: file.storageKey,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString()
    })),
    approvals: task.approvals.map(serializeApproval),
    sessions: task.sessions.map((session) => ({
      ...serializeSession(session),
      browserUrl: session.browserUrl,
      replayUrl: session.replayUrl,
      scratchpad: session.scratchpad,
      actions: session.actions.map((action) => ({
        id: action.id,
        label: action.label,
        actionType: action.actionType,
        status: action.status,
        payload: parseJsonObject(action.payloadJson),
        createdAt: action.createdAt.toISOString(),
        completedAt: action.completedAt?.toISOString() ?? null
      }))
    }))
  };
}

async function resolveAssignment({
  orgId,
  departmentId,
  agentId,
  assignedUserId,
  type,
  autoAssign
}: {
  orgId: string;
  departmentId?: string | null;
  agentId?: string | null;
  assignedUserId?: string | null;
  type: TaskTypeValue;
  autoAssign: boolean;
}) {
  const agent = agentId
    ? await prisma.agent.findFirst({ where: { id: agentId, organizationId: orgId, archivedAt: null } })
    : null;
  const department = departmentId
    ? await prisma.department.findFirst({ where: { id: departmentId, organizationId: orgId } })
    : agent?.departmentId
      ? await prisma.department.findFirst({ where: { id: agent.departmentId, organizationId: orgId } })
      : null;
  const defaultAgent = autoAssign && !agent && department
    ? await prisma.agent.findFirst({
        where: { organizationId: orgId, departmentId: department.id, isDefault: true, archivedAt: null },
        orderBy: { createdAt: "asc" }
      })
    : null;
  const assignee = assignedUserId
    ? await prisma.user.findFirst({ where: { id: assignedUserId, memberships: { some: { organizationId: orgId } }, deletedAt: null } })
    : null;

  return {
    departmentId: department?.id ?? agent?.departmentId ?? null,
    agentId: type === "user_task" ? null : agent?.id ?? defaultAgent?.id ?? null,
    assignedUserId: type === "agent_task" || type === "approval_task" ? assignee?.id ?? null : assignee?.id ?? null
  };
}

async function attachFilesToTask({
  orgId,
  taskId,
  departmentId,
  userId,
  fileIds,
  attachmentNames
}: {
  orgId: string;
  taskId: string;
  departmentId: string | null;
  userId: string;
  fileIds: string[];
  attachmentNames: string[];
}) {
  const cleanFileIds = fileIds.map((id) => id.trim()).filter(Boolean);
  if (cleanFileIds.length) {
    await prisma.file.updateMany({
      where: { organizationId: orgId, id: { in: cleanFileIds }, archivedAt: null },
      data: { taskId }
    });
  }

  const cleanNames = Array.from(new Set(attachmentNames.map((name) => name.trim()).filter(Boolean))).slice(0, 12);
  for (const [index, name] of cleanNames.entries()) {
    await prisma.file.create({
      data: {
        organizationId: orgId,
        departmentId,
        taskId,
        uploadedByUserId: userId,
        name,
        mimeType: null,
        sizeBytes: 0,
        storageKey: `task/${taskId}/${Date.now()}-${index}-${slugify(name)}`,
        visibility: "task",
        metadataJson: json({ source: "task_attachment", originalName: name })
      }
    });
  }
}

async function ensureTaskThread({ orgId, taskId, userId, title }: { orgId: string; taskId: string; userId: string; title: string }) {
  const existing = await prisma.chatThread.findFirst({
    where: { organizationId: orgId, taskId, kind: "task", archivedAt: null },
    orderBy: { createdAt: "asc" }
  });

  if (existing) return existing;

  return prisma.chatThread.create({
    data: {
      organizationId: orgId,
      taskId,
      kind: "task",
      title: `Task: ${title}`,
      createdByUserId: userId
    }
  });
}

async function createSessionForTask({ orgId, taskId, agentId }: { orgId: string; taskId: string; agentId: string | null }) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: orgId },
    include: { department: true, agent: { include: { department: true } } }
  });
  const session = await startAgentSession({ orgId, taskId, agentId });
  if (session && task) {
    void completeAgentSession({
      orgId,
      sessionId: session.id,
      taskId,
      agentId,
      agentName: task.agent?.name ?? "Agent",
      deptName: task.department?.name ?? task.agent?.department.name ?? "company",
      taskTitle: task.title,
      taskDescription: task.description
    });
  }
  return session;
}

function buildCalendar(tasks: ReturnType<typeof serializeTaskSummary>[]) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      tasks: tasks.filter((task) => task.dueAt?.slice(0, 10) === key)
    };
  });

  return {
    days,
    unscheduled: tasks.filter((task) => !task.dueAt && activeTaskStatuses.includes(task.status)).slice(0, 8)
  };
}

function cleanFilter(value?: string | null) {
  if (!value || value === "all" || value === "none") return null;
  return value;
}

function normalizeStatus(status: string): TaskStatusValue {
  return isTaskStatus(status) ? status : "queued";
}

function serializeUser(user: { id: string; name: string | null; preferredName: string | null; email: string | null; avatarUrl: string | null }) {
  return {
    id: user.id,
    name: user.preferredName ?? user.name ?? user.email ?? "Member",
    email: user.email,
    avatarUrl: user.avatarUrl
  };
}

function serializeApproval(approval: { id: string; title: string; description: string | null; riskLevel: string; status: string; createdAt: Date; reviewedAt: Date | null }) {
  return {
    id: approval.id,
    title: approval.title,
    description: approval.description,
    riskLevel: approval.riskLevel,
    status: approval.status,
    createdAt: approval.createdAt.toISOString(),
    reviewedAt: approval.reviewedAt?.toISOString() ?? null
  };
}

function serializeSession(session: { id: string; status: string; agentId: string | null; elapsedMs: number; startedAt: Date | null; finishedAt: Date | null; createdAt: Date }) {
  return {
    id: session.id,
    status: session.status,
    agentId: session.agentId,
    elapsedMs: session.elapsedMs,
    startedAt: session.startedAt?.toISOString() ?? null,
    finishedAt: session.finishedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString()
  };
}

function parseJsonObject(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function firstLine(value?: string | null) {
  return value?.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "attachment";
}
