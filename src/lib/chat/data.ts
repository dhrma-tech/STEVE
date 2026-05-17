import type { Prisma } from "@prisma/client";
import { errorResponse } from "@/lib/api/responses";
import { requireOrgMember } from "@/lib/auth/session";
import { generateChatResponse } from "@/lib/ai/sandbox-chat";
import { prisma } from "@/lib/db/client";

const json = (value: unknown) => JSON.stringify(value);

const threadInclude = {
  task: { include: { department: true, agent: true } },
  agent: { include: { department: true } },
  createdBy: true,
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: { senderUser: true, senderAgent: true }
  },
  _count: { select: { messages: true } }
} satisfies Prisma.ChatThreadInclude;

const threadDetailInclude = {
  task: { include: { department: true, agent: true } },
  agent: { include: { department: true } },
  createdBy: true,
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: { senderUser: true, senderAgent: true }
  },
  _count: { select: { messages: true } }
} satisfies Prisma.ChatThreadInclude;

type ThreadRecord = Prisma.ChatThreadGetPayload<{ include: typeof threadInclude }>;
type ThreadDetailRecord = Prisma.ChatThreadGetPayload<{ include: typeof threadDetailInclude }>;

export type ChatMention = {
  type: "department" | "agent" | "member";
  id: string;
  key: string;
  label: string;
  color?: string | null;
};

export type ChatThreadQuery = {
  kind?: string | null;
  taskId?: string | null;
  agentId?: string | null;
  q?: string | null;
};

export type ChatWorkspaceData = Awaited<ReturnType<typeof getChatWorkspaceData>>;
export type ChatThreadDetailData = Awaited<ReturnType<typeof getChatThreadDetail>>;
export type ChatSendResult = Awaited<ReturnType<typeof sendChatMessage>>;

