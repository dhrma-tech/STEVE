import { errorResponse } from "@/lib/api/responses";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { roadmapDefinitions } from "@/lib/onboarding/definitions";
import {
  roadmapDependencyPairs,
  roadmapStageDescriptions,
  roadmapStatusMeta,
  roadmapWorkTypeMeta,
  workTypeFor,
  type RoadmapStatus
} from "@/data/roadmap";

const json = (value: unknown) => JSON.stringify(value);

type RoadmapTaskPayload = {
  id: string;
  title: string;
  status: string;
  type: string;
  updatedAt: string;
  agent: { id: string; name: string; status: string } | null;
};

export type RoadmapData = Awaited<ReturnType<typeof getRoadmapData>>;
export type RoadmapItemDetailData = Awaited<ReturnType<typeof getRoadmapItemDetail>>;
export type RoadmapLaunchResult = Awaited<ReturnType<typeof launchRoadmapItem>>;

export async function getRoadmapData(orgId: string) {
  await requireOrgMember(orgId);
  await ensureRoadmapStructure(orgId);
  await syncRoadmapUnlocks(orgId);

  const [organization, stages] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
    prisma.roadmapStage.findMany({
      where: { organizationId: orgId },
      include: {
        items: {
          include: {
            department: true,
            dependencies: { include: { dependsOn: true } },
            unlocks: { include: { item: true } },
            tasks: {
              where: { archivedAt: null },
              include: { agent: true },
              orderBy: { updatedAt: "desc" },
              take: 3
            }
          },
          orderBy: { sortOrder: "asc" }
        }
      },
      orderBy: { sortOrder: "asc" }
    })
  ]);

  const serializedStages = stages.map((stage) => {
    const items = stage.items.map(serializeRoadmapItem);
    const completeCount = items.filter((item) => item.status === "complete").length;
    const availableCount = items.filter((item) => item.status === "available").length;
    const lockedCount = items.filter((item) => item.status === "locked").length;

    return {
      id: stage.id,
      key: stage.key,
      name: stage.name,
      sortOrder: stage.sortOrder,
      description: roadmapStageDescriptions[stage.key] ?? "Company-building stage.",
      itemCount: items.length,
      completeCount,
      availableCount,
      lockedCount,
      progress: items.length ? Math.round((completeCount / items.length) * 100) : 0,
      sourceStatus: stage.key === "mature" && items.length === 0 ? "open_source_gap" : "listed",
      items
    };
  });

  const flatItems = serializedStages.flatMap((stage) => stage.items);
  const progress = progressFor(flatItems);

  if (organization.roadmapProgress !== progress.percent) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { roadmapProgress: progress.percent }
    });
  }

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      roadmapProgress: progress.percent
    },
    progress,
    stages: serializedStages,
    dependencies: flatItems.flatMap((item) =>
      item.requiredFirst.map((dependency) => ({
        itemId: item.id,
        itemKey: item.key,
        dependsOnItemId: dependency.id,
        dependsOnKey: dependency.key
      }))
    ),
    nextItems: flatItems.filter((item) => item.status === "available").slice(0, 6),
    blockedItems: flatItems.filter((item) => item.status === "locked").slice(0, 6)
  };
}

export async function getRoadmapItemDetail(orgId: string, itemId: string) {
  await requireOrgMember(orgId);
  await ensureRoadmapStructure(orgId);
  await syncRoadmapUnlocks(orgId);
  const item = await findRoadmapItem(orgId, itemId);
  return item ? serializeRoadmapItem(item) : null;
}

