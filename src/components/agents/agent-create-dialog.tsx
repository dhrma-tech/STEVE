"use client";

import * as React from "react";
import { Bot, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AgentDetail, AgentWorkspacePayload } from "@/components/agents/types";
import { agentModelOptions, permissionModeOptions } from "@/data/agents";

type ApiPayload<T> = { data?: T; error?: { message: string } };

export function AgentCreateDialog({
  orgId,
  open,
  onOpenChange,
  catalog,
  onCreated
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: Pick<AgentWorkspacePayload, "departments" | "skills"> | null;
  onCreated: (agent: AgentDetail) => void;
}) {
  const [name, setName] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [model, setModel] = React.useState("claude-sonnet-sandbox");
  const [permissionMode, setPermissionMode] = React.useState("review_required");
  const [prompt, setPrompt] = React.useState("");
  const [skillKeys, setSkillKeys] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      const firstDepartment = catalog?.departments[0];
      setName("");
      setDepartmentId(firstDepartment?.id ?? "");
      setDescription("");
      setModel("claude-sonnet-sandbox");
      setPermissionMode("review_required");
      setPrompt("");
      setSkillKeys([]);
      setError(null);
    });
  }, [catalog, open]);

  const department = catalog?.departments.find((item) => item.id === departmentId) ?? null;
  const departmentSkillOptions = catalog?.skills
    .filter((skill) => !department || skill.departmentSlug === department.slug || skill.category === "Integration")
    .slice(0, 8) ?? [];

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}/agents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          departmentId,
          description,
          model,
          permissionMode,
          prompt,
          skillKeys
        })
      });
      const payload = (await response.json()) as ApiPayload<AgentDetail>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Agent could not be created.");
      }
      onCreated(payload.data);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-[720px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
            New agent
          </DialogTitle>
          <DialogDescription>
            Configure a department agent, model, permissions, prompt, and skills before adding it to the company team.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {error ? (
            <div className="rounded-[10px] border border-[var(--tt-color-text-red-contrast)] bg-[var(--tt-color-text-red-contrast)] p-3 text-sm text-[var(--destructive)]">
              {error}
            </div>
          ) : null}
          <Input surface="dark" label="Name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField
              surface="dark"
              label="Department"
              value={departmentId}
              onValueChange={setDepartmentId}
              options={catalog?.departments.map((departmentOption) => ({ value: departmentOption.id, label: departmentOption.name })) ?? []}
            />
            <SelectField surface="dark" label="Model" value={model} onValueChange={setModel} options={agentModelOptions} />
          </div>
          <SelectField surface="dark" label="Permissions" value={permissionMode} onValueChange={setPermissionMode} options={permissionModeOptions} />
          <Input surface="dark" label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
          <Textarea surface="dark" label="Prompt personalization" value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-h-32" />

          <section className="grid gap-2">
            <h3 className="text-sm font-medium">Tools and skills</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {departmentSkillOptions.map((skill) => {
                const selected = skillKeys.includes(skill.key);
                return (
                  <button
                    key={skill.key}
                    type="button"
                    className={`rounded-[10px] border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focused)] ${
                      selected ? "border-[var(--primary)] bg-[var(--foreground-8)]" : "border-[var(--border-10)] bg-[var(--foreground-3)]"
                    }`}
                    onClick={() => setSkillKeys((current) => selected ? current.filter((key) => key !== skill.key) : [...current, skill.key])}
                  >
                    <span className="block text-sm font-medium">{skill.name}</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--foreground-50)]">{skill.description}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="app" onClick={submit} disabled={!name.trim() || !departmentId || submitting}>
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Plus aria-hidden="true" className="size-4" />}
            Create agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
