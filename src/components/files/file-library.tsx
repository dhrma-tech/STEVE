"use client";

import * as React from "react";
import { Files, FolderPlus, RefreshCw, Search, UploadCloud } from "lucide-react";
import { FileList } from "@/components/files/file-cards";
import { FilePreviewPanel } from "@/components/files/file-preview-panel";
import { FolderTree } from "@/components/files/folder-tree";
import { FileUploadDialog } from "@/components/files/upload-dialog";
import type { ApiPayload, FileLibraryPayload, LibraryFile } from "@/components/files/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { SelectField } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";

export function FileLibrary({
  orgId,
  compact = false,
  className
}: {
  orgId: string;
  compact?: boolean;
  className?: string;
}) {
  const [data, setData] = React.useState<FileLibraryPayload | null>(null);
  const [query, setQuery] = React.useState("");
  const [folderId, setFolderId] = React.useState("all");
  const [departmentId, setDepartmentId] = React.useState("all");
  const [selectedFileId, setSelectedFileId] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("file");
  });
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = React.useState(0);

  const refresh = React.useCallback(() => setRefreshIndex((index) => index + 1), []);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (folderId !== "all") params.set("folderId", folderId);
    if (departmentId !== "all") params.set("departmentId", departmentId);

    queueMicrotask(() => setLoading(true));
    fetch(`/api/orgs/${orgId}/files?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json() as Promise<ApiPayload<FileLibraryPayload>>)
      .then((payload) => {
        if (!payload.data) throw new Error(payload.error?.message ?? "File library did not load.");
        const nextData = payload.data;
        setData(nextData);
        setError(null);
        setSelectedFileId((current) => current ?? nextData.files.find((file) => file.id === nextData.businessPlanFileId)?.id ?? nextData.files[0]?.id ?? null);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(caught instanceof Error ? caught.message : "File library did not load.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [departmentId, folderId, orgId, query, refreshIndex]);

  async function createFolder() {
    if (!data) return;
    const name = window.prompt("Folder name");
    if (!name?.trim()) return;

    try {
      const response = await fetch(`/api/orgs/${orgId}/folders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          parentFolderId: folderId === "all" ? null : folderId,
          departmentId: departmentId === "all" ? null : departmentId
        })
      });
      const payload = (await response.json()) as ApiPayload<{ id: string }>;
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Folder could not be created.");
      setFolderId(payload.data.id);
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Folder could not be created.");
    }
  }

  function upsertFile(file: LibraryFile) {
    setData((current) => current ? { ...current, files: [file, ...current.files.filter((candidate) => candidate.id !== file.id)] } : current);
    setSelectedFileId(file.id);
    refresh();
  }

  function removeFile(fileIdToRemove: string) {
    setData((current) => current ? { ...current, files: current.files.filter((file) => file.id !== fileIdToRemove) } : current);
    setSelectedFileId((current) => (current === fileIdToRemove ? null : current));
    refresh();
  }

  const selectedFile = data?.files.find((file) => file.id === selectedFileId) ?? null;
  const departmentOptions = React.useMemo(
    () => [{ value: "all", label: "All departments" }, ...(data?.catalog.departments.map((department) => ({ value: department.id, label: department.name })) ?? [])],
    [data]
  );
  const defaultFolderId = folderId === "all" ? data?.generalFolderId ?? "all" : folderId;

  return (
    <div className={cn("grid gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 place-items-center rounded-[9px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)]">
            <Files aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">Library</p>
            <h2 className="text-lg font-medium tracking-[0px]">Files</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={refresh}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={createFolder} disabled={!data}>
            <FolderPlus aria-hidden="true" className="size-4" />
            Folder
          </Button>
          <Button variant="app" size="sm" onClick={() => setUploadOpen(true)} disabled={!data}>
            <UploadCloud aria-hidden="true" className="size-4" />
            Upload
          </Button>
        </div>
      </div>

      {data ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Files" value={data.stats.totalFiles} />
          <Stat label="Folders" value={data.stats.totalFolders} />
          <Stat label="Dept files" value={data.stats.departmentFiles} />
          <Stat label="Task files" value={data.stats.taskFiles} />
        </div>
      ) : null}

      <section className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <div className="flex items-center gap-2">
          <Search aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
          <h3 className="text-sm font-medium">Find and organize</h3>
        </div>
        <Input surface="dark" label="Search files" placeholder="Business Plan" value={query} onChange={(event) => setQuery(event.target.value)} />
        <SelectField surface="dark" label="Department" value={departmentId} onValueChange={setDepartmentId} options={departmentOptions} />
      </section>

      {error ? <ErrorState title="Files did not load" description={error} retry={{ onClick: refresh }} /> : null}
      {loading ? <LoadingState rows={5} label="Loading file library" /> : null}

      {data && !loading ? (
        <div className={cn("grid gap-4", compact ? "" : "xl:grid-cols-[280px_minmax(0,1fr)_360px]")}>
          <section className="grid content-start gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Folders</h3>
              <Badge variant="neutral">{data.folders.length}</Badge>
            </div>
            <FolderTree
              folders={data.folders}
              selectedFolderId={folderId}
              generalFolderId={data.generalFolderId}
              totalFiles={data.stats.totalFiles}
              onSelectFolder={setFolderId}
            />
          </section>

          <section className="grid content-start gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Current files</h3>
              <Badge variant="neutral">{data.files.length}</Badge>
            </div>
            <FileList files={data.files} selectedFileId={selectedFileId} onSelectFile={setSelectedFileId} />
          </section>

          <FilePreviewPanel
            orgId={orgId}
            file={selectedFile}
            data={data}
            onFileChange={upsertFile}
            onArchived={removeFile}
          />
        </div>
      ) : null}

      {data ? (
        <FileUploadDialog
          orgId={orgId}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          data={data}
          defaultFolderId={defaultFolderId}
          onUploaded={upsertFile}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}
