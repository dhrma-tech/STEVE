"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
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

  React.useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setFolderId(defaultFolderId);
        setError(null);
      });
    }
  }, [defaultFolderId, open]);

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

  const folderOptions = data.folders.map((folder) => ({ value: folder.id, label: folder.name }));
  const departmentOptions = [{ value: "none", label: "No department" }, ...data.catalog.departments.map((department) => ({ value: department.id, label: department.name }))];
  const taskOptions = [{ value: "none", label: "No task" }, ...data.catalog.tasks.map((task) => ({ value: task.id, label: task.title }))];
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
          <SelectField surface="dark" label="Folder" value={folderId} onValueChange={setFolderId} options={folderOptions} />
          <SelectField surface="dark" label="Visibility" value={visibility} onValueChange={setVisibility} options={visibilityOptions} />
          <SelectField surface="dark" label="Department" value={departmentId} onValueChange={setDepartmentId} options={departmentOptions} />
          <SelectField surface="dark" label="Task" value={taskId} onValueChange={setTaskId} options={taskOptions} />
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
