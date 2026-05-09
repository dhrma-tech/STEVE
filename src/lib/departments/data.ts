import { getDepartmentVisual, initialDepartmentContext, resolveDepartmentCoverAsset } from "@/data/departments";
import { errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

type PrismaDepartmentSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  coverAsset: string | null;
  availability: string;
  sortOrder: number;
  contextJson: string | null;
  agents: Array<{ id: string; name: string; status: string; isDefault: boolean; description: string | null }>;
  _count: { tasks: number; files: number; roadmapItems: number };
};

export type DepartmentSummaryData = ReturnType<typeof serializeDepartmentSummary>;
export type DepartmentDetailData = Awaited<ReturnType<typeof getDepartmentDetail>>;

export async function getDepartmentList(orgId: string) {
  await requireOrgMember(orgId);
  const departments = await prisma.department.findMany({
    where: { organizationId: orgId },
    include: {
      agents: {
        where: { archivedAt: null },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }]
      },
      _count: {
        select: { tasks: true, files: true, roadmapItems: true }
      }
    },
    orderBy: { sortOrder: "asc" }
  });

  return departments.map(serializeDepartmentSummary);
}

export async function getDepartmentDetail(orgId: string, departmentId: string) {
  await requireOrgMember(orgId);
  const department = await prisma.department.findFirst({
    where: {
      organizationId: orgId,
      OR: [{ id: departmentId }, { slug: departmentId }]
    },
    include: {
      agents: {
        where: { archivedAt: null },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }]
      },
      tasks: {
        where: { archivedAt: null },
        include: {
          agent: true,
          roadmapItem: true
        },
        orderBy: { updatedAt: "desc" },
        take: 8
      },
      files: {
        where: { archivedAt: null },
        include: { folder: true },
        orderBy: { updatedAt: "desc" },
        take: 8
      },
      roadmapItems: {
        include: { stage: true },
        orderBy: [{ stage: { sortOrder: "asc" } }, { sortOrder: "asc" }],
        take: 8
      },
      _count: {
        select: { tasks: true, files: true, roadmapItems: true }
      }
    }
  });

  if (!department) {
    return null;
  }

  const summary = serializeDepartmentSummary(department);
  const visual = getDepartmentVisual(department.slug);
  const context = parseJsonObject(department.contextJson, initialDepartmentContext(department.slug));

  return {
    ...summary,
    defaultAgent: summary.agents.find((agent) => agent.isDefault) ?? null,
    context,
    visual,
    tasks: department.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      type: task.type,
      priority: task.priority,
      updatedAt: task.updatedAt.toISOString(),
      agent: task.agent ? { id: task.agent.id, name: task.agent.name, status: task.agent.status } : null,
      roadmapItem: task.roadmapItem ? { id: task.roadmapItem.id, title: task.roadmapItem.title, status: task.roadmapItem.status } : null
    })),
    files: department.files.map((file) => ({
      id: file.id,
      name: file.name,
      visibility: file.visibility,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      updatedAt: file.updatedAt.toISOString(),
      folder: file.folder ? { id: file.folder.id, name: file.folder.name } : null
    })),
    roadmapItems: department.roadmapItems.map((item) => ({
      id: item.id,
      key: item.key,
      title: item.title,
      status: item.status,
      workType: item.workType,
      stage: item.stage.name,
      whatBecomesTrue: item.whatBecomesTrue,
      howToMoveForward: item.howToMoveForward
    }))
  };
}

export async function updateDepartmentContext({
  orgId,
  departmentId,
  contextJson
}: {
  orgId: string;
  departmentId: string;
  contextJson: Record<string, unknown>;
}) {
  const { user } = await requireOrgAdmin(orgId);
  const department = await prisma.department.findFirst({
    where: {
      organizationId: orgId,
      OR: [{ id: departmentId }, { slug: departmentId }]
    }
  });

  if (!department) {
    return null;
  }

  const previous = parseJsonObject(department.contextJson, initialDepartmentContext(department.slug));
  const next = {
    ...previous,
    ...contextJson,
    source: "manual",
    updatedAt: new Date().toISOString(),
    updatedByUserId: user.id
  };

  await prisma.department.update({
    where: { id: department.id },
    data: { contextJson: JSON.stringify(next) }
  });

  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      actorUserId: user.id,
      action: "department.context.updated",
      targetType: "department",
      targetId: department.id,
      metadataJson: JSON.stringify({ keys: Object.keys(contextJson) })
    }
  });

  return getDepartmentDetail(orgId, department.id);
}

export function departmentNotFoundResponse() {
  return errorResponse("NOT_FOUND", "Department not found", 404);
}

function serializeDepartmentSummary(department: PrismaDepartmentSummary) {
  const visual = getDepartmentVisual(department.slug);
  const defaultAgent = department.agents.find((agent) => agent.isDefault) ?? null;

  return {
    id: department.id,
    slug: department.slug,
    name: department.name,
    description: department.description,
    icon: department.icon,
    color: department.color,
    coverAsset: resolveDepartmentCoverAsset(department.slug, department.coverAsset),
    availability: department.availability,
    sortOrder: department.sortOrder,
    statusLabel: department.availability === "active" ? visual.statusLabel : "Coming soon",
    availabilityLabel: department.availability === "active" ? visual.availabilityLabel : "Coming soon",
    spotlightBadge: visual.spotlightBadge ?? null,
    agents: department.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      isDefault: agent.isDefault,
      description: agent.description
    })),
    defaultAgentName: defaultAgent?.name ?? `${department.name} Agent`,
    taskCount: department._count.tasks,
    fileCount: department._count.files,
    roadmapCount: department._count.roadmapItems
  };
}

function parseJsonObject(value: string | null, fallback: Record<string, unknown>) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : fallback;
  } catch {
    return fallback;
  }
}
