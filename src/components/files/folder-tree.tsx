"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Download, ExternalLink, Folder, FolderOpen, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LibraryFile, LibraryFolder } from "@/components/files/types";
import { iconForFile } from "@/components/files/file-cards";
import { cn } from "@/lib/utils/cn";

export function FolderTree({
  folders,
  selectedFolderId,
  generalFolderId,
  totalFiles,
  onSelectFolder
}: {
  folders: LibraryFolder[];
  selectedFolderId: string;
  generalFolderId: string | null;
  totalFiles: number;
  onSelectFolder: (folderId: string) => void;
}) {
  const roots = folders.filter((folder) => !folder.parentFolderId);

  return (
    <div className="grid gap-1">
      <FolderButton
        label="All files"
        count={totalFiles}
        active={selectedFolderId === "all"}
        icon={<Layers aria-hidden="true" className="size-4" />}
        onClick={() => onSelectFolder("all")}
      />
      {roots.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          folders={folders}
          depth={0}
          selectedFolderId={selectedFolderId}
          generalFolderId={generalFolderId}
          onSelectFolder={onSelectFolder}
        />
      ))}
    </div>
  );
}

function FolderNode({
  folder,
  folders,
  depth,
  selectedFolderId,
  generalFolderId,
  onSelectFolder
}: {
  folder: LibraryFolder;
  folders: LibraryFolder[];
  depth: number;
  selectedFolderId: string;
  generalFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
}) {
  const children = folders.filter((candidate) => candidate.parentFolderId === folder.id);
  const active = selectedFolderId === folder.id;
  const Icon = active ? FolderOpen : Folder;

  return (
    <>
      <FolderButton
        label={folder.name}
        count={folder.fileCount}
        active={active}
        depth={depth}
        icon={<Icon aria-hidden="true" className="size-4" />}
        badge={folder.id === generalFolderId ? "General" : null}
        onClick={() => onSelectFolder(folder.id)}
      />
      {children.map((child) => (
        <FolderNode
          key={child.id}
          folder={child}
          folders={folders}
          depth={depth + 1}
          selectedFolderId={selectedFolderId}
          generalFolderId={generalFolderId}
          onSelectFolder={onSelectFolder}
        />
      ))}
    </>
  );
}

export function InlineFolderTree({
  folders,
  files,
  selectedFileId,
  onSelectFile,
}: {
  folders: LibraryFolder[];
  files: LibraryFile[];
  selectedFileId?: string | null;
  onSelectFile?: (fileId: string) => void;
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const folder of folders) {
      if (folder.fileCount > 0) set.add(folder.id);
    }
    return set;
  });

  const filesByFolder = React.useMemo(() => {
    const map = new Map<string, LibraryFile[]>();
    for (const file of files) {
      const key = file.folder?.id ?? "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(file);
    }
    return map;
  }, [files]);

  const roots = folders.filter((f) => !f.parentFolderId);

  const toggle = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="grid gap-0.5">
      {roots.map((folder) => (
        <InlineFolderNode
          key={folder.id}
          folder={folder}
          folders={folders}
          filesByFolder={filesByFolder}
          expanded={expanded}
          selectedFileId={selectedFileId}
          onToggle={toggle}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  );
}

function InlineFolderNode({
  folder,
  folders,
  filesByFolder,
  expanded,
  selectedFileId,
  onToggle,
  onSelectFile,
}: {
  folder: LibraryFolder;
  folders: LibraryFolder[];
  filesByFolder: Map<string, LibraryFile[]>;
  expanded: Set<string>;
  selectedFileId?: string | null;
  onToggle: (id: string) => void;
  onSelectFile?: (fileId: string) => void;
}) {
  const isExpanded = expanded.has(folder.id);
  const children = folders.filter((f) => f.parentFolderId === folder.id);
  const folderFiles = filesByFolder.get(folder.id) ?? [];
  const Icon = isExpanded ? FolderOpen : Folder;
  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  return (
    <>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-left text-sm text-[var(--foreground-80)] transition-colors hover:bg-[var(--foreground-5)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
        onClick={() => onToggle(folder.id)}
      >
        <Chevron aria-hidden="true" className="size-3.5 shrink-0 text-[var(--foreground-50)]" />
        <Icon aria-hidden="true" className="size-4 shrink-0 text-[var(--foreground-50)]" />
        <span className="flex-1 truncate">{folder.name}</span>
        <span className="shrink-0 text-xs tabular-nums text-[var(--foreground-50)]">{folder.fileCount}</span>
      </button>
      {isExpanded && (
        <>
          {folderFiles.map((file) => (
            <div
              key={file.id}
              className={cn(
                "group flex w-full items-center rounded-[8px] text-sm transition-colors",
                selectedFileId === file.id
                  ? "bg-[rgba(216,255,122,0.1)] text-[var(--foreground-80)]"
                  : "text-[var(--foreground-60)] hover:bg-[var(--foreground-5)]"
              )}
            >
              {/* Click to select */}
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-8 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)] focus-visible:rounded-[8px]"
                onClick={() => onSelectFile?.(file.id)}
              >
                <span className="shrink-0 text-[var(--foreground-50)]">{iconForFile(file)}</span>
                <span className="truncate">{file.name}</span>
              </button>
              {/* Hover actions */}
              <div className="flex shrink-0 items-center gap-0.5 pr-2 opacity-0 transition-opacity group-hover:opacity-100">
                <a
                  href={file.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in new tab"
                  className="grid size-6 place-items-center rounded-[5px] text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-10)] hover:text-[var(--foreground-80)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                </a>
                <a
                  href={file.shareUrl}
                  download={file.name}
                  title="Download"
                  className="grid size-6 place-items-center rounded-[5px] text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-10)] hover:text-[var(--foreground-80)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download aria-hidden="true" className="size-3.5" />
                </a>
              </div>
            </div>
          ))}
          {children.map((child) => (
            <InlineFolderNode
              key={child.id}
              folder={child}
              folders={folders}
              filesByFolder={filesByFolder}
              expanded={expanded}
              selectedFileId={selectedFileId}
              onToggle={onToggle}
              onSelectFile={onSelectFile}
            />
          ))}
        </>
      )}
    </>
  );
}

function FolderButton({
  label,
  count,
  active,
  icon,
  depth = 0,
  badge,
  onClick
}: {
  label: string;
  count: number;
  active: boolean;
  icon: React.ReactNode;
  depth?: number;
  badge?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-10 items-center justify-between gap-2 rounded-[9px] border px-2.5 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focused)]",
        active
          ? "border-[rgba(216,255,122,0.46)] bg-[rgba(216,255,122,0.12)] text-[var(--foreground-80)]"
          : "border-transparent bg-transparent text-[var(--foreground-50)] hover:border-[var(--border-10)] hover:bg-[var(--foreground-5)]"
      )}
      style={{ paddingLeft: 10 + depth * 14 }}
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-[var(--foreground-80)]">{icon}</span>
        <span className="truncate">{label}</span>
        {badge ? <Badge variant="neutral">{badge}</Badge> : null}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-current/60">{count}</span>
    </button>
  );
}
