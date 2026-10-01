"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";

import { SectionHeader, SettingsPanel } from "@/components/settings/settings-sections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select";
import type { ControlsData } from "@/lib/agents/policy/controls";
import { api, cents } from "./ui";

type Controls = ControlsData & { canEdit: boolean };

const MODES = [
  { value: "review_required", label: "Review required — asks before outside actions" },
  { value: "trusted", label: "Trusted — asks only for comms, spend and deletes" },
  { value: "sandbox_only", label: "Read-only preview — works inside STEVE, never changes anything outside" }
];

/** A cents field that saves on blur. Empty means "no cap of its own". */
function BudgetInput({ label, value, disabled, onSave }: { label: string; value: number | null; disabled: boolean; onSave: (cents: number | null) => Promise<void> }) {
  const [draft, setDraft] = React.useState(value === null ? "" : String(value));
  const [error, setError] = React.useState<string | null>(null);
  return (
    <label className="grid gap-1 text-xs text-[var(--foreground-50)]">
      {label}
      <input
        type="number"
        min={0}
        inputMode="numeric"
        placeholder="no cap"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={async () => {
          const next = draft.trim() === "" ? null : Math.round(Number(draft));
          if (next !== null && (!Number.isFinite(next) || next < 0)) {
            setError("Enter cents, 0 or more.");
            return;
          }
          if (next === value) return;
          setError(null);
          try {
            await onSave(next);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Not saved.");
          }
        }}
        className="h-8 w-28 rounded-[8px] border-[0.8px] border-[var(--input)] bg-[var(--foreground-5)] px-2 text-sm text-[var(--foreground-80)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)] disabled:opacity-50"
      />
      {error ? <span className="text-[var(--destructive)]">{error}</span> : null}
    </label>
  );
}

/** Pause, budgets (org, department, agent), per-run caps and permission modes, with today's spend beside each. */
export function AgentControls({ orgId }: { orgId: string }) {
  const [data, setData] = React.useState<Controls | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);
  const reload = () => setVersion((v) => v + 1);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await api<Controls>(`/api/orgs/${orgId}/settings/agent-controls`);
        if (!cancelled) setData(next);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Controls could not load.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orgId, version]);

  const policy = async (body: Record<string, unknown>) => {
    await api(`/api/orgs/${orgId}/settings/agent-policy`, { method: "PATCH", body: JSON.stringify(body) });
    reload();
  };

  if (!data) return <p className="text-sm text-[var(--foreground-50)]">{error ?? "Loading…"}</p>;
  const locked = !data.canEdit;

  return (
    <div className="grid gap-4">
      {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
      {locked ? <p className="text-sm text-[var(--foreground-50)]">Only owners and admins can change these.</p> : null}

      <SettingsPanel>
        <SectionHeader title="All agents" detail="Pausing stops every run at its next step and blocks new ones until you resume." />
        <div className="flex flex-wrap items-end gap-4">
          <Button
            variant={data.org.agentsPaused ? "app" : "danger"}
            size="sm"
            disabled={locked}
            onClick={() => void policy({ agentsPaused: !data.org.agentsPaused }).catch((e: Error) => setError(e.message))}
          >
            {data.org.agentsPaused ? <Play aria-hidden="true" className="size-3.5" /> : <Pause aria-hidden="true" className="size-3.5" />}
            {data.org.agentsPaused ? "Resume all agents" : "Pause all agents"}
          </Button>
          <BudgetInput
            label={`Daily budget, cents (default ${data.defaults.dailyBudgetCents})`}
            value={data.org.dailyBudgetCents}
            disabled={locked}
            onSave={(value) => policy({ dailyBudgetCents: value })}
          />
          <BudgetInput
            label={`Per-run budget, cents (default ${data.defaults.perRunBudgetCents})`}
            value={data.org.perRunBudgetCents}
            disabled={locked}
            onSave={(value) => policy({ perRunBudgetCents: value })}
          />
          <p className="text-sm">
            Spent today: <strong>{cents(data.org.spentTodayCents)}</strong>
          </p>
        </div>
      </SettingsPanel>

      <SettingsPanel>
        <SectionHeader title="Departments" detail="A daily cap on what a department's agents spend themselves (work they delegate counts for whoever does it)." />
        <div className="grid gap-3">
          {data.departments.map((department) => (
            <div key={department.id} className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border-8)] pb-3 last:border-0 last:pb-0">
              <div>
                <p className="text-sm font-medium">{department.name}</p>
                <p className="text-xs text-[var(--foreground-50)]">Spent today {cents(department.spentTodayCents)}</p>
              </div>
              <BudgetInput
                label="Daily budget, cents"
                value={department.dailyBudgetCents}
                disabled={locked}
                onSave={(value) => policy({ departmentId: department.id, dailyBudgetCents: value })}
              />
            </div>
          ))}
        </div>
      </SettingsPanel>

      <SettingsPanel>
        <SectionHeader title="Agents" detail="How much each agent may do without asking, and what it may spend." />
        <div className="grid gap-4">
          {data.agents.map((agent) => (
            <div key={agent.id} className="grid gap-2 border-b border-[var(--border-8)] pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {agent.name} <span className="text-xs font-normal text-[var(--foreground-50)]">· {agent.department}</span>
                </p>
                <Badge variant="neutral">Spent today {cents(agent.spentTodayCents)}</Badge>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[280px] flex-1">
                  <SelectField
                    surface="dark"
                    label="Permission mode"
                    value={agent.mode}
                    disabled={locked}
                    options={MODES}
                    onValueChange={async (mode) => {
                      try {
                        await api(`/api/orgs/${orgId}/agents/${agent.id}`, { method: "PATCH", body: JSON.stringify({ permissionMode: mode }) });
                        reload();
                      } catch (caught) {
                        setError(caught instanceof Error ? caught.message : "The mode was not saved.");
                      }
                    }}
                  />
                </div>
                <BudgetInput label="Per-run, cents" value={agent.perRunBudgetCents} disabled={locked} onSave={(value) => policy({ agentId: agent.id, perRunBudgetCents: value })} />
                <BudgetInput label="Daily, cents" value={agent.dailyBudgetCents} disabled={locked} onSave={(value) => policy({ agentId: agent.id, dailyBudgetCents: value })} />
              </div>
            </div>
          ))}
        </div>
      </SettingsPanel>
    </div>
  );
}