export async function getChatWorkspaceData(orgId: string, query: ChatThreadQuery = {}) {
  await requireOrgMember(orgId);
  const filters = normalizeThreadFilters(query);

  const [threads, departments, agents, files, members] = await Promise.all([
    prisma.chatThread.findMany({
      where: threadWhere(orgId, filters),
      include: threadInclude,
      orderBy: { updatedAt: "desc" },
      take: 40
    }),
    prisma.department.findMany({
      where: { organizationId: orgId },
      orderBy: { sortOrder: "asc" }
    }),
    prisma.agent.findMany({
      where: { organizationId: orgId, archivedAt: null },
      include: { department: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    }),
    prisma.file.findMany({
      where: { organizationId: orgId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 16
    }),
    prisma.membership.findMany({
      where: { organizationId: orgId, user: { deletedAt: null } },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    })
  ]);

  return {
    filters,
    threads: threads.map(serializeThreadSummary),
    catalog: {
      departments: departments.map((department) => ({
        id: department.id,
        slug: department.slug,
        name: department.name,
        color: department.color,
        availability: department.availability
      })),
      agents: agents.map((agent) => ({
        id: agent.id,
        slug: agent.slug,
        name: agent.name,
        status: agent.status,
        department: {
          id: agent.department.id,
          slug: agent.department.slug,
          name: agent.department.name,
          color: agent.department.color
        }
      })),
      members: members.map((membership) => ({
        id: membership.user.id,
        key: slugify(membership.user.preferredName ?? membership.user.name ?? membership.user.email ?? "member"),
        name: membership.user.preferredName ?? membership.user.name ?? membership.user.email ?? "Member",
        email: membership.user.email,
        role: membership.role
      })),
      files: files.map(serializeFile)
    }
  };
}

export async function createChatThread({
  orgId,
  kind,
  title,
  taskId,
  agentId
}: {
  orgId: string;
  kind: string;
  title?: string | null;
  taskId?: string | null;
  agentId?: string | null;
}) {
  const { user } = await requireOrgMember(orgId);
  const safeKind = ["cofounder", "task", "department"].includes(kind) ? kind : "cofounder";
  const task = taskId
    ? await prisma.task.findFirst({ where: { id: taskId, organizationId: orgId, archivedAt: null }, include: { agent: true } })
    : null;
  const agent = agentId
    ? await prisma.agent.findFirst({ where: { id: agentId, organizationId: orgId, archivedAt: null } })
    : null;
  const defaultTitle = safeKind === "task" && task ? `Task: ${task.title}` : safeKind === "department" ? "Department thread" : "Cofounder chat";

  const thread = await prisma.chatThread.create({
    data: {
      organizationId: orgId,
      kind: safeKind,
      title: title?.trim() || defaultTitle,
      taskId: task?.id ?? null,
      agentId: agent?.id ?? task?.agentId ?? null,
      createdByUserId: user.id
    },
    include: threadDetailInclude
  });

  return serializeThreadDetail(thread);
}

export async function getChatThreadDetail(orgId: string, threadId: string) {
  await requireOrgMember(orgId);
  const thread = await prisma.chatThread.findFirst({
    where: { id: threadId, organizationId: orgId, archivedAt: null },
    include: threadDetailInclude
  });

  return thread ? serializeThreadDetail(thread) : null;
}

export async function updateChatThread({
  orgId,
  threadId,
  title,
  archived
}: {
  orgId: string;
  threadId: string;
  title?: string | null;
  archived?: boolean | null;
}) {
  await requireOrgMember(orgId);
  const thread = await prisma.chatThread.findFirst({ where: { id: threadId, organizationId: orgId, archivedAt: null } });
  if (!thread) return null;

  const updated = await prisma.chatThread.update({
    where: { id: threadId },
    data: {
      ...(title !== undefined ? { title: title?.trim() || thread.title } : {}),
      ...(archived === true ? { archivedAt: new Date() } : {})
    },
    include: threadDetailInclude
  });

  return serializeThreadDetail(updated);
}

type ChatMessageInput = {
  orgId: string;
  threadId: string;
  body: string;
  fileIds?: string[];
  attachmentNames?: string[];
  mentions?: string[];
};

type ActiveThread = NonNullable<Awaited<ReturnType<typeof loadActiveThread>>>;

export type ChatMessagePreparation = {
  userId: string;
  organizationName: string;
  thread: ActiveThread;
  mentions: ChatMention[];
  attachments: Awaited<ReturnType<typeof persistChatAttachments>>;
  trimmedBody: string;
  responseAgentId: string | null;
};

/**
 * Persist the user's message and return everything needed to generate an
 * assistant response (and downstream action log entries). Used by both the
 * standard request/response send and the streaming send.
 */
export async function prepareChatMessage({
  orgId,
  threadId,
  body,
  fileIds = [],
  attachmentNames = [],
  mentions = []
}: ChatMessageInput): Promise<ChatMessagePreparation | null> {
  const { user, organization } = await requireOrgMember(orgId);
  const thread = await loadActiveThread(orgId, threadId);
  if (!thread) return null;

  const trimmedBody = body.trim();
  const resolvedMentions = await resolveMentions({ orgId, body, mentions });
  const attachments = await persistChatAttachments({
    orgId,
    threadId,
    taskId: thread.taskId,
    userId: user.id,
    fileIds,
    attachmentNames
  });

  await prisma.chatMessage.create({
    data: {
      organizationId: orgId,
      threadId,
      senderType: "user",
      senderUserId: user.id,
      body: trimmedBody,
      metadataJson: json({
        kind: "user_message",
        mentions: resolvedMentions,
        fileIds: attachments.map((file) => file.id),
        attachments
      })
    }
  });

  return {
    userId: user.id,
    organizationName: organization.name,
    thread,
    mentions: resolvedMentions,
    attachments,
    trimmedBody,
    responseAgentId: thread.agentId ?? thread.task?.agentId ?? null
  };
}

/**
 * Persist the assistant response, append the action log summary, bump the
 * thread timestamp, and return the canonical thread detail snapshot.
 */
export async function finalizeChatMessage({
  orgId,
  threadId,
  preparation,
  responseBody,
  responseMetadata
}: {
  orgId: string;
  threadId: string;
  preparation: ChatMessagePreparation;
  responseBody: string;
  responseMetadata: Record<string, unknown>;
}) {
  const { responseAgentId, attachments } = preparation;

  const actionMessages = await createActionMessages({
    orgId,
    threadId,
    agentId: responseAgentId,
    attachmentCount: attachments.length
  });

  await prisma.chatMessage.create({
    data: {
      organizationId: orgId,
      threadId,
      senderType: responseAgentId ? "agent" : "system",
      senderAgentId: responseAgentId,
      body: responseBody,
      metadataJson: json(responseMetadata)
    }
  });

  await prisma.chatMessage.create({
    data: {
      organizationId: orgId,
      threadId,
      senderType: "system",
      body: `Ran ${actionMessages.length} action${actionMessages.length === 1 ? "" : "s"}.`,
      metadataJson: json({
        kind: "action_log",
        actionType: "run.summary",
        status: "completed",
        count: actionMessages.length
      })
    }
  });

  await prisma.chatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

  return getChatThreadDetail(orgId, threadId);
}

async function loadActiveThread(orgId: string, threadId: string) {
  return prisma.chatThread.findFirst({
    where: { id: threadId, organizationId: orgId, archivedAt: null },
    include: { task: true, agent: true }
  });
}

export async function sendChatMessage(input: ChatMessageInput) {
  const preparation = await prepareChatMessage(input);
  if (!preparation) return null;

  const response = await generateChatResponse({
    body: preparation.trimmedBody,
    organizationName: preparation.organizationName,
    threadKind: preparation.thread.kind,
    mentions: preparation.mentions,
    attachmentNames: preparation.attachments.map((file) => file.name)
  });

  return finalizeChatMessage({
    orgId: input.orgId,
    threadId: input.threadId,
    preparation,
    responseBody: response.body,
    responseMetadata: response.metadata
  });
}

export function chatThreadNotFoundResponse() {
  return errorResponse("NOT_FOUND", "Chat thread not found", 404);
}

function normalizeThreadFilters(query: ChatThreadQuery) {
  const kind = query.kind && ["cofounder", "task", "department"].includes(query.kind) ? query.kind : null;
  return {
    kind,
    taskId: cleanFilter(query.taskId),
    agentId: cleanFilter(query.agentId),
    q: query.q?.trim() ?? ""
  };
}

function threadWhere(orgId: string, filters: ReturnType<typeof normalizeThreadFilters>): Prisma.ChatThreadWhereInput {
  return {
    organizationId: orgId,
    archivedAt: null,
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.taskId ? { taskId: filters.taskId } : {}),
    ...(filters.agentId ? { agentId: filters.agentId } : {}),
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q } },
            { task: { title: { contains: filters.q } } },
            { agent: { name: { contains: filters.q } } },
            { messages: { some: { body: { contains: filters.q } } } }
          ]
        }
      : {})
  };
}

