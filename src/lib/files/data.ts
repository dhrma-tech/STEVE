import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ensureBusinessPlanFile, ensureGeneralFolder } from "@/lib/onboarding/activation";

const json = (value: unknown) => JSON.stringify(value);
const previewTextLimit = 24_000;

const fileInclude = {
  folder: true,
  department: true,
  task: true,
  uploadedBy: true,
  versions: {
    orderBy: { versionNumber: "desc" as const },
    include: { createdBy: true }
  }
} satisfies Prisma.FileInclude;

type FileRecord = Prisma.FileGetPayload<{ include: typeof fileInclude }>;

export type FileLibraryData = Awaited<ReturnType<typeof getFileLibraryData>>;
export type FileDetailData = Awaited<ReturnType<typeof getFileDetail>>;

export type FileLibraryQuery = {
  folderId?: string | null;
  departmentId?: string | null;
  taskId?: string | null;
  q?: string | null;
  includeArchived?: boolean;
};

export async function getFileLibraryData(orgId: string, query: FileLibraryQuery = {}) {
  const { user, organization } = await requireOrgMember(orgId);
  const generalFolder = await ensureGeneralFolder(orgId);
  const businessPlanFile = await ensureBusinessPlanFile({
    organizationId: orgId,
    userId: user.id,
    folderId: generalFolder.id
  });

  await ensureFileVersion({
    fileId: businessPlanFile.id,
    storageKey: businessPlanFile.storageKey,
    sizeBytes: businessPlanFile.sizeBytes,
    userId: user.id
  });

  const filters = normalizeFilters(query);
  const where = fileWhere(orgId, filters);

  const [folders, activeFileRefs, files, departments, tasks] = await Promise.all([
    prisma.folder.findMany({
      where: { organizationId: orgId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.file.findMany({
      where: { organizationId: orgId, archivedAt: null },
      select: { folderId: true, departmentId: true, taskId: true }
    }),
    prisma.file.findMany({
      where,
      include: fileInclude,
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }]
    }),
    prisma.department.findMany({
      where: { organizationId: orgId },
      orderBy: { sortOrder: "asc" }
    }),
    prisma.task.findMany({
      where: { organizationId: orgId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 40
    })
  ]);

  const normalizedFiles = await ensureVersionsForRecords(files, user.id);
  const folderCounts = countBy(activeFileRefs.map((file) => file.folderId ?? "unfiled"));
  const departmentCounts = countBy(activeFileRefs.map((file) => file.departmentId).filter(Boolean) as string[]);
  const taskCounts = countBy(activeFileRefs.map((file) => file.taskId).filter(Boolean) as string[]);

  return {
    filters,
    generalFolderId: generalFolder.id,
    businessPlanFileId: organization.businessPlanFileId ?? businessPlanFile.id,
    folders: folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentFolderId: folder.parentFolderId,
      departmentId: folder.departmentId,
      sortOrder: folder.sortOrder,
      fileCount: folderCounts.get(folder.id) ?? 0,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString()
    })),
    files: normalizedFiles.map((file) => serializeFile(file, organization)),
    catalog: {
      departments: departments.map((department) => ({
        id: department.id,
        slug: department.slug,
        name: department.name,
        color: department.color,
        fileCount: departmentCounts.get(department.id) ?? 0
      })),
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        departmentId: task.departmentId,
        fileCount: taskCounts.get(task.id) ?? 0
      }))
    },
    stats: {
      totalFiles: activeFileRefs.length,
      totalFolders: folders.length,
      departmentFiles: activeFileRefs.filter((file) => file.departmentId).length,
      taskFiles: activeFileRefs.filter((file) => file.taskId).length
    }
  };
}

