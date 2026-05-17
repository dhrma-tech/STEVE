"use client";

import * as React from "react";
import { Archive, Copy, FileClock, FolderInput, Link2, Share2 } from "lucide-react";
import type { ApiPayload, FileLibraryPayload, LibraryFile } from "@/components/files/types";
import { formatBytes, formatDate, iconForFile, visibilityVariant } from "@/components/files/file-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FileUpload } from "@/components/ui/file-upload";
import { SelectField } from "@/components/ui/select";

export function FilePreviewPanel({
  orgId,
  file,
  data,
  onFileChange,
  onArchived
}: {
  orgId: string;
  file: LibraryFile | null;
  data: FileLibraryPayload | null;
  onFileChange: (file: LibraryFile) => void;
  onArchived: (fileId: string) => void;
}) {
  const [saving, setSaving] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  if (!file || !data) {
    return (
      <EmptyState
        surface="dark"
        icon={<FileClock aria-hidden="true" className="size-5" />}
        title="Select a file"
        description="Preview, sharing, version history, and archive controls appear here."
      />
    );
  }

  const activeFile = file;

  async function patchFile(body: Record<string, unknown>, label: string) {
    setSaving(label);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}/files/${activeFile.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as ApiPayload<LibraryFile>;
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "File could not be updated.");
      onFileChange(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "File could not be updated.");
    } finally {
      setSaving(null);
    }
  }

  async function archive() {
    setSaving("archive");
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}/files/${activeFile.id}/archive`, { method: "POST" });
      const payload = (await response.json()) as ApiPayload<LibraryFile>;
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "File could not be archived.");
      onArchived(activeFile.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "File could not be archived.");
    } finally {
      setSaving(null);
    }
  }

  async function copyShare() {
    await patchFile({ visibility: "shared" }, "share");
    const url = `${window.location.origin}${activeFile.shareUrl}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  async function addVersion(files: File[]) {
    const next = files[0];
    if (!next) return;
    setSaving("version");
    setError(null);
    try {
      const content = await readablePreview(next);
      const response = await fetch(`/api/orgs/${orgId}/files/${activeFile.id}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: next.name,
          mimeType: next.type || null,
          sizeBytes: next.size,
          content
        })
      });
      const payload = (await response.json()) as ApiPayload<LibraryFile>;
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Version could not be added.");
      onFileChange(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Version could not be added.");
    } finally {
      setSaving(null);
    }
  }

  const folderOptions = [{ value: "none", label: "No folder" }, ...data.folders.map((folder) => ({ value: folder.id, label: folder.name }))];
  const departmentOptions = [{ value: "none", label: "No department" }, ...data.catalog.departments.map((department) => ({ value: department.id, label: department.name }))];
  const visibilityOptions = [
    { value: "private", label: "Private" },
    { value: "organization", label: "Organization" },
    { value: "department", label: "Department" },
    { value: "task", label: "Task" },
    { value: "shared", label: "Shared link" }
  ];

  return (
    <section className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-[9px] bg-[var(--foreground-8)] text-[var(--foreground-80)]">
            {iconForFile(file)}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium">{file.name}</h3>
            <p className="mt-1 truncate text-xs text-[var(--foreground-50)]">{file.mimeType ?? "unknown type"} / {formatBytes(file.sizeBytes)}</p>
          </div>
        </div>
        <Badge variant={visibilityVariant(file.visibility)}>{file.visibility}</Badge>
      </div>

      {error ? <ErrorState title="File action failed" description={error} /> : null}

      <div className="grid gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium">Preview</h4>
          <Badge variant="neutral">{file.preview.kind}</Badge>
        </div>
        {file.preview.text ? (
          <pre className="max-h-[100px] overflow-auto whitespace-pre-wrap rounded-[8px] bg-[var(--foreground-inverse-20)] p-3 text-xs leading-5 text-[var(--foreground-80)]">
            {file.preview.text}
          </pre>
        ) : (
          <p className="text-sm leading-6 text-[var(--foreground-50)]">{file.preview.message ?? "Preview metadata is available."}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          surface="dark"
          label="Visibility"
          value={file.visibility}
          onValueChange={(value) => patchFile({ visibility: value }, "visibility")}
          options={visibilityOptions}
        />
        <SelectField
          surface="dark"
          label="Folder"
          value={file.folder?.id ?? "none"}
          onValueChange={(value) => patchFile({ folderId: value === "none" ? null : value }, "folder")}
          options={folderOptions}
        />
        <SelectField
          surface="dark"
          label="Department"
          value={file.department?.id ?? "none"}
          onValueChange={(value) => patchFile({ departmentId: value === "none" ? null : value }, "department")}
          options={departmentOptions}
        />
        <div className="grid content-end">
          <Button variant="ghost" size="sm" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={copyShare} disabled={saving !== null}>
            {copied ? <Copy aria-hidden="true" className="size-4" /> : <Share2 aria-hidden="true" className="size-4" />}
            {copied ? "Copied" : "Share"}
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <Link2 aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
          <span className="truncate font-mono text-xs text-[var(--foreground-50)]">{file.shareUrl}</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--foreground-50)]">
          <span>Folder: {file.folder?.name ?? "none"}</span>
          <span>Updated: {formatDate(file.updatedAt)}</span>
        </div>
      </div>

      <div className="grid gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium">Version history</h4>
          <Badge variant="neutral">{file.versions.length}</Badge>
        </div>
        <div className="grid gap-2">
          {file.versions.map((version) => (
            <div key={version.id} className="flex items-center justify-between gap-3 rounded-[8px] bg-[var(--foreground-3)] px-3 py-2">
              <span className="min-w-0">
                <span className="block text-sm">v{version.versionNumber}</span>
                <span className="mt-0.5 block truncate text-xs text-[var(--foreground-50)]">{formatBytes(version.sizeBytes)} / {formatDate(version.createdAt)}</span>
              </span>
              <Badge variant={version.id === file.currentVersionId ? "success" : "neutral"}>{version.id === file.currentVersionId ? "current" : "stored"}</Badge>
            </div>
          ))}
        </div>
        <FileUpload
          surface="dark"
          label={saving === "version" ? "Adding version..." : "Add new version"}
          description="Choose a replacement file to add a version and update the current preview."
          maxFiles={1}
          disabled={saving !== null}
          onFilesSelected={addVersion}
          className="min-h-16"
        />
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <span className="inline-flex h-[30px] items-center gap-1.5 rounded-[8px] px-3 text-[13px] text-[var(--foreground-50)]">
          <FolderInput aria-hidden="true" className="size-4" />
          Organized
        </span>
        <Button variant="danger" size="sm" onClick={archive} disabled={saving !== null}>
          <Archive aria-hidden="true" className="size-4" />
          Archive
        </Button>
      </div>
    </section>
  );
}

async function readablePreview(file: File) {
  if (file.size > 1_000_000 || !isTextish(file)) return null;
  try {
    return await file.text();
  } catch {
    return null;
  }
}

function isTextish(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return type.startsWith("text/") || type.includes("json") || [".md", ".markdown", ".csv", ".txt", ".log"].some((extension) => name.endsWith(extension));
}
