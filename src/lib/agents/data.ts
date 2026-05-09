import type { Prisma } from "@prisma/client";
import { errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { advanceSandboxSession, createSandboxSessionForTask } from "@/lib/queue/sandbox-execution";
import { agentSkillCatalog, normalizeSkillKeys, skillsForDepartment } from "@/data/agents";

const json = (value: unknown) => JSON.stringify(value);

const agentSummaryInclude = {
  department: true,
  inboxes: { include: { inboxDomain: true }, orderBy: { createdAt: "asc" as const } },
  tasks: {
    where: { archivedAt: null },
    orderBy: { updatedAt: "desc" as const },
    take: 4
  },
  sessions: {
    orderBy: { createdAt: "desc" as const },
    include: {
      task: true,
      actions: { orderBy: { createdAt: "desc" as const }, take: 4 }
    },
    take: 3
  },
  _count: { select: { tasks: true, sessions: true, actions: true } }
} satisfies Prisma.AgentInclude;

const agentDetailInclude = {
  ...agentSummaryInclude,
  tasks: {
    where: { archivedAt: null },
    include: { roadmapItem: true },
    orderBy: { updatedAt: "desc" as const },
    take: 10
  },
  sessions: {
    orderBy: { createdAt: "desc" as const },
    include: {
      task: true,
      actions: { orderBy: { createdAt: "asc" as const } }
    },
    take: 8
  }
} satisfies Prisma.AgentInclude;

const sessionInclude = {
  task: {
    include: {
      department: true,
      chatThreads: {
        where: { kind: "task", archivedAt: null },
        include: {
          messages: {
            orderBy: { createdAt: "asc" as const },
            include: { senderUser: true, senderAgent: true }
          }
        },
        orderBy: { updatedAt: "desc" as const },
        take: 1
      },
      files: { where: { archivedAt: null }, orderBy: { updatedAt: "desc" as const } }
    }
  },
  agent: { include: { department: true } },
  actions: { orderBy: { createdAt: "asc" as const } }
} satisfies Prisma.TaskSessionInclude;

type AgentSummaryRecord = Prisma.AgentGetPayload<{ include: typeof agentSummaryInclude }>;
type AgentDetailRecord = Prisma.AgentGetPayload<{ include: typeof agentDetailInclude }>;
type SessionRecord = Prisma.TaskSessionGetPayload<{ include: typeof sessionInclude }>;

export type AgentWorkspaceData = Awaited<ReturnType<typeof getAgentWorkspaceData>>;
export type AgentDetailData = Awaited<ReturnType<typeof getAgentDetail>>;
export type SessionDetailData = Awaited<ReturnType<typeof getSessionDetail>>;

export async function getAgentWorkspaceData(orgId: string, query: { departmentId?: string | null; status?: string | null; q?: string | null } = {}) {
  await requireOrgMember(orgId);
  const filters = {
    departmentId: cleanFilter(query.departmentId),
    status: cleanFilter(query.status),
    q: query.q?.trim() ?? ""
  };

  const where: Prisma.AgentWhereInput = {
    organizationId: orgId,
    archivedAt: null,
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q } },
            { description: { contains: filters.q } },
            { prompt: { contains: filters.q } },
            { department: { name: { contains: filters.q } } }
          ]
        }
      : {})
  };

  const [agents, departments, domains] = await Promise.all([
    prisma.agent.findMany({
      where,
      include: agentSummaryInclude,
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    }),
    prisma.department.findMany({
      where: { organizationId: orgId },
      orderBy: { sortOrder: "asc" }
    }),
    prisma.inboxDomain.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" }
    })
  ]);

  return {
    filters,
    agents: agents.map(serializeAgentSummary),
    departments: departments.map((department) => ({
      id: department.id,
      slug: department.slug,
      name: department.name,
      availability: department.availability,
      color: department.color
    })),
    inboxDomains: domains.map((domain) => ({
      id: domain.id,
      domain: domain.domain,
      status: domain.status
    })),
    skills: agentSkillCatalog,
    statusCounts: await countStatuses(orgId)
  };
}

export async function getAgentDetail(orgId: string, agentId: string) {
  await requireOrgMember(orgId);
  const agent = await prisma.agent.findFirst({
    where: { organizationId: orgId, archivedAt: null, OR: [{ id: agentId }, { slug: agentId }] },
    include: agentDetailInclude
  });

  return agent ? serializeAgentDetail(agent) : null;
}