async function resolveMentions({ orgId, body, mentions }: { orgId: string; body: string; mentions: string[] }) {
  const bodyMentions = Array.from(body.matchAll(/@([a-z0-9-]+)/gi)).map((match) => match[1]?.toLowerCase()).filter(Boolean);
  const keys = Array.from(new Set([...mentions.map((mention) => mention.toLowerCase()), ...bodyMentions]));
  if (!keys.length) return [];

  const [departments, agents, members] = await Promise.all([
    prisma.department.findMany({ where: { organizationId: orgId } }),
    prisma.agent.findMany({ where: { organizationId: orgId, archivedAt: null } }),
    prisma.membership.findMany({ where: { organizationId: orgId, user: { deletedAt: null } }, include: { user: true } })
  ]);

  const resolved: ChatMention[] = [];
  for (const key of keys) {
    const department = departments.find((item) => item.slug === key || slugify(item.name) === key);
    if (department) {
      resolved.push({ type: "department", id: department.id, key: department.slug, label: department.name, color: department.color });
      continue;
    }
    const agent = agents.find((item) => item.slug === key || slugify(item.name) === key);
    if (agent) {
      resolved.push({ type: "agent", id: agent.id, key: agent.slug, label: agent.name });
      continue;
    }
    const member = members.find((item) => slugify(item.user.preferredName ?? item.user.name ?? item.user.email ?? "member") === key);
    if (member) {
      resolved.push({
        type: "member",
        id: member.user.id,
        key,
        label: member.user.preferredName ?? member.user.name ?? member.user.email ?? "Member"
      });
    }
  }

  return resolved;
}

async function persistChatAttachments({
  orgId,
  threadId,
  taskId,
  userId,
  fileIds,
  attachmentNames
}: {
  orgId: string;
  threadId: string;
  taskId: string | null;
  userId: string;
  fileIds: string[];
  attachmentNames: string[];
}) {
  const cleanFileIds = Array.from(new Set(fileIds.map((id) => id.trim()).filter(Boolean))).slice(0, 12);
  if (cleanFileIds.length && taskId) {
    await prisma.file.updateMany({
      where: { organizationId: orgId, id: { in: cleanFileIds }, archivedAt: null },
      data: { taskId }
    });
  }

  const existing = cleanFileIds.length
    ? await prisma.file.findMany({ where: { organizationId: orgId, id: { in: cleanFileIds }, archivedAt: null } })
    : [];
  const cleanNames = Array.from(new Set(attachmentNames.map((name) => name.trim()).filter(Boolean))).slice(0, 8);
  const created = [];

  for (const [index, name] of cleanNames.entries()) {
    created.push(await prisma.file.create({
      data: {
        organizationId: orgId,
        taskId,
        uploadedByUserId: userId,
        name,
        mimeType: null,
        sizeBytes: 0,
        storageKey: `chat/${threadId}/${Date.now()}-${index}-${slugify(name)}`,
        visibility: taskId ? "task" : "thread",
        metadataJson: json({ source: "chat_attachment", threadId, originalName: name })
      }
    }));
  }

  return [...existing, ...created].map(serializeFile);
}

