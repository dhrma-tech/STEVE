"use client";

import { FileArchive, FileImage, FileSpreadsheet, FileText, Presentation, ScrollText } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { LibraryFile } from "@/components/files/types";
import { cn } from "@/lib/utils/cn";

export function FileList({
  files,
  selectedFileId,
  onSelectFile
}: {
  files: LibraryFile[];
  selectedFileId: string | null;
  onSelectFile: (fileId: string) => void;
}) {
  if (!files.length) {
    return (
      <EmptyState
        surface="dark"
        icon={<FileArchive aria-hidden="true" className="size-5" />}
        title="No files found"
        description="Uploaded, generated, and task-attached files will appear in this folder."
      />
    );
  }

  return (
    <div className="grid gap-2">
      {files.map((file) => (
        <button
          key={file.id}
          type="button"
          className={cn(
            "grid gap-2 rounded-[10px] border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focused)]",
            selectedFileId === file.id
              ? "border-[rgba(216,255,122,0.46)] bg-[rgba(216,255,122,0.1)]"
              : "border-[var(--border-10)] bg-[var(--foreground-3)] hover:bg-[var(--foreground-8)]"
          )}
          onClick={() => onSelectFile(file.id)}
        >
          <span className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 items-start gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-[var(--foreground-8)] text-[var(--foreground-80)]">
                {iconForFile(file)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[var(--foreground-80)]">{file.name}</span>
                <span className="mt-1 block truncate text-xs text-[var(--foreground-50)]">
                  {file.folder?.name ?? "Workspace"} / {formatBytes(file.sizeBytes)} / {formatDate(file.updatedAt)}
                </span>
              </span>
            </span>
            <Badge variant={visibilityVariant(file.visibility)}>{file.visibility}</Badge>
          </span>
          <span className="flex flex-wrap gap-1.5">
            {file.department ? <Badge variant="neutral">{file.department.name}</Badge> : null}
            {file.task ? <Badge variant="warning">Task</Badge> : null}
            {file.versions.length > 1 ? <Badge variant="running">v{file.versions[0].versionNumber}</Badge> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

export function iconForFile(file: LibraryFile) {
  const kind = file.preview.kind;
  if (kind === "image") return <FileImage aria-hidden="true" className="size-4" />;
  if (kind === "spreadsheet" || kind === "csv") return <FileSpreadsheet aria-hidden="true" className="size-4" />;
  if (kind === "presentation") return <Presentation aria-hidden="true" className="size-4" />;
  if (kind === "pdf" || kind === "document") return <ScrollText aria-hidden="true" className="size-4" />;
  return <FileText aria-hidden="true" className="size-4" />;
}

export function visibilityVariant(visibility: string): BadgeVariant {
  if (["organization", "shared"].includes(visibility)) return "success";
  if (visibility === "department") return "running";
  if (visibility === "private") return "neutral";
  return "warning";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