export async function createAgent({
  orgId,
  departmentId,
  name,
  description,
  model,
  prompt,
  skillKeys,
  permissionMode,
  inboxAddress
}: {
  orgId: string;
  departmentId: string;
  name: string;
  description?: string | null;
  model?: string | null;
  prompt?: string | null;
  skillKeys?: string[];
  permissionMode?: string | null;
  inboxAddress?: string | null;
}) {
  await requireOrgAdmin(orgId);
  const [organization, department] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.department.findFirst({ where: { id: departmentId, organizationId: orgId } })
  ]);

  if (!organization || !department) {
    return null;
  }

  const slug = await uniqueAgentSlug(orgId, name);
  const skills = normalizeSkillKeys(skillKeys, department.slug);
  const agent = await prisma.agent.create({
    data: {
      organizationId: orgId,
      departmentId,
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      isDefault: false,
      status: "idle",
      model: model ?? "claude-sonnet-sandbox",
      prompt: prompt?.trim() || null,
      toolsJson: json({ skillKeys: skills }),
      permissionsJson: json({ mode: permissionMode ?? "review_required", dangerousActionsRequireApproval: true }),
      inboxAddress: inboxAddress?.trim() || defaultInboxAddress(slug, organization.slug)
    }
  });

  await ensureAgentInbox({ orgId, organizationSlug: organization.slug, agentId: agent.id, address: agent.inboxAddress });

  return getAgentDetail(orgId, agent.id);
}

export async function updateAgent({
  orgId,
  agentId,
  name,
  description,
  departmentId,
  status,
  model,
  prompt,
  skillKeys,
  permissionMode,
  inboxAddress
}: {
  orgId: string;
  agentId: string;
  name?: string | null;
  description?: string | null;
  departmentId?: string | null;
  status?: string | null;
  model?: string | null;
  prompt?: string | null;
  skillKeys?: string[];
  permissionMode?: string | null;
  inboxAddress?: string | null;
}) {
  await requireOrgAdmin(orgId);
  const existing = await prisma.agent.findFirst({
    where: { organizationId: orgId, archivedAt: null, OR: [{ id: agentId }, { slug: agentId }] },
    include: { department: true, organization: true }
  });

  if (!existing) return null;

  const nextDepartment = departmentId
    ? await prisma.department.findFirst({ where: { id: departmentId, organizationId: orgId } })
    : null;
  const departmentSlug = nextDepartment?.slug ?? existing.department.slug;
  const nextSkills = skillKeys ? normalizeSkillKeys(skillKeys, departmentSlug) : null;
  const nextPermissions = permissionMode ? { ...parseJsonObject(existing.permissionsJson), mode: permissionMode, dangerousActionsRequireApproval: permissionMode !== "trusted" } : null;
  const nextInboxAddress = inboxAddress?.trim() || existing.inboxAddress || defaultInboxAddress(existing.slug, existing.organization.slug);

  await prisma.agent.update({
    where: { id: existing.id },
    data: {
      ...(name !== undefined ? { name: name?.trim() || existing.name } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
      ...(status !== undefined && status ? { status } : {}),
      ...(model !== undefined ? { model: model?.trim() || null } : {}),
      ...(prompt !== undefined ? { prompt: prompt?.trim() || null } : {}),
      ...(departmentId !== undefined && nextDepartment ? { departmentId: nextDepartment.id } : {}),
      ...(nextSkills ? { toolsJson: json({ skillKeys: nextSkills }) } : {}),
      ...(nextPermissions ? { permissionsJson: json(nextPermissions) } : {}),
      ...(inboxAddress !== undefined ? { inboxAddress: nextInboxAddress } : {})
    }
  });

  if (inboxAddress !== undefined) {
    await ensureAgentInbox({ orgId, organizationSlug: existing.organization.slug, agentId: existing.id, address: nextInboxAddress });
  }

  return getAgentDetail(orgId, existing.id);
}

export async function launchAgentSession({
  orgId,
  agentId,
  taskId,
  message
}: {
  orgId: string;
  agentId: string;
  taskId?: string | null;
  message?: string | null;
}) {
  const { user } = await requireOrgMember(orgId);
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, organizationId: orgId, archivedAt: null },
    include: { department: true }
  });

  if (!agent) return { kind: "not_found" as const };

  let task = taskId
    ? await prisma.task.findFirst({ where: { id: taskId, organizationId: orgId, archivedAt: null }, include: { approvals: true } })
    : null;

  if (task?.approvals.some((approval) => approval.status === "pending")) {
    return { kind: "approval_required" as const, taskId: task.id };
  }

  if (!task) {
    task = await prisma.task.create({
      data: {
        organizationId: orgId,
        departmentId: agent.departmentId,
        agentId: agent.id,
        createdByUserId: user.id,
        title: firstLine(message) ?? `${agent.name} run`,
        description: message?.trim() || `Launch ${agent.name} from the agent workspace.`,
        type: "agent_task",
        status: "running",
        priority: 1,
        startedAt: new Date(),
        metadataJson: json({ source: "agent_launch" })
      },
      include: { approvals: true }
    });
  } else if (task.agentId !== agent.id) {
    task = await prisma.task.update({
      where: { id: task.id },
      data: { agentId: agent.id, departmentId: agent.departmentId, status: "running", startedAt: task.startedAt ?? new Date() },
      include: { approvals: true }
    });
  }

  const session = await createSandboxSessionForTask({ orgId, taskId: task.id, agentId: agent.id, message });
  if (!session) return { kind: "not_found" as const };

  return {
    kind: "launched" as const,
    session: serializeSessionMinimal(session),
    taskId: task.id
  };
}

