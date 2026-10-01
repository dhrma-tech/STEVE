"use client";

import * as React from "react";
import { Check, History, Pencil, Search, Trash2, X } from "lucide-react";

import { SectionHeader, SettingsPanel } from "@/components/settings/settings-sections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeHit } from "@/lib/knowledge/search";
import type { MemoryView } from "@/lib/memory/store";

type ScopeOption = { value: string; label: string };
type ApiPayload<T> = { data?: T; error?: { message?: string } };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init ? { ...init, headers: { "content-type": "application/json", ...init.headers } } : undefined);
  const payload = (await response.json().catch(() => null)) as ApiPayload<T> | null;
  if (!response.ok || !payload?.data) throw new Error(payload?.error?.message ?? "Something went wrong.");
  return payload.data;
}

const KIND_LABEL: Record<KnowledgeHit["kind"], string> = { file: "File", chat: "Chat", run_summary: "Past work", memory: "Memory" };

function sourceLabel(source: string): string {
  if (source === "founder") return "you";
  if (source === "migrated") return "earlier agent notes";
  if (source.startsWith("agent:")) return `agent ${source.slice(6)}`;
  if (source.startsWith("run:")) return "a run's findings";
  return source;
}

/** The founder's view of what the team knows: review proposals, edit or delete facts, teach new ones, search. */
export function MemoryManager({ orgId }: { orgId: string }) {
  const [memories, setMemories] = React.useState<MemoryView[] | null>(null);
  const [scopes, setScopes] = React.useState<ScopeOption[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);
  const reload = () => setVersion((v) => v + 1);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api<{ memories: MemoryView[]; scopes: ScopeOption[] }>(`/api/orgs/${orgId}/memory`);
        if (cancelled) return;
        setMemories(data.memories);
        setScopes(data.scopes);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Memory could not load.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orgId, version]);

  async function mutate(url: string, init: RequestInit) {
    setError(null);
    try {
      await api(url, init);
      reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not work.");
    }
  }

  const proposed = memories?.filter((m) => m.status === "proposed") ?? [];
  const active = memories?.filter((m) => m.status === "active") ?? [];
  const groups = [...new Set(active.map((m) => m.scopeLabel))].map((label) => ({ label, items: active.filter((m) => m.scopeLabel === label) }));

  return (
    <div className="grid gap-4">
      {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}

      <KnowledgeSearch orgId={orgId} />

      <SettingsPanel>
        <SectionHeader
          title="Needs your review"
          detail="Facts agents were unsure of, and findings from finished work. Agents do not use them until you approve."
        />
        {memories === null ? (
          <p className="text-sm text-[var(--foreground-50)]">Loading…</p>
        ) : proposed.length === 0 ? (
          <p className="text-sm text-[var(--foreground-50)]">Nothing to review.</p>
        ) : (
          proposed.map((memory) => (
            <MemoryRow
              key={memory.id}
              memory={memory}
              onSave={(value) => mutate(`/api/orgs/${orgId}/memory/${memory.id}`, { method: "PATCH", body: JSON.stringify({ value, approve: true }) })}
              onApprove={() => mutate(`/api/orgs/${orgId}/memory/${memory.id}`, { method: "PATCH", body: JSON.stringify({ approve: true }) })}
              onDelete={() => mutate(`/api/orgs/${orgId}/memory/${memory.id}`, { method: "DELETE" })}
            />
          ))
        )}
      </SettingsPanel>

      <SettingsPanel>
        <SectionHeader title="What the team knows" detail="Agents see company facts, their department's and their own notes, most relevant first." />
        {memories !== null && active.length === 0 ? (
          <EmptyState surface="dark" title="No memories yet" description="Teach the team a fact below, or let agents save what they learn." />
        ) : null}
        {groups.map((group) => (
          <section key={group.label} className="grid gap-2">
            <h4 className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">{group.label}</h4>
            {group.items.map((memory) => (
              <MemoryRow
                key={memory.id}
                memory={memory}
                onSave={(value) => mutate(`/api/orgs/${orgId}/memory/${memory.id}`, { method: "PATCH", body: JSON.stringify({ value }) })}
                onDelete={() => mutate(`/api/orgs/${orgId}/memory/${memory.id}`, { method: "DELETE" })}
              />
            ))}
          </section>
        ))}
      </SettingsPanel>

      <TeachFact scopes={scopes} onSubmit={(body) => mutate(`/api/orgs/${orgId}/memory`, { method: "POST", body: JSON.stringify(body) })} />
    </div>
  );
}

