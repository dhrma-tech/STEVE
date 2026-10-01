"use client";

import * as React from "react";

import { SectionHeader, SettingsPanel } from "@/components/settings/settings-sections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "./ui";

type DataSettings = { retentionDays: number | null; redactPii: boolean };
type AuditEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actor: string;
  actorKind: "user" | "agent" | "system";
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

const RETENTION = [
  { value: "", label: "Keep everything" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" }
];

const FILTERS = [
  { value: "", label: "Everything" },
  { value: "tool.", label: "Agent tool calls" },
  { value: "approval.", label: "Approvals" },
  { value: "policy.", label: "Policy and budgets" },
  { value: "integration.", label: "Integrations" },
  { value: "secret.", label: "Secrets" },
  { value: "schedule.", label: "Schedules" },
  { value: "trigger.", label: "Triggers" },
  { value: "channel.", label: "Channels" },
  { value: "api_key.", label: "API keys" }
];

const fieldClass =
  "h-8 rounded-[8px] border-[0.8px] border-[var(--input)] bg-[var(--foreground-5)] px-2.5 text-sm text-[var(--foreground-80)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]";

function summary(entry: AuditEntry): string {
  const meta = entry.metadata ?? {};
  if (entry.action.startsWith("tool.")) return [meta.status, meta.risk].filter(Boolean).join(" · ");
  if (entry.action.startsWith("approval.")) return [meta.tool, meta.scope && `scope ${String(meta.scope)}`].filter(Boolean).join(" · ");
  if ("change" in meta) return JSON.stringify(meta.change).slice(0, 140);
  return entry.targetId ?? "";
}

/** Data retention, personal-data redaction and the audit log (owners and admins). */
export function SecurityView({ orgId }: { orgId: string }) {
  const [settings, setSettings] = React.useState<DataSettings | null>(null);
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [filter, setFilter] = React.useState("");
  const [more, setMore] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    api<DataSettings>(`/api/orgs/${orgId}/settings/data`).then(setSettings).catch((e: Error) => setError(e.message));
  }, [orgId]);

  const load = React.useCallback(
    async (before?: string) => {
      try {
        const query = new URLSearchParams({ limit: "50", ...(filter ? { action: filter } : {}), ...(before ? { before } : {}) });
        const { entries: page } = await api<{ entries: AuditEntry[] }>(`/api/orgs/${orgId}/audit?${query}`);
        setEntries((current) => (before ? [...current, ...page] : page));
        setMore(page.length === 50);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The audit log could not load.");
      }
    },
    [orgId, filter]
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: Partial<DataSettings>) {
    setSaving(true);
    try {
      setSettings(await api<DataSettings>(`/api/orgs/${orgId}/settings/data`, { method: "PATCH", body: JSON.stringify(patch) }));
      void load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Not saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      {error ? <p className="text-sm text-[var(--destructive)]" role="alert">{error}</p> : null}
      <SettingsPanel>
        <SectionHeader
          title="Data"
          detail="How long agent activity (run event logs, incoming webhook events) is kept, and whether personal data is removed before it is stored. Card numbers are always removed."
        />
        {settings ? (
          <div className="flex flex-wrap items-end gap-6">
            <label className="grid gap-1 text-xs text-[var(--foreground-50)]">
              Keep run activity for
              <select
                className={fieldClass}
                value={settings.retentionDays === null ? "" : String(settings.retentionDays)}
                disabled={saving}
                onChange={(event) => void save({ retentionDays: event.target.value ? Number(event.target.value) : null })}
              >
                {RETENTION.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--foreground-80)]">
              <input type="checkbox" checked={settings.redactPii} disabled={saving} onChange={(event) => void save({ redactPii: event.target.checked })} />
              Remove email addresses and phone numbers from stored activity
            </label>
          </div>
        ) : (
          <p className="text-sm text-[var(--foreground-50)]">Loading…</p>
        )}
        <p className="text-xs text-[var(--foreground-50)]">Runs, tasks, approvals, plans and this audit log are kept as the record of what happened.</p>
      </SettingsPanel>

      <SettingsPanel>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <SectionHeader title="Audit log" detail="Every agent tool call, approval decision, and change to policy, credentials, integrations and automations." />
          <select className={fieldClass} value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter the audit log">
            {FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {entries.length === 0 ? <p className="text-sm text-[var(--foreground-50)]">Nothing recorded yet.</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">
              <tr>
                <th className="py-1.5 pr-3 font-normal">When</th>
                <th className="py-1.5 pr-3 font-normal">Who</th>
                <th className="py-1.5 pr-3 font-normal">What</th>
                <th className="py-1.5 font-normal">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-[var(--border-10)] align-top">
                  <td className="whitespace-nowrap py-1.5 pr-3 text-[var(--foreground-50)]">{new Date(entry.createdAt).toLocaleString()}</td>
                  <td className="py-1.5 pr-3">
                    {entry.actor} {entry.actorKind === "agent" ? <Badge variant="neutral">agent</Badge> : null}
                  </td>
                  <td className="py-1.5 pr-3 font-mono">{entry.action}</td>
                  <td className="break-all py-1.5 text-[var(--foreground-50)]">{summary(entry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {more && entries.length > 0 ? (
          <div>
            <Button size="sm" variant="ghost" onClick={() => void load(entries[entries.length - 1].createdAt)}>
              Older entries
            </Button>
          </div>
        ) : null}
      </SettingsPanel>
    </div>
  );
}