export async function getSessionDetail(orgId: string, sessionId: string) {
  await requireOrgMember(orgId);
  const session = await prisma.taskSession.findFirst({
    where: { id: sessionId, organizationId: orgId },
    include: sessionInclude
  });

  return session ? serializeSessionDetail(session) : null;
}

export async function getSessionActions(orgId: string, sessionId: string) {
  await requireOrgMember(orgId);
  const session = await prisma.taskSession.findFirst({
    where: { id: sessionId, organizationId: orgId },
    include: { actions: { orderBy: { createdAt: "asc" } } }
  });

  return session ? session.actions.map(serializeAction) : null;
}

export async function advanceSessionActions(orgId: string, sessionId: string, finish = false) {
  await requireOrgMember(orgId);
  const session = await advanceSandboxSession({ orgId, sessionId, finish });
  return session ? getSessionDetail(orgId, sessionId) : null;
}

export async function updateSessionScratchpad({ orgId, sessionId, scratchpad }: { orgId: string; sessionId: string; scratchpad: string }) {
  await requireOrgMember(orgId);
  const session = await prisma.taskSession.findFirst({ where: { id: sessionId, organizationId: orgId } });
  if (!session) return null;

  await prisma.taskSession.update({
    where: { id: sessionId },
    data: { scratchpad }
  });

  return getSessionDetail(orgId, sessionId);
}

export function agentNotFoundResponse() {
  return errorResponse("NOT_FOUND", "Agent not found", 404);
}

export function sessionNotFoundResponse() {
  return errorResponse("NOT_FOUND", "Agent session not found", 404);
}

function serializeAgentSummary(agent: AgentSummaryRecord) {
  const tools = parseJsonObject(agent.toolsJson);
  const permissions = parseJsonObject(agent.permissionsJson);
  const skillKeys = Array.isArray(tools.skillKeys) ? tools.skillKeys.filter((key): key is string => typeof key === "string") : [];

  return {
    id: agent.id,
    organizationId: agent.organizationId,
    departmentId: agent.departmentId,
    name: agent.name,
    slug: agent.slug,
    description: agent.description,
    isDefault: agent.isDefault,
    status: agent.status,
    model: agent.model,
    prompt: agent.prompt,
    inboxAddress: agent.inboxAddress,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    department: {
      id: agent.department.id,
      slug: agent.department.slug,
      name: agent.department.name,
      color: agent.department.color,
      availability: agent.department.availability
    },
    skills: agentSkillCatalog.filter((skill) => skillKeys.includes(skill.key)),
    recommendedSkills: skillsForDepartment(agent.department.slug),
    permissionMode: typeof permissions.mode === "string" ? permissions.mode : "review_required",
    inboxes: agent.inboxes.map((inbox) => ({
      id: inbox.id,
      address: inbox.address,
      status: inbox.status,
      domain: inbox.inboxDomain?.domain ?? null
    })),
    counts: {
      tasks: agent._count.tasks,
      sessions: agent._count.sessions,
      actions: agent._count.actions
    },
    recentTasks: agent.tasks.map(serializeTaskLite),
    recentSessions: agent.sessions.map(serializeSessionWithTask)
  };
}

function serializeAgentDetail(agent: AgentDetailRecord) {
  return {
    ...serializeAgentSummary(agent),
    tasks: agent.tasks.map((task) => ({
      ...serializeTaskLite(task),
      roadmapItem: task.roadmapItem ? { id: task.roadmapItem.id, title: task.roadmapItem.title, status: task.roadmapItem.status } : null
    })),
    sessions: agent.sessions.map(serializeSessionWithTask)
  };
}