function MemoryRow({
  memory,
  onSave,
  onApprove,
  onDelete
}: {
  memory: MemoryView;
  onSave: (value: string) => Promise<void>;
  onApprove?: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const [draft, setDraft] = React.useState(memory.value);
  const [busy, setBusy] = React.useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="grid gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3" aria-busy={busy}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-[var(--foreground-80)]">{memory.key}</p>
          <p className="mt-0.5 text-xs text-[var(--foreground-50)]">
            {memory.scopeLabel} · from {sourceLabel(memory.source)}
            {memory.confidence !== null ? ` · confidence ${Math.round(memory.confidence * 100)}%` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {memory.status === "proposed" ? <Badge variant="warning">Proposed</Badge> : null}
          {onApprove && !editing ? (
            <IconAction label={`Approve ${memory.key}`} onClick={() => void run(onApprove)}>
              <Check aria-hidden="true" className="size-3.5" />
            </IconAction>
          ) : null}
          <IconAction label={`Edit ${memory.key}`} onClick={() => setEditing((value) => !value)}>
            {editing ? <X aria-hidden="true" className="size-3.5" /> : <Pencil aria-hidden="true" className="size-3.5" />}
          </IconAction>
          {memory.history.length ? (
            <IconAction label={`History of ${memory.key}`} onClick={() => setShowHistory((value) => !value)}>
              <History aria-hidden="true" className="size-3.5" />
            </IconAction>
          ) : null}
          <IconAction label={`Delete ${memory.key}`} danger onClick={() => void run(onDelete)}>
            <Trash2 aria-hidden="true" className="size-3.5" />
          </IconAction>
        </div>
      </div>

      {editing ? (
        <div className="grid gap-2">
          <Textarea surface="dark" aria-label={`Value of ${memory.key}`} value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-16" />
          <Button
            variant="app"
            size="sm"
            className="w-fit"
            loading={busy}
            disabled={!draft.trim()}
            onClick={() => void run(async () => {
              await onSave(draft.trim());
              setEditing(false);
            })}
          >
            {memory.status === "proposed" ? "Save and approve" : "Save"}
          </Button>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--foreground-80)]">{memory.value}</p>
      )}

      {showHistory ? (
        <ul className="grid gap-1 border-l border-[var(--border-10)] pl-3 text-xs leading-5 text-[var(--foreground-50)]">
          {memory.history.map((entry) => (
            <li key={`${entry.createdAt}-${entry.value.slice(0, 20)}`}>
              {new Date(entry.createdAt).toLocaleDateString()} · {sourceLabel(entry.source)}: {entry.value}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function IconAction({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded-[7px] text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)] ${danger ? "hover:text-[var(--destructive)]" : "hover:text-[var(--foreground-80)]"}`}
    >
      {children}
    </button>
  );
}

function TeachFact({ scopes, onSubmit }: { scopes: ScopeOption[]; onSubmit: (body: { scope: string; key: string; value: string }) => Promise<void> }) {
  const [scope, setScope] = React.useState("org");
  const [key, setKey] = React.useState("");
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!key.trim() || !value.trim()) return;
    setBusy(true);
    try {
      await onSubmit({ scope, key: key.trim(), value: value.trim() });
      setKey("");
      setValue("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPanel>
      <SectionHeader title="Teach the team a fact" detail="Brand voice, ideal customer, pricing, decisions — or where a credential lives (never the secret itself)." />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField surface="dark" label="Who should know it" value={scope} options={scopes.length ? scopes : [{ value: "org", label: "Company" }]} onValueChange={setScope} />
        <Input surface="dark" label="Name" placeholder="brand_voice" value={key} onChange={(event) => setKey(event.target.value)} />
      </div>
      <Textarea surface="dark" label="Fact" placeholder="Playful, plain English, no jargon." value={value} onChange={(event) => setValue(event.target.value)} className="min-h-20" />
      <Button variant="app" size="sm" className="w-fit" loading={busy} disabled={!key.trim() || !value.trim()} onClick={() => void submit()}>
        Save fact
      </Button>
    </SettingsPanel>
  );
}

function KnowledgeSearch({ orgId }: { orgId: string }) {
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<KnowledgeHit[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function search() {
    if (query.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ hits: KnowledgeHit[] }>(`/api/orgs/${orgId}/knowledge/search?q=${encodeURIComponent(query.trim())}`);
      setHits(data.hits);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPanel>
      <SectionHeader title="Search the company's knowledge" detail="Files (including the business plan), chat, past work and memory — the same search agents use." />
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <Input surface="dark" aria-label="Search knowledge" placeholder="What did we decide about pricing?" value={query} onChange={(event) => setQuery(event.target.value)} startIcon={<Search aria-hidden="true" className="size-4" />} />
        <Button type="submit" variant="app" size="md" loading={busy} disabled={query.trim().length < 3}>
          Search
        </Button>
      </form>
      {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
      {hits && hits.length === 0 ? <p className="text-sm text-[var(--foreground-50)]">No matches.</p> : null}
      {hits?.map((hit) => (
        <a
          key={hit.id}
          href={hit.href ?? undefined}
          className="grid gap-1 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3 transition-colors hover:bg-[var(--foreground-5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Badge>{KIND_LABEL[hit.kind]}</Badge>
            <span className="truncate">{hit.title}</span>
          </span>
          <span className="text-xs leading-5 text-[var(--foreground-60)]">{hit.snippet.replaceAll("**", "")}</span>
        </a>
      ))}
    </SettingsPanel>
  );
}