async function createActionMessages({
  orgId,
  threadId,
  agentId,
  attachmentCount
}: {
  orgId: string;
  threadId: string;
  agentId: string | null;
  attachmentCount: number;
}) {
  const messages = [
    {
      body: "Writing to workspace...",
      actionType: "workspace.write"
    },
    ...(attachmentCount
      ? [{ body: "Saving workspace files.", actionType: "files.save" }]
      : [])
  ];

  for (const message of messages) {
    await prisma.chatMessage.create({
      data: {
        organizationId: orgId,
        threadId,
        senderType: "system",
        senderAgentId: agentId,
        body: message.body,
        metadataJson: json({
          kind: "action_log",
          actionType: message.actionType,
          status: "completed"
        })
      }
    });
  }

  return messages;
}

function serializeThreadSummary(thread: ThreadRecord) {
  const latestMessage = thread.messages[0] ?? null;
  return {
    id: thread.id,
    organizationId: thread.organizationId,
    title: thread.title ?? "Untitled thread",
    kind: thread.kind,
    task: thread.task ? serializeTaskLite(thread.task) : null,
    agent: thread.agent ? serializeAgentLite(thread.agent) : null,
    createdBy: thread.createdBy ? serializeUser(thread.createdBy) : null,
    messageCount: thread._count.messages,
    latestMessage: latestMessage ? serializeMessage(latestMessage) : null,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString()
  };
}

function serializeThreadDetail(thread: ThreadDetailRecord) {
  return {
    ...serializeThreadSummary({
      ...thread,
      messages: thread.messages.length ? [thread.messages[thread.messages.length - 1]] : [],
      _count: thread._count
    }),
    messages: thread.messages.map(serializeMessage)
  };
}

function serializeMessage(message: {
  id: string;
  senderType: string;
  senderUser: { id: string; name: string | null; preferredName: string | null; email: string | null; avatarUrl: string | null } | null;
  senderAgent: { id: string; name: string; slug: string } | null;
  body: string;
  metadataJson: string | null;
  createdAt: Date;
  editedAt: Date | null;
}) {
  return {
    id: message.id,
    senderType: message.senderType,
    senderUser: message.senderUser ? serializeUser(message.senderUser) : null,
    senderAgent: message.senderAgent ? { id: message.senderAgent.id, name: message.senderAgent.name, slug: message.senderAgent.slug } : null,
    body: message.body,
    metadata: parseJsonObject(message.metadataJson),
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null
  };
}

function serializeTaskLite(task: {
  id: string;
  title: string;
  status: string;
  type: string;
  department?: { id: string; name: string; slug: string; color: string } | null;
  agent?: { id: string; name: string; slug: string; status: string } | null;
}) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    type: task.type,
    department: task.department
      ? { id: task.department.id, name: task.department.name, slug: task.department.slug, color: task.department.color }
      : null,
    agent: task.agent ? { id: task.agent.id, name: task.agent.name, slug: task.agent.slug, status: task.agent.status } : null
  };
}

function serializeAgentLite(agent: { id: string; name: string; slug: string; status: string; department?: { id: string; name: string; slug: string; color: string } | null }) {
  return {
    id: agent.id,
    name: agent.name,
    slug: agent.slug,
    status: agent.status,
    department: agent.department
      ? { id: agent.department.id, name: agent.department.name, slug: agent.department.slug, color: agent.department.color }
      : null
  };
}

function serializeUser(user: { id: string; name: string | null; preferredName: string | null; email: string | null; avatarUrl: string | null }) {
  return {
    id: user.id,
    name: user.preferredName ?? user.name ?? user.email ?? "Member",
    email: user.email,
    avatarUrl: user.avatarUrl
  };
}

function serializeFile(file: { id: string; name: string; mimeType: string | null; sizeBytes: number; visibility: string; storageKey: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    visibility: file.visibility,
    storageKey: file.storageKey,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString()
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

function cleanFilter(value?: string | null) {
  if (!value || value === "all" || value === "none") return null;
  return value;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
}