function serializeSessionDetail(session: SessionRecord) {
  const thread = session.task.chatThreads[0] ?? null;
  return {
    id: session.id,
    status: session.status,
    browserUrl: session.browserUrl,
    replayUrl: session.replayUrl,
    scratchpad: session.scratchpad,
    elapsedMs: currentElapsed(session),
    startedAt: session.startedAt?.toISOString() ?? null,
    finishedAt: session.finishedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    task: {
      id: session.task.id,
      title: session.task.title,
      description: session.task.description,
      status: session.task.status,
      type: session.task.type,
      department: session.task.department
        ? { id: session.task.department.id, name: session.task.department.name, slug: session.task.department.slug, color: session.task.department.color }
        : null,
      attachments: session.task.files.map((file) => ({
        id: file.id,
        name: file.name,
        visibility: file.visibility,
        sizeBytes: file.sizeBytes
      }))
    },
    agent: session.agent
      ? {
          id: session.agent.id,
          name: session.agent.name,
          slug: session.agent.slug,
          status: session.agent.status,
          model: session.agent.model,
          department: {
            id: session.agent.department.id,
            name: session.agent.department.name,
            slug: session.agent.department.slug,
            color: session.agent.department.color
          }
        }
      : null,
    actions: session.actions.map(serializeAction),
    messages: thread
      ? thread.messages.map((message) => ({
          id: message.id,
          senderType: message.senderType,
          body: message.body,
          metadata: parseJsonObject(message.metadataJson),
          createdAt: message.createdAt.toISOString(),
          senderUser: message.senderUser
            ? { id: message.senderUser.id, name: message.senderUser.preferredName ?? message.senderUser.name ?? message.senderUser.email ?? "Member" }
            : null,
          senderAgent: message.senderAgent ? { id: message.senderAgent.id, name: message.senderAgent.name } : null
        }))
      : []
  };
}

function serializeTaskLite(task: { id: string; title: string; status: string; type: string; updatedAt: Date; priority?: number | null }) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    type: task.type,
    priority: task.priority ?? 0,
    updatedAt: task.updatedAt.toISOString()
  };
}

function serializeSessionWithTask(session: {
  id: string;
  status: string;
  elapsedMs: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  task: { id: string; title: string; status: string } | null;
  actions: Array<{ id: string; label: string; actionType: string; status: string; payloadJson: string | null; createdAt: Date; completedAt: Date | null }>;
}) {
  return {
    ...serializeSessionMinimal(session),
    task: session.task ? { id: session.task.id, title: session.task.title, status: session.task.status } : null,
    actions: session.actions.map(serializeAction)
  };
}

function serializeSessionMinimal(session: { id: string; status: string; elapsedMs: number; startedAt: Date | null; finishedAt: Date | null; createdAt: Date }) {
  return {
    id: session.id,
    status: session.status,
    elapsedMs: currentElapsed(session),
    startedAt: session.startedAt?.toISOString() ?? null,
    finishedAt: session.finishedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString()
  };
}

function serializeAction(action: { id: string; label: string; actionType: string; status: string; payloadJson: string | null; createdAt: Date; completedAt: Date | null }) {
  return {
    id: action.id,
    label: action.label,
    actionType: action.actionType,
    status: action.status,
    payload: parseJsonObject(action.payloadJson),
    createdAt: action.createdAt.toISOString(),
    completedAt: action.completedAt?.toISOString() ?? null
  };
}

async function countStatuses(orgId: string) {
  const grouped = await prisma.agent.groupBy({
    by: ["status"],
    where: { organizationId: orgId, archivedAt: null },
    _count: { status: true }
  });
  return grouped.map((item) => ({ status: item.status, count: item._count.status }));
}

async function ensureAgentInbox({
  orgId,
  organizationSlug,
  agentId,
  address
}: {
  orgId: string;
  organizationSlug: string;
  agentId: string;
  address: string | null;
}) {
  if (!address) return;
  const domainName = `${organizationSlug}.sandbox.local`;
  const domain = await prisma.inboxDomain.upsert({
    where: { organizationId_domain: { organizationId: orgId, domain: domainName } },
    update: { status: "sandbox" },
    create: {
      organizationId: orgId,
      domain: domainName,
      status: "sandbox",
      dnsRecordsJson: json({ mx: "sandbox-mail.cofounder.local" })
    }
  });

  await prisma.agentInbox.upsert({
    where: { organizationId_address: { organizationId: orgId, address } },
    update: { agentId, inboxDomainId: domain.id, status: "active" },
    create: {
      organizationId: orgId,
      agentId,
      inboxDomainId: domain.id,
      address,
      status: "active"
    }
  });
}

async function uniqueAgentSlug(orgId: string, name: string) {
  const base = slugify(name) || "agent";
  let slug = base;
  let index = 2;
  while (await prisma.agent.findUnique({ where: { organizationId_slug: { organizationId: orgId, slug } } })) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
}

function defaultInboxAddress(slug: string, organizationSlug: string) {
  return `${slug}@${organizationSlug}.sandbox.local`;
}

function currentElapsed(session: { status: string; elapsedMs: number; startedAt: Date | null; finishedAt: Date | null; createdAt: Date }) {
  if (session.status === "running" && session.startedAt) {
    return Math.max(session.elapsedMs, Date.now() - session.startedAt.getTime());
  }
  return session.elapsedMs;
}

function firstLine(value?: string | null) {
  return value?.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function cleanFilter(value?: string | null) {
  if (!value || value === "all" || value === "none") return null;
  return value;
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

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