export async function createFolder({
  orgId,
  name,
  parentFolderId = null,
  departmentId = null
}: {
  orgId: string;
  name: string;
  parentFolderId?: string | null;
  departmentId?: string | null;
}) {
  await requireOrgMember(orgId);
  const normalizedName = cleanName(name, "Untitled folder");
  const parentFolder = parentFolderId ? await getFolderInOrg(orgId, parentFolderId) : null;
  const department = departmentId ? await prisma.department.findFirst({ where: { id: departmentId, organizationId: orgId } }) : null;
  const existing = await prisma.folder.findFirst({
    where: {
      organizationId: orgId,
      parentFolderId: parentFolder?.id ?? null,
      name: normalizedName,
      archivedAt: null
    }
  });

  if (existing) {
    return existing;
  }

  const siblingCount = await prisma.folder.count({
    where: { organizationId: orgId, parentFolderId: parentFolder?.id ?? null, archivedAt: null }
  });

  return prisma.folder.create({
    data: {
      organizationId: orgId,
      parentFolderId: parentFolder?.id ?? null,
      departmentId: department?.id ?? null,
      name: normalizedName,
      sortOrder: siblingCount
    }
  });
}

export async function updateFolder({
  orgId,
  folderId,
  name,
  parentFolderId,
  departmentId,
  archived
}: {
  orgId: string;
  folderId: string;
  name?: string | null;
  parentFolderId?: string | null;
  departmentId?: string | null;
  archived?: boolean;
}) {
  await requireOrgMember(orgId);
  const folder = await getFolderInOrg(orgId, folderId);
  if (!folder) return null;

  const parentFolder = parentFolderId ? await getFolderInOrg(orgId, parentFolderId) : null;
  const department = departmentId ? await prisma.department.findFirst({ where: { id: departmentId, organizationId: orgId } }) : null;

  return prisma.folder.update({
    where: { id: folder.id },
    data: {
      ...(name !== undefined ? { name: cleanName(name, folder.name) } : {}),
      ...(parentFolderId !== undefined ? { parentFolderId: parentFolder?.id ?? null } : {}),
      ...(departmentId !== undefined ? { departmentId: department?.id ?? null } : {}),
      ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {})
    }
  });
}

export async function createFile({
  orgId,
  name,
  mimeType,
  sizeBytes,
  folderId,
  departmentId,
  taskId,
  visibility,
  content,
  source = "library_upload"
}: {
  orgId: string;
  name: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  folderId?: string | null;
  departmentId?: string | null;
  taskId?: string | null;
  visibility?: string | null;
  content?: string | null;
  source?: string | null;
}) {
  const { user, organization } = await requireOrgMember(orgId);
  const generalFolder = await ensureGeneralFolder(orgId);
  const folder = folderId ? (await getFolderInOrg(orgId, folderId)) ?? generalFolder : generalFolder;
  const department = departmentId ? await prisma.department.findFirst({ where: { id: departmentId, organizationId: orgId } }) : null;
  const task = taskId ? await prisma.task.findFirst({ where: { id: taskId, organizationId: orgId, archivedAt: null } }) : null;
  const safeName = cleanName(name, "Untitled file");
  const safeMime = mimeType?.trim() || inferMimeType(safeName);
  const preview = previewMetadata({ name: safeName, mimeType: safeMime, content });
  const storageKey = storageKeyFor(orgId, safeName);

  const file = await prisma.file.create({
    data: {
      organizationId: orgId,
      folderId: folder.id,
      departmentId: department?.id ?? task?.departmentId ?? null,
      taskId: task?.id ?? null,
      uploadedByUserId: user.id,
      name: safeName,
      mimeType: safeMime,
      sizeBytes: normalizeSize(sizeBytes, content),
      storageKey,
      visibility: normalizeVisibility(visibility, task ? "task" : "organization"),
      metadataJson: json({
        source,
        originalName: safeName,
        ...preview
      })
    },
    include: fileInclude
  });

  const version = await prisma.fileVersion.create({
    data: {
      fileId: file.id,
      versionNumber: 1,
      storageKey,
      sizeBytes: file.sizeBytes,
      checksum: checksumFor(content ?? safeName),
      createdByUserId: user.id
    }
  });

  const updated = await prisma.file.update({
    where: { id: file.id },
    data: { currentVersionId: version.id },
    include: fileInclude
  });

  return serializeFile(updated, organization);
}

export async function getFileDetail(orgId: string, fileId: string) {
  const { user, organization } = await requireOrgMember(orgId);
  const file = await prisma.file.findFirst({
    where: { id: fileId, organizationId: orgId },
    include: fileInclude
  });

  if (!file) return null;

  const [normalized] = await ensureVersionsForRecords([file], user.id);
  return serializeFile(normalized, organization);
}

