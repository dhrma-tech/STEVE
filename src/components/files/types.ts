export type LibraryFolder = {
  id: string;
  name: string;
  parentFolderId: string | null;
  departmentId: string | null;
  sortOrder: number;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
};

export type LibraryDepartment = {
  id: string;
  slug: string;
  name: string;
  color: string;
  fileCount: number;
};

export type LibraryTask = {
  id: string;
  title: string;
  status: string;
  departmentId: string | null;
  fileCount: number;
};

export type LibraryFile = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number;
  storageKey: string;
  visibility: string;
  currentVersionId: string | null;
  metadata: Record<string, unknown>;
  preview: {
    kind: string;
    title: string;
    text: string | null;
    message: string | null;
  };
  shareUrl: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  folder: { id: string; name: string } | null;
  department: { id: string; name: string; slug: string; color: string } | null;
  task: { id: string; title: string; status: string } | null;
  uploadedBy: { id: string; name: string; email: string | null } | null;
  versions: Array<{
    id: string;
    versionNumber: number;
    storageKey: string;
    sizeBytes: number;
    checksum: string | null;
    createdAt: string;
    createdBy: { id: string; name: string; email: string | null } | null;
  }>;
};

export type FileLibraryPayload = {
  filters: {
    folderId: string | null;
    departmentId: string | null;
    taskId: string | null;
    q: string;
    includeArchived: boolean;
  };
  generalFolderId: string;
  businessPlanFileId: string;
  folders: LibraryFolder[];
  files: LibraryFile[];
  catalog: {
    departments: LibraryDepartment[];
    tasks: LibraryTask[];
  };
  stats: {
    totalFiles: number;
    totalFolders: number;
    departmentFiles: number;
    taskFiles: number;
  };
};

export type ApiPayload<T> = { data?: T; error?: { message: string } };

