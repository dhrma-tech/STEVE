import { getDepartmentVisual, resolveDepartmentCoverAsset } from "@/data/departments";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export type CanvasDepartment = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  coverAsset: string;
  availability: string;
  statusLabel: string;
  availabilityLabel: string;
  spotlightBadge: string | null;
  sortOrder: number;
  agents: Array<{ id: string; name: string; status: string; isDefault: boolean }>;
  taskCount: number;
  fileCount: number;
  roadmapCount: number;
};

export type CanvasTask = {
  id: string;
  title: string;
  status: string;
  type: string;
  updatedAt: string;
  department: { id: string; name: string; slug: string } | null;
  agent: { id: string; name: string; status: string } | null;
};

export type CanvasSuggestedTask = {
  id: string;
  title: string;
  status: string;
  workType: string;
  stage: string;
  department: { id: string; name: string; slug: string } | null;
};

export type CanvasFile = {
  id: string;
  name: string;
  visibility: string;
  sizeBytes: number;
  updatedAt: string;
  folder: { id: string; name: string } | null;
};

export type CanvasData = Awaited<ReturnType<typeof getCanvasData>>;

export async function getCanvasData(orgId: string) {
  const { user, organization } = await requireOrgMember(orgId);

  const [departments, activeTasks, suggestedTasks, files, folders, roadmapTotal, roadmapComplete, viewState, cofounderThread] =
    await Promise.all([
      prisma.department.findMany({
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
      }),
      prisma.task.findMany({
        where: { organizationId: orgId, archivedAt: null, status: { notIn: ["completed", "canceled", "archived"] } },
        include: { department: true, agent: true },
        orderBy: { updatedAt: "desc" },
        take: 8
      }),
      prisma.roadmapItem.findMany({
        where: { organizationId: orgId, status: { in: ["available", "locked"] } },
        include: { stage: true, department: true },
        orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
        take: 8
      }),
      prisma.file.findMany({
        where: { organizationId: orgId, archivedAt: null },
        include: { folder: true },
        orderBy: { updatedAt: "desc" },
        take: 8
      }),
      prisma.folder.findMany({
        where: { organizationId: orgId, archivedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 8
      }),
      prisma.roadmapItem.count({ where: { organizationId: orgId } }),
      prisma.roadmapItem.count({ where: { organizationId: orgId, status: "complete" } }),
      prisma.canvasViewState.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId: orgId } }
      }),
      prisma.chatThread.findFirst({
        where: { organizationId: orgId, kind: "cofounder", archivedAt: null },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 4 } },
        orderBy: { updatedAt: "desc" }
      })
    ]);

  const safeViewState = {
    viewport: viewState ? (JSON.parse(viewState.viewportJson) as { x: number; y: number; zoom: number }) : { x: 0, y: 0, zoom: 0.9 },
    selectedNodeId: viewState?.selectedNodeId ?? null,
    activeTab: viewState?.activeTab ?? "home"
  };

  const serializedOrganization = {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      stage: organization.stage,
      status: organization.status,
      designOnboardingStatus: organization.designOnboardingStatus,
      roadmapProgress: organization.roadmapProgress,
      businessPlanFileId: organization.businessPlanFileId
    };
  const serializedDepartments = departments.map((department): CanvasDepartment => {
    const visual = getDepartmentVisual(department.slug);
    return {
      id: department.id,
      slug: department.slug,
      name: department.name,
      description: department.description,
      icon: department.icon,
      color: department.color,
      coverAsset: resolveDepartmentCoverAsset(department.slug, department.coverAsset),
      availability: department.availability,
      statusLabel: department.availability === "active" ? visual.statusLabel : "Coming soon",
      availabilityLabel: department.availability === "active" ? visual.availabilityLabel : "Coming soon",
      spotlightBadge: visual.spotlightBadge ?? null,
      sortOrder: department.sortOrder,
      agents: department.agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        status: agent.status,
        isDefault: agent.isDefault
      })),
      taskCount: department._count.tasks,
      fileCount: department._count.files,
      roadmapCount: department._count.roadmapItems
    };
  });
  const roadmap = {
    total: roadmapTotal,
    complete: roadmapComplete,
    progress: roadmapTotal ? Math.round((roadmapComplete / roadmapTotal) * 100) : 0
  };

  return {
    organization: serializedOrganization,
    departments: serializedDepartments,
    nodes: buildGraphNodes({
      organizationName: organization.name,
      organizationDescription: organization.description,
      departments: serializedDepartments,
      progress: roadmap.progress
    }),
    edges: buildGraphEdges(serializedDepartments),
    activeTasks: activeTasks.map((task): CanvasTask => ({
      id: task.id,
      title: task.title,
      status: task.status,
      type: task.type,
      updatedAt: task.updatedAt.toISOString(),
      department: task.department ? { id: task.department.id, name: task.department.name, slug: task.department.slug } : null,
      agent: task.agent ? { id: task.agent.id, name: task.agent.name, status: task.agent.status } : null
    })),
    suggestedTasks: suggestedTasks.map((item): CanvasSuggestedTask => ({
      id: item.id,
      title: item.title,
      status: item.status,
      workType: item.workType,
      stage: item.stage.name,
      department: item.department ? { id: item.department.id, name: item.department.name, slug: item.department.slug } : null
    })),
    files: files.map((file): CanvasFile => ({
      id: file.id,
      name: file.name,
      visibility: file.visibility,
      sizeBytes: file.sizeBytes,
      updatedAt: file.updatedAt.toISOString(),
      folder: file.folder ? { id: file.folder.id, name: file.folder.name } : null
    })),
    folders: folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      sortOrder: folder.sortOrder,
      parentFolderId: folder.parentFolderId
    })),
    roadmap,
    cofounderThread: cofounderThread
      ? {
          id: cofounderThread.id,
          title: cofounderThread.title,
          messages: cofounderThread.messages
            .map((message) => ({
              id: message.id,
              senderType: message.senderType,
              body: message.body,
              createdAt: message.createdAt.toISOString()
            }))
            .reverse()
        }
      : null,
    viewState: safeViewState
  };
}

function buildGraphNodes({
  organizationName,
  organizationDescription,
  departments,
  progress
}: {
  organizationName: string;
  organizationDescription: string | null;
  departments: CanvasDepartment[];
  progress: number;
}) {
  const radius = 380;
  const departmentNodes = departments.map((department, index) => {
    const angle = (Math.PI * 2 * index) / departments.length - Math.PI / 2;

    return {
      id: `department:${department.slug}`,
      type: "department",
      position: {
        x: Math.cos(angle) * radius - 95,
        y: Math.sin(angle) * radius - 68
      },
      data: {
        slug: department.slug,
        name: department.name,
        description: department.description,
        color: department.color,
        availability: department.availability,
        agents: department.agents.length,
        tasks: department.taskCount
      }
    };
  });

  return [
    {
      id: "cofounder",
      type: "cofounder",
      position: { x: -105, y: -80 },
      data: {
        label: "Cofounder",
        subtitle: organizationDescription ?? `${organizationName} operating center`,
        progress
      }
    },
    ...departmentNodes
  ];
}

function buildGraphEdges(departments: CanvasDepartment[]) {
  return [
    ...departments.map((department) => ({
      id: `orbit:${department.slug}`,
      source: "cofounder",
      target: `department:${department.slug}`,
      kind: "orbit"
    })),
    ...departments
      .filter((department) => department.availability === "active")
      .slice(0, 4)
      .map((department) => ({
        id: `active:${department.slug}`,
        source: "cofounder",
        target: `department:${department.slug}`,
        kind: "active-agent",
        color: department.color
      }))
  ];
}