export async function launchRoadmapItem({
  orgId,
  itemId,
  input,
  agentId
}: {
  orgId: string;
  itemId: string;
  input?: string | null;
  agentId?: string | null;
}) {
  const { user } = await requireOrgMember(orgId);
  await ensureRoadmapStructure(orgId);
  await syncRoadmapUnlocks(orgId);
  const item = await findRoadmapItem(orgId, itemId);

  if (!item) {
    return { kind: "not_found" as const };
  }

  const serialized = serializeRoadmapItem(item);

  if (serialized.status === "locked") {
    return {
      kind: "blocked" as const,
      item: serialized,
      missing: serialized.requiredFirst.filter((dependency) => dependency.status !== "complete")
    };
  }

  if (serialized.status === "complete") {
    return { kind: "already_complete" as const, item: serialized };
  }

  const workType = workTypeFor(item.workType);
  const defaultAgent = agentId
    ? await prisma.agent.findFirst({ where: { id: agentId, organizationId: orgId, archivedAt: null } })
    : item.departmentId
      ? await prisma.agent.findFirst({
          where: { organizationId: orgId, departmentId: item.departmentId, isDefault: true, archivedAt: null },
          orderBy: { createdAt: "asc" }
        })
      : null;

  if (workType === "user" && !input?.trim()) {
    return { kind: "input_required" as const, item: serialized };
  }

  const existing = await prisma.task.findFirst({
    where: {
      organizationId: orgId,
      roadmapItemId: item.id,
      archivedAt: null,
      status: { notIn: ["completed", "canceled", "archived"] }
    },
    include: { agent: true },
    orderBy: { updatedAt: "desc" }
  });

  if (existing) {
    return { kind: "existing_task" as const, item: serialized, task: serializeTask(existing) };
  }

  const task = await prisma.task.create({
    data: {
      organizationId: orgId,
      departmentId: item.departmentId,
      agentId: workType === "agent" ? defaultAgent?.id ?? null : null,
      roadmapItemId: item.id,
      createdByUserId: user.id,
      title: item.title,
      description: buildTaskDescription({ item, input, workType }),
      type: workType === "agent" ? "agent_task" : workType === "approval" ? "approval_task" : "user_task",
      status: workType === "approval" ? "blocked" : "queued",
      priority: item.status === "available" ? 2 : 1,
      metadataJson: json({
        source: "roadmap",
        itemKey: item.key,
        workType,
        launchInput: input?.trim() ?? null
      })
    },
    include: { agent: true }
  });

  if (workType === "approval") {
    const approval = await prisma.approval.create({
      data: {
        organizationId: orgId,
        taskId: task.id,
        requestedByAgentId: defaultAgent?.id ?? null,
        title: `Approval needed: ${item.title}`,
        description: item.howToMoveForward ?? "Review and approve this roadmap action.",
        riskLevel: "medium",
        status: "pending"
      }
    });

    return { kind: "approval_requested" as const, item: serialized, task: serializeTask(task), approval };
  }

  return { kind: "task_created" as const, item: serialized, task: serializeTask(task) };
}

export async function completeRoadmapItem({
  orgId,
  itemId
}: {
  orgId: string;
  itemId: string;
}) {
  await requireOrgMember(orgId);
  await ensureRoadmapStructure(orgId);
  await syncRoadmapUnlocks(orgId);
  const item = await findRoadmapItem(orgId, itemId);

  if (!item) {
    return { kind: "not_found" as const };
  }

  const serialized = serializeRoadmapItem(item);
  if (serialized.requiredFirst.some((dependency) => dependency.status !== "complete")) {
    return {
      kind: "blocked" as const,
      item: serialized,
      missing: serialized.requiredFirst.filter((dependency) => dependency.status !== "complete")
    };
  }

  const updated = await prisma.roadmapItem.update({
    where: { id: item.id },
    data: { status: "complete", completedAt: item.completedAt ?? new Date() },
    include: roadmapItemInclude()
  });

  await prisma.task.updateMany({
    where: { organizationId: orgId, roadmapItemId: item.id, archivedAt: null, status: { notIn: ["completed", "canceled", "archived"] } },
    data: { status: "completed", completedAt: new Date() }
  });

  await syncRoadmapUnlocks(orgId);
  const roadmap = await getRoadmapData(orgId);

  return {
    kind: "completed" as const,
    item: serializeRoadmapItem(updated),
    progress: roadmap.progress,
    unlocked: roadmap.stages.flatMap((stage) => stage.items).filter((candidate) => candidate.status === "available")
  };
}

export function roadmapNotFoundResponse() {
  return errorResponse("NOT_FOUND", "Roadmap item not found", 404);
}