export async function updateFile({
  orgId,
  fileId,
  name,
  folderId,
  departmentId,
  taskId,
  visibility
}: {
  orgId: string;
  fileId: string;
  name?: string | null;
  folderId?: string | null;
  departmentId?: string | null;
  taskId?: string | null;
  visibility?: string | null;
}) {
  const { organization } = await requireOrgMember(orgId);
  const file = await prisma.file.findFirst({ where: { id: fileId, organizationId: orgId } });
  if (!file) return null;

  const folder = folderId ? await getFolderInOrg(orgId, folderId) : null;
  const department = departmentId ? await prisma.department.findFirst({ where: { id: departmentId, organizationId: orgId } }) : null;
  const task = taskId ? await prisma.task.findFirst({ where: { id: taskId, organizationId: orgId, archivedAt: null } }) : null;

  const updated = await prisma.file.update({
    where: { id: file.id },
    data: {
      ...(name !== undefined ? { name: cleanName(name, file.name) } : {}),
      ...(folderId !== undefined ? { folderId: folder?.id ?? null } : {}),
      ...(departmentId !== undefined ? { departmentId: department?.id ?? null } : {}),
      ...(taskId !== undefined ? { taskId: task?.id ?? null } : {}),
      ...(visibility !== undefined ? { visibility: normalizeVisibility(visibility, file.visibility) } : {})
    },
    include: fileInclude
  });

  return serializeFile(updated, organization);
}

export async function addFileVersion({
  orgId,
  fileId,
  name,
  mimeType,
  sizeBytes,
  content
}: {
  orgId: string;
  fileId: string;
  name?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  content?: string | null;
}) {
  const { user, organization } = await requireOrgMember(orgId);
  const file = await prisma.file.findFirst({
    where: { id: fileId, organizationId: orgId, archivedAt: null },
    include: fileInclude
  });
  if (!file) return null;

  const nextName = name ? cleanName(name, file.name) : file.name;
  const nextMime = mimeType?.trim() || file.mimeType || inferMimeType(nextName);
  const versionNumber = (file.versions[0]?.versionNumber ?? 0) + 1;
  const storageKey = storageKeyFor(orgId, nextName, versionNumber);
  const nextSize = normalizeSize(sizeBytes, content, file.sizeBytes);
  const metadata = {
    ...parseJsonObject(file.metadataJson),
    ...previewMetadata({ name: nextName, mimeType: nextMime, content }),
    originalName: nextName,
    lastVersionedAt: new Date().toISOString()
  };

  const version = await prisma.fileVersion.create({
    data: {
      fileId: file.id,
      versionNumber,
      storageKey,
      sizeBytes: nextSize,
      checksum: checksumFor(content ?? `${nextName}:${versionNumber}`),
      createdByUserId: user.id
    }
  });

  const updated = await prisma.file.update({
    where: { id: file.id },
    data: {
      name: nextName,
      mimeType: nextMime,
      sizeBytes: nextSize,
      storageKey,
      currentVersionId: version.id,
      metadataJson: json(metadata)
    },
    include: fileInclude
  });

  return serializeFile(updated, organization);
}

export async function archiveFile({ orgId, fileId }: { orgId: string; fileId: string }) {
  const { organization } = await requireOrgMember(orgId);
  const file = await prisma.file.findFirst({ where: { id: fileId, organizationId: orgId } });
  if (!file) return null;

  const updated = await prisma.file.update({
    where: { id: file.id },
    data: { archivedAt: new Date() },
    include: fileInclude
  });

  return serializeFile(updated, organization);
}

async function ensureVersionsForRecords(files: FileRecord[], userId: string) {
  const missing = files.filter((file) => file.versions.length === 0 || !file.currentVersionId);
  if (!missing.length) return files;

  for (const file of missing) {
    await ensureFileVersion({
      fileId: file.id,
      storageKey: file.storageKey,
      sizeBytes: file.sizeBytes,
      userId
    });
  }

  return prisma.file.findMany({
    where: { id: { in: files.map((file) => file.id) } },
    include: fileInclude,
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }]
  });
}

