import { prisma } from "@/lib/db/client";

export const searchTypes = ["tasks", "agents", "files", "departments", "roadmap"] as const;
export type SearchType = (typeof searchTypes)[number];

export type SearchResultItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  status?: string;
};

export type SearchResultGroup = {
  type: SearchType;
  label: string;
  items: SearchResultItem[];
};

const labels: Record<SearchType, string> = {
  tasks: "Tasks",
  agents: "Agents",
  files: "Files",
  departments: "Departments",
  roadmap: "Roadmap"
};

export function parseSearchTypes(value: string | null): SearchType[] {
  if (!value) return [...searchTypes];
  const requested = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is SearchType => searchTypes.includes(item as SearchType));
  return requested.length ? requested : [...searchTypes];
}

export async function groupedSearch({
  orgId,
  q,
  types
}: {
  orgId: string;
  q: string;
  types: SearchType[];
}): Promise<SearchResultGroup[]> {
  const query = q.trim();
  const contains = query || undefined;
  const include = (type: SearchType) => types.includes(type);

  const [tasks, agents, files, departments, roadmap] = await Promise.all([
    include("tasks")
      ? prisma.task.findMany({
          where: {
            organizationId: orgId,
            archivedAt: null,
            ...(contains
              ? {
                  OR: [
                    { title: { contains } },
                    { description: { contains } },
                    { status: { contains } },
                    { type: { contains } }
                  ]
                }
              : {})
          },
          include: { department: true, agent: true },
          orderBy: { updatedAt: "desc" },
          take: 6
        })
      : Promise.resolve([]),
    include("agents")
      ? prisma.agent.findMany({
          where: {
            organizationId: orgId,
            archivedAt: null,
            ...(contains
              ? {
                  OR: [
                    { name: { contains } },
                    { description: { contains } },
                    { status: { contains } }
                  ]
                }
              : {})
          },
          include: { department: true },
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          take: 6
        })
      : Promise.resolve([]),
    include("files")
      ? prisma.file.findMany({
          where: {
            organizationId: orgId,
            archivedAt: null,
            ...(contains ? { name: { contains } } : {})
          },
          include: { folder: true, department: true },
          orderBy: { updatedAt: "desc" },
          take: 6
        })
      : Promise.resolve([]),
    include("departments")
      ? prisma.department.findMany({
          where: {
            organizationId: orgId,
            ...(contains
              ? {
                  OR: [
                    { name: { contains } },
                    { description: { contains } },
                    { availability: { contains } }
                  ]
                }
              : {})
          },
          orderBy: { sortOrder: "asc" },
          take: 8
        })
      : Promise.resolve([]),
    include("roadmap")
      ? prisma.roadmapItem.findMany({
          where: {
            organizationId: orgId,
            ...(contains
              ? {
                  OR: [
                    { title: { contains } },
                    { description: { contains } },
                    { status: { contains } },
                    { workType: { contains } }
                  ]
                }
              : {})
          },
          include: { stage: true, department: true },
          orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
          take: 8
        })
      : Promise.resolve([])
  ]);

  const groups: SearchResultGroup[] = [];

  if (include("tasks")) {
    groups.push({
      type: "tasks",
      label: labels.tasks,
      items: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        subtitle: [task.status, task.department?.name, task.agent?.name].filter(Boolean).join(" - ") || "Task",
        href: `/org/${orgId}/canvas?task=${task.id}`,
        status: task.status
      }))
    });
  }

  if (include("agents")) {
    groups.push({
      type: "agents",
      label: labels.agents,
      items: agents.map((agent) => ({
        id: agent.id,
        title: agent.name,
        subtitle: [agent.status, agent.department.name].join(" - "),
        href: `/org/${orgId}/canvas?agent=${agent.id}`,
        status: agent.status
      }))
    });
  }

  if (include("files")) {
    groups.push({
      type: "files",
      label: labels.files,
      items: files.map((file) => ({
        id: file.id,
        title: file.name,
        subtitle: [file.folder?.name, file.department?.name, formatBytes(file.sizeBytes)].filter(Boolean).join(" - ") || "File",
        href: `/org/${orgId}/canvas?file=${file.id}`,
        status: file.visibility
      }))
    });
  }

  if (include("departments")) {
    groups.push({
      type: "departments",
      label: labels.departments,
      items: departments.map((department) => ({
        id: department.id,
        title: department.name,
        subtitle: department.description,
        href: `/org/${orgId}/canvas?department=${department.slug}`,
        status: department.availability
      }))
    });
  }

  if (include("roadmap")) {
    groups.push({
      type: "roadmap",
      label: labels.roadmap,
      items: roadmap.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: [item.stage.name, item.department?.name, item.workType].filter(Boolean).join(" - "),
        href: `/org/${orgId}/canvas?open_tech_tree=1&roadmap=${item.id}`,
        status: item.status
      }))
    });
  }

  return groups;
}

function formatBytes(value: number) {
  if (value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