export async function ensureRoadmapStructure(orgId: string) {
  const departments = await prisma.department.findMany({ where: { organizationId: orgId } });
  const departmentBySlug = new Map(departments.map((department) => [department.slug, department.id]));
  const itemByKey = new Map<string, string>();

  for (const [stageIndex, stage] of roadmapDefinitions.entries()) {
    const roadmapStage = await prisma.roadmapStage.upsert({
      where: { organizationId_key: { organizationId: orgId, key: stage.key } },
      update: { name: stage.name, sortOrder: stageIndex },
      create: {
        organizationId: orgId,
        key: stage.key,
        name: stage.name,
        sortOrder: stageIndex
      }
    });

    for (const [itemIndex, item] of stage.items.entries()) {
      const [key, title, sourceStatus, workType] = item;
      const created = await prisma.roadmapItem.upsert({
        where: { organizationId_key: { organizationId: orgId, key } },
        update: {
          stageId: roadmapStage.id,
          title,
          description: `${title} roadmap item.`,
          workType,
          departmentId: departmentForRoadmapKey(key, departmentBySlug),
          whatBecomesTrue: `${title} becomes true for the company.`,
          howToMoveForward: "Launch an agent or provide the requested founder input.",
          sortOrder: itemIndex
        },
        create: {
          organizationId: orgId,
          stageId: roadmapStage.id,
          departmentId: departmentForRoadmapKey(key, departmentBySlug),
          key,
          title,
          description: `${title} roadmap item.`,
          status: sourceStatus,
          workType,
          whatBecomesTrue: `${title} becomes true for the company.`,
          howToMoveForward: "Launch an agent or provide the requested founder input.",
          sortOrder: itemIndex,
          completedAt: sourceStatus === "complete" ? new Date() : null
        }
      });

      itemByKey.set(key, created.id);
    }
  }

  for (const [itemKey, dependsOnKey] of roadmapDependencyPairs) {
    const itemId = itemByKey.get(itemKey);
    const dependsOnItemId = itemByKey.get(dependsOnKey);
    if (!itemId || !dependsOnItemId) continue;

    await prisma.roadmapDependency.upsert({
      where: { itemId_dependsOnItemId: { itemId, dependsOnItemId } },
      update: {},
      create: {
        organizationId: orgId,
        itemId,
        dependsOnItemId
      }
    });
  }
}

async function syncRoadmapUnlocks(orgId: string) {
  const items = await prisma.roadmapItem.findMany({
    where: { organizationId: orgId },
    include: { dependencies: { include: { dependsOn: true } } }
  });

  const updates: Array<Promise<unknown>> = [];
  for (const item of items) {
    if (item.status === "complete") {
      if (!item.completedAt) {
        updates.push(prisma.roadmapItem.update({ where: { id: item.id }, data: { completedAt: new Date() } }));
      }
      continue;
    }

    const nextStatus: RoadmapStatus = item.dependencies.every((dependency) => dependency.dependsOn.status === "complete") ? "available" : "locked";
    if (item.status !== nextStatus) {
      updates.push(prisma.roadmapItem.update({ where: { id: item.id }, data: { status: nextStatus } }));
    }
  }

  if (updates.length) {
    await Promise.all(updates);
  }

  const latest = await prisma.roadmapItem.findMany({ where: { organizationId: orgId } });
  const progress = progressFor(latest.map((item) => ({ status: item.status })));
  await prisma.organization.update({
    where: { id: orgId },
    data: { roadmapProgress: progress.percent }
  });
}

async function findRoadmapItem(orgId: string, itemId: string) {
  return prisma.roadmapItem.findFirst({
    where: {
      organizationId: orgId,
      OR: [{ id: itemId }, { key: itemId }]
    },
    include: roadmapItemInclude()
  });
}

function roadmapItemInclude() {
  return {
    stage: true,
    department: {
      include: {
        agents: {
          where: { archivedAt: null },
          orderBy: [{ isDefault: "desc" as const }, { name: "asc" as const }]
        }
      }
    },
    dependencies: { include: { dependsOn: { include: { stage: true, department: true } } } },
    unlocks: { include: { item: { include: { stage: true, department: true } } } },
    tasks: {
      where: { archivedAt: null },
      include: { agent: true },
      orderBy: { updatedAt: "desc" as const },
      take: 3
    }
  };
}

