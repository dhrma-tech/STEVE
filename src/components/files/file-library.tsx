"use client";

import * as React from "react";
import { Check, Files, FolderPlus, RefreshCw, Search, UploadCloud, X } from "lucide-react";
import { FileList } from "@/components/files/file-cards";
import { FilePreviewPanel } from "@/components/files/file-preview-panel";
import { FolderTree, InlineFolderTree } from "@/components/files/folder-tree";
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
  className,
  initialFileId,
  onFileOpen
}: {
  orgId: string;
  compact?: boolean;
  className?: string;
  initialFileId?: string | null;
  onFileOpen?: (fileId: string) => void;
}) {
  const [data, setData] = React.useState<FileLibraryPayload | null>(null);
  const [query, setQuery] = React.useState("");
  const [folderId, setFolderId] = React.useState("all");
  const [departmentId, setDepartmentId] = React.useState("all");
  const [selectedFileId, setSelectedFileId] = React.useState<string | null>(() => {
    if (initialFileId) return initialFileId;
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("file");
  });
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = React.useState(0);
  const [folderInputOpen, setFolderInputOpen] = React.useState(false);
  const [folderName, setFolderName] = React.useState("");
  const [folderBusy, setFolderBusy] = React.useState(false);
  const folderInputRef = React.useRef<HTMLInputElement>(null);

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

  function openFolderInput() {
    setFolderInputOpen(true);
    setFolderName("");
    setTimeout(() => folderInputRef.current?.focus(), 50);
  }

  function cancelFolderInput() {
    setFolderInputOpen(false);
    setFolderName("");
  }

  async function confirmFolderCreate() {
    const name = folderName.trim();
    if (!name || folderBusy || !data) return;
    setFolderBusy(true);
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
      setFolderInputOpen(false);
      setFolderName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Folder could not be created.");
    } finally {
      setFolderBusy(false);
    }
  }

  async function createFolder() {
    if (!data) return;
    openFolderInput();
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

  if (compact) {
    return (
      <div className={cn("flex min-w-0 flex-col gap-3 overflow-x-hidden", className)}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold tracking-[-0.2px] text-[var(--foreground)]">Library</h2>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={createFolder}
              disabled={!data}
              aria-label="New folder"
              className="grid size-8 place-items-center rounded-[8px] border border-[var(--border-10)] text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-5)] hover:text-[var(--foreground-80)] disabled:pointer-events-none disabled:opacity-40"
            >
              <FolderPlus aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              disabled={!data}
              className="flex items-center gap-1.5 rounded-[8px] border border-[var(--border-10)] px-3 py-1.5 text-xs font-medium text-[var(--foreground-80)] transition-colors hover:bg-[var(--foreground-5)] disabled:pointer-events-none disabled:opacity-40"
            >
              <UploadCloud aria-hidden="true" className="size-3.5" />
              Upload file
            </button>
          </div>
        </div>

        {/* Inline folder creation input */}
        {folderInputOpen ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={folderInputRef}
              type="text"
              placeholder="Folder name"
              value={folderName}
              disabled={folderBusy}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmFolderCreate();
                if (e.key === "Escape") cancelFolderInput();
              }}
              className="h-9 flex-1 rounded-[8px] border border-[var(--focused)] bg-[var(--foreground-5)] px-3 text-sm text-[var(--foreground-80)] outline-none placeholder:text-[var(--foreground-30)] focus-visible:ring-2 focus-visible:ring-[var(--focused)] disabled:opacity-50"
            />
            <button
              type="button"
              onClick={confirmFolderCreate}
              disabled={folderBusy || !folderName.trim()}
              aria-label="Confirm"
              className="grid size-9 shrink-0 place-items-center rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)] transition-colors hover:bg-[var(--foreground-10)] disabled:pointer-events-none disabled:opacity-40"
            >
              <Check aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              onClick={cancelFolderInput}
              aria-label="Cancel"
              className="grid size-9 shrink-0 place-items-center rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-10)]"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ) : null}

        {/* Description */}
        <p className="text-xs leading-5 text-[var(--foreground-50)]">
          Your agents save their work here and are automatically referenced in future tasks unless archived.
        </p>

        {/* Search bar — custom to avoid label/grid nesting issues */}
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--foreground-50)]" />
          <input
            type="search"
            placeholder="Search files"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 w-full rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-5)] pl-9 pr-3 text-sm text-[var(--foreground-80)] outline-none placeholder:text-[var(--foreground-30)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
          />
        </div>

        {error ? <ErrorState title="Files did not load" description={error} retry={{ onClick: refresh }} /> : null}
        {loading ? <LoadingState rows={4} label="Loading library" /> : null}

        {data && !loading ? (
          <InlineFolderTree
            folders={data.folders}
            files={data.files}
            selectedFileId={selectedFileId}
            onSelectFile={onFileOpen ?? setSelectedFileId}
          />
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

  return (
    <div className={cn("grid min-w-0 gap-4 overflow-x-hidden", className)}>
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
        <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
          <Stat label="Files" value={data.stats.totalFiles} />
          <Stat label="Folders" value={data.stats.totalFolders} />
          <Stat label="Dept files" value={data.stats.departmentFiles} />
          <Stat label="Task files" value={data.stats.taskFiles} />
        </div>
      ) : null}

      <section className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <h3 className="text-sm font-medium">Find and organize</h3>
        <Input 
          surface="dark" 
          label="Search files" 
          placeholder="Business Plan" 
          startIcon={<Search aria-hidden="true" className="size-4" />}
          value={query} 
          onChange={(event) => setQuery(event.target.value)} 
        />
        <SelectField surface="dark" label="Department" value={departmentId} onValueChange={setDepartmentId} options={departmentOptions} />
      </section>

      {error ? <ErrorState title="Files did not load" description={error} retry={{ onClick: refresh }} /> : null}
      {loading ? <LoadingState rows={5} label="Loading file library" /> : null}

      {data && !loading ? (
        <div className={cn("grid min-w-0 items-start gap-4", compact ? "" : "xl:grid-cols-[280px_minmax(0,1fr)_360px]")}>
          <section className="grid min-w-0 content-start gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
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

          <section className="grid min-w-0 content-start gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Current files</h3>
              <Badge variant="neutral">{data.files.length}</Badge>
            </div>
            <FileList files={data.files} selectedFileId={selectedFileId} onSelectFile={setSelectedFileId} />
          </section>

          {!compact ? (
            <FilePreviewPanel
              orgId={orgId}
              file={selectedFile}
              data={data}
              onFileChange={upsertFile}
              onArchived={removeFile}
            />
          ) : null}
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