async function ensureFileVersion({
  fileId,
  storageKey,
  sizeBytes,
  userId
}: {
  fileId: string;
  storageKey: string;
  sizeBytes: number;
  userId: string;
}) {
  const existing = await prisma.fileVersion.findFirst({
    where: { fileId, versionNumber: 1 }
  });

  if (existing) {
    await prisma.file.updateMany({
      where: { id: fileId, currentVersionId: null },
      data: { currentVersionId: existing.id }
    });
    return existing;
  }

  const version = await prisma.fileVersion.create({
    data: {
      fileId,
      versionNumber: 1,
      storageKey,
      sizeBytes,
      checksum: checksumFor(`${fileId}:${storageKey}:${sizeBytes}`),
      createdByUserId: userId
    }
  });

  await prisma.file.update({
    where: { id: fileId },
    data: { currentVersionId: version.id }
  });

  return version;
}

function serializeFile(file: FileRecord, organization: { id: string; name: string; description: string | null }) {
  const metadata = parseJsonObject(file.metadataJson);
  const preview = buildPreview(file, metadata, organization);

  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    storageKey: file.storageKey,
    visibility: file.visibility,
    currentVersionId: file.currentVersionId,
    metadata,
    preview,
    shareUrl: `/org/${organization.id}/canvas?tab=library&file=${file.id}`,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
    archivedAt: file.archivedAt?.toISOString() ?? null,
    folder: file.folder ? { id: file.folder.id, name: file.folder.name } : null,
    department: file.department ? { id: file.department.id, name: file.department.name, slug: file.department.slug, color: file.department.color } : null,
    task: file.task ? { id: file.task.id, title: file.task.title, status: file.task.status } : null,
    uploadedBy: file.uploadedBy
      ? {
          id: file.uploadedBy.id,
          name: file.uploadedBy.preferredName ?? file.uploadedBy.name ?? file.uploadedBy.email ?? "Member",
          email: file.uploadedBy.email
        }
      : null,
    versions: file.versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      storageKey: version.storageKey,
      sizeBytes: version.sizeBytes,
      checksum: version.checksum,
      createdAt: version.createdAt.toISOString(),
      createdBy: version.createdBy
        ? {
            id: version.createdBy.id,
            name: version.createdBy.preferredName ?? version.createdBy.name ?? version.createdBy.email ?? "Member",
            email: version.createdBy.email
          }
        : null
    }))
  };
}

function normalizeFilters(query: FileLibraryQuery) {
  return {
    folderId: cleanFilter(query.folderId),
    departmentId: cleanFilter(query.departmentId),
    taskId: cleanFilter(query.taskId),
    q: query.q?.trim() ?? "",
    includeArchived: Boolean(query.includeArchived)
  };
}

function fileWhere(orgId: string, filters: ReturnType<typeof normalizeFilters>): Prisma.FileWhereInput {
  return {
    organizationId: orgId,
    ...(filters.includeArchived ? {} : { archivedAt: null }),
    ...(filters.folderId ? { folderId: filters.folderId } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.taskId ? { taskId: filters.taskId } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q } },
            { mimeType: { contains: filters.q } },
            { folder: { name: { contains: filters.q } } },
            { department: { name: { contains: filters.q } } },
            { task: { title: { contains: filters.q } } }
          ]
        }
      : {})
  };
}

function buildPreview(file: FileRecord, metadata: Record<string, unknown>, organization: { name: string; description: string | null }) {
  const previewText = typeof metadata.previewText === "string" ? metadata.previewText : null;
  const previewKind = typeof metadata.previewKind === "string" ? metadata.previewKind : previewKindFor(file.mimeType, file.name);

  if (previewText) {
    return {
      kind: previewKind,
      title: file.name,
      text: previewText,
      message: null
    };
  }

  if (file.name.toLowerCase() === "business plan.md") {
    return {
      kind: "markdown",
      title: "Business Plan",
      text: businessPlanMarkdown(metadata, organization),
      message: null
    };
  }

  return {
    kind: previewKind,
    title: file.name,
    text: null,
    message: previewMessage(previewKind)
  };
}

function previewMetadata({ name, mimeType, content }: { name: string; mimeType: string | null; content?: string | null }) {
  const kind = previewKindFor(mimeType, name);
  const safeContent = typeof content === "string" && content.length ? content.slice(0, previewTextLimit) : null;

  return {
    previewKind: kind,
    previewText: supportsTextPreview(kind) ? safeContent : null,
    previewTruncated: Boolean(content && content.length > previewTextLimit)
  };
}

