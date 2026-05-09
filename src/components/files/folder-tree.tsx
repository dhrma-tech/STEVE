"use client";

import type * as React from "react";
import { Folder, FolderOpen, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LibraryFolder } from "@/components/files/types";
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
        "flex min-h-10 items-center justify-between gap-2 rounded-[9px] border px-2.5 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]",
        active
          ? "border-[rgba(216,255,122,0.46)] bg-[rgba(216,255,122,0.12)] text-[var(--app-text)]"
          : "border-transparent bg-transparent text-[var(--app-text-50)] hover:border-[var(--app-border)] hover:bg-[rgba(255,255,255,0.05)]"
      )}
      style={{ paddingLeft: 10 + depth * 14 }}
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-[var(--app-primary-light)]">{icon}</span>
        <span className="truncate">{label}</span>
        {badge ? <Badge variant="neutral">{badge}</Badge> : null}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-current/60">{count}</span>
    </button>
  );
}