function serializeRoadmapItem(item: {
  id: string;
  key: string;
  title: string;
  description: string | null;
  status: string;
  workType: string;
  whatBecomesTrue: string | null;
  howToMoveForward: string | null;
  sortOrder: number;
  completedAt: Date | null;
  stage?: { id: string; key: string; name: string; sortOrder: number };
  department?: { id: string; name: string; slug: string; color: string } | null;
  dependencies: Array<{ dependsOn: { id: string; key: string; title: string; status: string; stage?: { name: string } | null; department?: { name: string; slug: string } | null } }>;
  unlocks: Array<{ item: { id: string; key: string; title: string; status: string; stage?: { name: string } | null; department?: { name: string; slug: string } | null } }>;
  tasks?: Array<{ id: string; title: string; status: string; type: string; updatedAt: Date; agent: { id: string; name: string; status: string } | null }>;
}) {
  const workType = workTypeFor(item.workType);
  const status = item.status === "complete" || item.status === "available" ? item.status : "locked";

  return {
    id: item.id,
    key: item.key,
    title: item.title,
    description: item.description,
    status,
    statusLabel: roadmapStatusMeta[status].label,
    statusDescription: roadmapStatusMeta[status].description,
    workType,
    workTypeLabel: status === "locked" ? roadmapStatusMeta.locked.label : roadmapWorkTypeMeta[workType].label,
    actionLabel: status === "locked" ? roadmapStatusMeta.locked.label : status === "complete" ? "Completed" : roadmapWorkTypeMeta[workType].actionLabel,
    whatBecomesTrue: item.whatBecomesTrue ?? `${item.title} becomes true for the company.`,
    howToMoveForward: item.howToMoveForward ?? "Launch the required action from this roadmap item.",
    sortOrder: item.sortOrder,
    completedAt: item.completedAt?.toISOString() ?? null,
    stage: item.stage ? { id: item.stage.id, key: item.stage.key, name: item.stage.name, sortOrder: item.stage.sortOrder } : null,
    department: item.department ? { id: item.department.id, name: item.department.name, slug: item.department.slug, color: item.department.color } : null,
    requiredFirst: item.dependencies.map((dependency) => ({
      id: dependency.dependsOn.id,
      key: dependency.dependsOn.key,
      title: dependency.dependsOn.title,
      status: dependency.dependsOn.status,
      stage: dependency.dependsOn.stage?.name ?? null,
      department: dependency.dependsOn.department ? { name: dependency.dependsOn.department.name, slug: dependency.dependsOn.department.slug } : null
    })),
    unlocks: item.unlocks.map((unlock) => ({
      id: unlock.item.id,
      key: unlock.item.key,
      title: unlock.item.title,
      status: unlock.item.status,
      stage: unlock.item.stage?.name ?? null,
      department: unlock.item.department ? { name: unlock.item.department.name, slug: unlock.item.department.slug } : null
    })),
    tasks: item.tasks?.map(serializeTask) ?? []
  };
}

function serializeTask(task: {
  id: string;
  title: string;
  status: string;
  type: string;
  updatedAt: Date;
  agent: { id: string; name: string; status: string } | null;
}): RoadmapTaskPayload {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    type: task.type,
    updatedAt: task.updatedAt.toISOString(),
    agent: task.agent ? { id: task.agent.id, name: task.agent.name, status: task.agent.status } : null
  };
}

function progressFor(items: Array<{ status: string }>) {
  const total = items.length;
  const complete = items.filter((item) => item.status === "complete").length;
  const available = items.filter((item) => item.status === "available").length;
  const locked = items.filter((item) => item.status === "locked").length;

  return {
    total,
    complete,
    available,
    locked,
    percent: total ? Math.round((complete / total) * 100) : 0
  };
}

function buildTaskDescription({
  item,
  input,
  workType
}: {
  item: { howToMoveForward: string | null; whatBecomesTrue: string | null };
  input?: string | null;
  workType: string;
}) {
  const lines = [
    item.howToMoveForward ?? "Move this roadmap item forward.",
    item.whatBecomesTrue ? `Outcome: ${item.whatBecomesTrue}` : null,
    input?.trim() ? `Founder input: ${input.trim()}` : null,
    workType === "approval" ? "Approval is required before execution." : null
  ].filter(Boolean);

  return lines.join("\n\n");
}

function departmentForRoadmapKey(key: string, departmentBySlug: Map<string, string>) {
  if (key.includes("brand")) return departmentBySlug.get("design");
  if (key.includes("postiz") || key.includes("blog") || key.includes("seo") || key.includes("social") || key.includes("positioning")) return departmentBySlug.get("marketing");
  if (key.includes("prospect") || key.includes("outreach") || key.includes("deal") || key.includes("opportunit")) return departmentBySlug.get("sales");
  if (key.includes("bookkeeping") || key.includes("billing") || key.includes("bank")) return departmentBySlug.get("finance");
  if (key.includes("incorporate")) return departmentBySlug.get("legal");
  if (key.includes("support")) return departmentBySlug.get("support");
  return departmentBySlug.get("engineering");
}
