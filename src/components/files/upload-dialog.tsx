"use client";

import * as React from "react";
import { Check, X, UploadCloud } from "lucide-react";
import type { ApiPayload, FileLibraryPayload, LibraryFile } from "@/components/files/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { FileUpload } from "@/components/ui/file-upload";
import { SelectField } from "@/components/ui/select";

const textPreviewLimit = 1_000_000;

export function FileUploadDialog({
  orgId,
  open,
  onOpenChange,
  data,
  defaultFolderId,
  onUploaded
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FileLibraryPayload;
  defaultFolderId: string;
  onUploaded: (file: LibraryFile) => void;
}) {
  const [folderId, setFolderId] = React.useState(defaultFolderId);
  const [departmentId, setDepartmentId] = React.useState("none");
  const [taskId, setTaskId] = React.useState("none");
  const [visibility, setVisibility] = React.useState("organization");
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [extraFolders, setExtraFolders] = React.useState<{ value: string; label: string }[]>([]);
  const [extraTasks, setExtraTasks] = React.useState<{ value: string; label: string }[]>([]);

  // Inline create state — "folder" | "task" | null
  const [creating, setCreating] = React.useState<"folder" | "task" | null>(null);
  const [createName, setCreateName] = React.useState("");
  const [createBusy, setCreateBusy] = React.useState(false);
  const createInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setFolderId(defaultFolderId);
        setError(null);
        setExtraFolders([]);
        setExtraTasks([]);
        setCreating(null);
        setCreateName("");
      });
    }
  }, [defaultFolderId, open]);

  // Auto-focus input when inline create opens
  React.useEffect(() => {
    if (creating) {
      setTimeout(() => createInputRef.current?.focus(), 50);
    }
  }, [creating]);

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        const content = await readablePreview(file);
        const response = await fetch(`/api/orgs/${orgId}/files`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            mimeType: file.type || null,
            sizeBytes: file.size,
            folderId: folderId === "all" ? data.generalFolderId : folderId,
            departmentId: departmentId === "none" ? null : departmentId,
            taskId: taskId === "none" ? null : taskId,
            visibility,
            content
          })
        });
        const payload = (await response.json()) as ApiPayload<LibraryFile>;
        if (!response.ok || !payload.data) {
          throw new Error(payload.error?.message ?? `${file.name} could not be uploaded.`);
        }
        onUploaded(payload.data);
      }
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function confirmCreate() {
    const name = createName.trim();
    if (!name || createBusy) return;
    setCreateBusy(true);
    try {
      if (creating === "folder") {
        const response = await fetch(`/api/orgs/${orgId}/folders`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, parentFolderId: null, departmentId: null })
        });
        const payload = (await response.json()) as ApiPayload<{ id: string }>;
        if (payload.data?.id) {
          setExtraFolders((prev) => [...prev, { value: payload.data!.id, label: name }]);
          setFolderId(payload.data.id);
        }
      } else if (creating === "task") {
        const response = await fetch(`/api/orgs/${orgId}/tasks`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: name, executeMode: "draft" })
        });
        const payload = (await response.json()) as ApiPayload<{ task?: { id: string }; id?: string }>;
        const id = payload.data?.task?.id ?? payload.data?.id;
        if (id) {
          setExtraTasks((prev) => [...prev, { value: id, label: name }]);
          setTaskId(id);
        }
      }
    } catch { /* ignore */ } finally {
      setCreateBusy(false);
      setCreating(null);
      setCreateName("");
    }
  }

  function cancelCreate() {
    setCreating(null);
    setCreateName("");
  }

  const folderOptions = [...data.folders.map((f) => ({ value: f.id, label: f.name })), ...extraFolders];
  const departmentOptions = [{ value: "none", label: "No department" }, ...data.catalog.departments.map((d) => ({ value: d.id, label: d.name }))];
  const taskOptions = [{ value: "none", label: "No task" }, ...data.catalog.tasks.map((t) => ({ value: t.id, label: t.title })), ...extraTasks];
  const visibilityOptions = [
    { value: "private", label: "Private" },
    { value: "organization", label: "Organization" },
    { value: "department", label: "Department" },
    { value: "task", label: "Task" },
    { value: "shared", label: "Shared link" }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>Files are saved to the workspace library with searchable metadata, previews, visibility, and first-version history.</DialogDescription>
        </DialogHeader>

        {error ? <ErrorState title="Upload failed" description={error} /> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Folder — inline create or select */}
          {creating === "folder" ? (
            <InlineCreateField
              label="Folder"
              placeholder="Folder name"
              value={createName}
              busy={createBusy}
              inputRef={createInputRef}
              onChange={setCreateName}
              onConfirm={confirmCreate}
              onCancel={cancelCreate}
            />
          ) : (
            <SelectField surface="dark" label="Folder" value={folderId} onValueChange={setFolderId} options={folderOptions} onCreate={() => setCreating("folder")} createLabel="Create folder" />
          )}

          <SelectField surface="dark" label="Visibility" value={visibility} onValueChange={setVisibility} options={visibilityOptions} />
          <SelectField surface="dark" label="Department" value={departmentId} onValueChange={setDepartmentId} options={departmentOptions} />

          {/* Task — inline create or select */}
          {creating === "task" ? (
            <InlineCreateField
              label="Task"
              placeholder="Task title"
              value={createName}
              busy={createBusy}
              inputRef={createInputRef}
              onChange={setCreateName}
              onConfirm={confirmCreate}
              onCancel={cancelCreate}
            />
          ) : (
            <SelectField surface="dark" label="Task" value={taskId} onValueChange={setTaskId} options={taskOptions} onCreate={() => setCreating("task")} createLabel="Create task" />
          )}
        </div>

        <FileUpload
          surface="dark"
          label={uploading ? "Uploading..." : "Drop or choose files"}
          description="Text, markdown, JSON, and CSV files get inline previews. Other file types keep metadata and versions."
          maxFiles={8}
          disabled={uploading}
          onFilesSelected={uploadFiles}
        />

        <DialogFooter>
          <Button variant="ghost" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <span className="inline-flex h-[30px] items-center gap-1.5 rounded-[8px] px-3 text-[13px] text-[var(--foreground-50)]">
            <UploadCloud aria-hidden="true" className="size-4" />
            {uploading ? "Uploading" : "Waiting for files"}
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InlineCreateField({
  label,
  placeholder,
  value,
  busy,
  inputRef,
  onChange,
  onConfirm,
  onCancel
}: {
  label: string;
  placeholder: string;
  value: string;
  busy: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="grid gap-2 text-sm text-[var(--foreground-80)]">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm();
            if (e.key === "Escape") onCancel();
          }}
          className="h-10 flex-1 rounded-[8px] border border-[var(--input)] bg-[var(--foreground-5)] px-3 text-[15px] text-[var(--foreground-80)] outline-none placeholder:text-[var(--foreground-30)] focus-visible:ring-2 focus-visible:ring-[var(--focused)] disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || !value.trim()}
          aria-label="Confirm"
          className="grid size-10 shrink-0 place-items-center rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)] transition-colors hover:bg-[var(--foreground-10)] disabled:pointer-events-none disabled:opacity-40"
        >
          <Check aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="grid size-10 shrink-0 place-items-center rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-10)]"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}

async function readablePreview(file: File) {
  if (file.size > textPreviewLimit || !isTextish(file)) return null;
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
