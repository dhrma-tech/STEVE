"use client";

import * as React from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TaskCatalog, TaskDetail, TaskWorkspacePayload } from "@/components/tasks/types";
import { appTargetOptions, autoAssignOptions, executeModeOptions, priorityOptions, taskTypeOptions } from "@/data/tasks";

type ApiPayload<T> = { data?: T; error?: { message: string } };

export type TaskCreateDefaults = {
  title?: string;
  description?: string;
  departmentId?: string | null;
  agentId?: string | null;
  roadmapItemId?: string | null;
  type?: "agent_task" | "user_task" | "approval_task";
  executeMode?: "queue" | "now" | "draft";
  source?: string;
};

export function TaskCreateDialog({
  orgId,
  open,
  onOpenChange,
  defaults,
  catalog,
  onCreated
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: TaskCreateDefaults | null;
  catalog?: TaskCatalog | null;
  onCreated?: (task: TaskDetail) => void;
}) {
  const [loadedCatalog, setLoadedCatalog] = React.useState<TaskCatalog | null>(catalog ?? null);
  const [loadingCatalog, setLoadingCatalog] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("none");
  const [agentId, setAgentId] = React.useState("none");
  const [assignedUserId, setAssignedUserId] = React.useState("none");
  const [type, setType] = React.useState<TaskCreateDefaults["type"]>("agent_task");
  const [executeMode, setExecuteMode] = React.useState<TaskCreateDefaults["executeMode"]>("queue");
  const [autoAssign, setAutoAssign] = React.useState("auto");
  const [appTarget, setAppTarget] = React.useState("staging");
  const [priority, setPriority] = React.useState("0");
  const [dueAt, setDueAt] = React.useState("");
  const [attachmentNames, setAttachmentNames] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setTitle(defaults?.title ?? "");
      setDescription(defaults?.description ?? "");
      setDepartmentId(defaults?.departmentId ?? "none");
      setAgentId(defaults?.agentId ?? "none");
      setAssignedUserId("none");
      setType(defaults?.type ?? "agent_task");
      setExecuteMode(defaults?.executeMode ?? "queue");
      setAutoAssign("auto");
      setAppTarget("staging");
      setPriority("0");
      setDueAt("");
      setAttachmentNames([]);
      setError(null);
    });
  }, [defaults, open]);

  React.useEffect(() => {
    if (catalog) {
      queueMicrotask(() => setLoadedCatalog(catalog));
    }
  }, [catalog]);

  React.useEffect(() => {
    if (!open || loadedCatalog) return;
    const controller = new AbortController();
    queueMicrotask(() => setLoadingCatalog(true));
    fetch(`/api/orgs/${orgId}/tasks?view=list`, { signal: controller.signal })
      .then((response) => response.json() as Promise<ApiPayload<TaskWorkspacePayload>>)
      .then((payload) => setLoadedCatalog(payload.data?.catalog ?? null))
      .catch(() => {
        if (!controller.signal.aborted) setLoadedCatalog(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCatalog(false);
      });

    return () => controller.abort();
  }, [loadedCatalog, open, orgId]);

  const departmentOptions = React.useMemo(
    () => [
      { value: "none", label: "No department" },
      ...(loadedCatalog?.departments.map((department) => ({ value: department.id, label: department.name })) ?? [])
    ],
    [loadedCatalog]
  );
  const filteredAgents = React.useMemo(
    () => loadedCatalog?.agents.filter((agent) => departmentId === "none" || agent.departmentId === departmentId) ?? [],
    [departmentId, loadedCatalog]
  );
  const agentOptions = React.useMemo(
    () => [
      { value: "none", label: "No agent" },
      ...filteredAgents.map((agent) => ({ value: agent.id, label: agent.name }))
    ],
    [filteredAgents]
  );
  const memberOptions = React.useMemo(
    () => [
      { value: "none", label: "No member" },
      ...(loadedCatalog?.members.map((member) => ({ value: member.id, label: member.name })) ?? [])
    ],
    [loadedCatalog]
  );

  React.useEffect(() => {
    if (agentId === "none") return;
    if (!filteredAgents.some((agent) => agent.id === agentId)) {
      queueMicrotask(() => setAgentId("none"));
    }
  }, [agentId, filteredAgents]);

  async function submit() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/orgs/${orgId}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          departmentId: departmentId === "none" ? null : departmentId,
          agentId: agentId === "none" ? null : agentId,
          assignedUserId: assignedUserId === "none" ? null : assignedUserId,
          roadmapItemId: defaults?.roadmapItemId ?? null,
          type,
          executeMode,
          autoAssign: autoAssign === "auto",
          appTarget,
          priority: Number(priority),
          dueAt: dueAt || null,
          attachmentNames,
          source: defaults?.source ?? "manual"
        })
      });
      const payload = (await response.json()) as ApiPayload<TaskDetail>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Task could not be created.");
      }

      onCreated?.(payload.data);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Task could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = title.trim().length > 0 && !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-[760px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
            New task
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {error ? (
            <div className="rounded-[10px] border border-[var(--tt-color-text-red-contrast)] bg-[var(--tt-color-text-red-contrast)] p-3 text-sm text-[var(--destructive)]">
              {error}
            </div>
          ) : null}

          <Input surface="dark" label="Title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
          <Textarea
            surface="dark"
            label="Task prompt"
            className="min-h-40"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the work, constraints, context, and expected output."
          />

          <div className="grid gap-3 md:grid-cols-3">
            <SelectField surface="dark" label="Execute" value={executeMode} onValueChange={(value) => setExecuteMode(value as TaskCreateDefaults["executeMode"])} options={executeModeOptions} />
            <SelectField surface="dark" label="Auto-assign" value={autoAssign} onValueChange={setAutoAssign} options={autoAssignOptions} />
            <SelectField surface="dark" label="App" value={appTarget} onValueChange={setAppTarget} options={appTargetOptions} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <SelectField surface="dark" label="Type" value={type} onValueChange={(value) => setType(value as TaskCreateDefaults["type"])} options={taskTypeOptions} />
            <SelectField surface="dark" label="Priority" value={priority} onValueChange={setPriority} options={priorityOptions} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <SelectField surface="dark" label="Department" value={departmentId} onValueChange={setDepartmentId} options={departmentOptions} disabled={loadingCatalog} />
            <SelectField surface="dark" label="Agent" value={agentId} onValueChange={setAgentId} options={agentOptions} disabled={loadingCatalog || type === "user_task"} />
            <SelectField surface="dark" label="Member" value={assignedUserId} onValueChange={setAssignedUserId} options={memberOptions} disabled={loadingCatalog} />
          </div>

          <Input surface="dark" label="Due date" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />

          <FileUpload
            label="Add files"
            description={attachmentNames.length ? attachmentNames.join(", ") : "Attach context to this task."}
            maxFiles={6}
            multiple
            onFilesSelected={(files) => setAttachmentNames(files.map((file) => file.name))}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="app" onClick={submit} disabled={!canSubmit}>
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Plus aria-hidden="true" className="size-4" />}
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