function businessPlanMarkdown(metadata: Record<string, unknown>, organization: { name: string; description: string | null }) {
  const sections = metadata.sections && typeof metadata.sections === "object" && !Array.isArray(metadata.sections)
    ? (metadata.sections as Record<string, unknown>)
    : {};

  return [
    `# ${organization.name} Business Plan`,
    "",
    "## Product/Service",
    String(metadata.productOrService ?? sections["Product/Service"] ?? organization.description ?? `${organization.name} operating plan.`),
    "",
    "## ICP",
    String(metadata.icp ?? sections.ICP ?? "Early-stage founders who need faster execution."),
    "",
    "## Monetization",
    String(metadata.monetization ?? "Subscription"),
    "",
    "## Acquisition",
    String(metadata.acquisition ?? "Founder-led outbound")
  ].join("\n");
}

function previewKindFor(mimeType: string | null | undefined, name: string) {
  const lowerName = name.toLowerCase();
  const lowerMime = (mimeType ?? "").toLowerCase();

  if (lowerMime.includes("markdown") || lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) return "markdown";
  if (lowerMime.includes("json") || lowerName.endsWith(".json")) return "json";
  if (lowerMime.includes("csv") || lowerName.endsWith(".csv")) return "csv";
  if (lowerMime.startsWith("text/") || [".txt", ".log"].some((extension) => lowerName.endsWith(extension))) return "text";
  if (lowerMime.startsWith("image/")) return "image";
  if (lowerMime.includes("pdf") || lowerName.endsWith(".pdf")) return "pdf";
  if (lowerMime.includes("spreadsheet") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) return "spreadsheet";
  if (lowerMime.includes("presentation") || lowerName.endsWith(".pptx") || lowerName.endsWith(".ppt")) return "presentation";
  if (lowerMime.includes("word") || lowerName.endsWith(".docx") || lowerName.endsWith(".doc")) return "document";
  return "metadata";
}

function supportsTextPreview(kind: string) {
  return ["markdown", "json", "csv", "text"].includes(kind);
}

function previewMessage(kind: string) {
  if (kind === "image") return "Image preview metadata is available; binary object storage is not configured in this local sandbox.";
  if (kind === "pdf") return "PDF metadata is stored and versioned. Inline PDF rendering depends on a storage provider.";
  if (["spreadsheet", "presentation", "document"].includes(kind)) return "Office file metadata is stored and versioned. Native preview depends on a document renderer.";
  return "Preview metadata is available for this file type.";
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

function normalizeVisibility(value: string | null | undefined, fallback: string) {
  return ["private", "organization", "department", "task", "shared"].includes(value ?? "") ? value as string : fallback;
}

function cleanFilter(value?: string | null) {
  if (!value || value === "all" || value === "none") return null;
  return value;
}

function cleanName(value: string | null | undefined, fallback: string) {
  return value?.trim().replace(/[\\/:*?"<>|]/g, "-").slice(0, 180) || fallback;
}

function normalizeSize(sizeBytes?: number | null, content?: string | null, fallback = 0) {
  if (typeof sizeBytes === "number" && Number.isFinite(sizeBytes) && sizeBytes >= 0) {
    return Math.min(Math.round(sizeBytes), 2_147_483_647);
  }
  if (typeof content === "string") {
    return Math.min(Buffer.byteLength(content, "utf8"), 2_147_483_647);
  }
  return fallback;
}

function inferMimeType(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".txt") || lower.endsWith(".log")) return "text/plain";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function storageKeyFor(orgId: string, name: string, version?: number) {
  const stem = slugify(name);
  const versionPart = version ? `v${version}-` : "";
  return `orgs/${orgId}/files/${versionPart}${Date.now()}-${randomUUID()}-${stem}`;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "file";
}

function checksumFor(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function countBy(values: string[]) {
  return values.reduce((map, value) => {
    map.set(value, (map.get(value) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
}

async function getFolderInOrg(orgId: string, folderId: string) {
  return prisma.folder.findFirst({
    where: { id: folderId, organizationId: orgId, archivedAt: null }
  });
}
