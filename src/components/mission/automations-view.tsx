"use client";

import * as React from "react";
import { CalendarClock, Copy, KeyRound, Play, RefreshCw, Send, Trash2, Webhook, Zap } from "lucide-react";

import { SectionHeader, SettingsPanel } from "@/components/settings/settings-sections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SerializedApiKey } from "@/lib/automations/api-keys";
import type { SerializedChannel } from "@/lib/automations/channels";
import type { SerializedSchedule } from "@/lib/automations/schedules";
import type { SerializedTrigger } from "@/lib/automations/triggers";
import { api } from "./ui";

type AutomationsData = {
  schedules: SerializedSchedule[];
  triggers: SerializedTrigger[];
  recentEvents: Array<{ id: string; source: string; eventType: string; summary: string | null; status: string; error: string | null; createdAt: string }>;
  channels: SerializedChannel[];
  apiKeys: SerializedApiKey[];
  agents: Array<{ id: string; name: string; slug: string }>;
  eventTypes: Array<{ type: string; label: string }>;
  hookBaseUrl: string;
  apiBaseUrl: string;
};

// ── Small token-styled fields (work in light and dark) ───────────────────────

const fieldClass =
  "w-full rounded-[8px] border-[0.8px] border-[var(--input)] bg-[var(--foreground-5)] px-2.5 py-1.5 text-sm text-[var(--foreground-80)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-[var(--foreground-50)]">
      {label}
      {children}
      {hint ? <span className="text-[11px]">{hint}</span> : null}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} h-8 ${props.className ?? ""}`} />;
}

function Choice({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={`${fieldClass} h-8`}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** A secret or URL shown once, with a copy button. */
function OnceBox({ label, value, onDone }: { label: string; value: string; onDone: () => void }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="grid gap-2 rounded-[10px] border border-[var(--tt-color-text-yellow-contrast)] bg-[var(--tt-color-text-yellow-contrast)] p-3">
      <p className="text-sm text-[var(--alert)]">{label} It is shown only now.</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-[6px] bg-[var(--foreground-5)] px-2 py-1 font-mono text-xs">{value}</code>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => setCopied(true));
          }}
        >
          <Copy aria-hidden="true" className="size-3.5" />
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  started: "success",
  fired: "success",
  skipped: "warning",
  limited: "warning",
  ignored: "neutral",
  failed: "danger"
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

// ── Schedules ─────────────────────────────────────────────────────────────────

const CRON_PRESETS = [
  { value: "0 9 * * *", label: "Every day at 09:00" },
  { value: "0 9 * * 1-5", label: "Weekdays at 09:00" },
  { value: "0 9 * * 1", label: "Mondays at 09:00" },
  { value: "0 9 1 * *", label: "1st of the month at 09:00" },
  { value: "custom", label: "Custom (cron)" }
];

function ScheduleForm({ data, orgId, onSaved }: { data: AutomationsData; orgId: string; onSaved: () => void }) {
  const browserZone = React.useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const [name, setName] = React.useState("");
  const [preset, setPreset] = React.useState(CRON_PRESETS[2].value);
  const [cron, setCron] = React.useState("0 9 * * 1");
  const [timezone, setTimezone] = React.useState(browserZone);
  const [target, setTarget] = React.useState<"goal" | "agent">("goal");
  const [agentId, setAgentId] = React.useState(data.agents[0]?.id ?? "");
  const [instruction, setInstruction] = React.useState("");
  const [autoApprove, setAutoApprove] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orgs/${orgId}/automations/schedules`, {
        method: "POST",
        body: JSON.stringify({ name, cron: preset === "custom" ? cron : preset, timezone, target, agentId: target === "agent" ? agentId : null, instruction, autoApprove })
      });
      setName("");
      setInstruction("");
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Not saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-[10px] border border-[var(--border-10)] p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly metrics report" />
        </Field>
        <Field label="When">
          <Choice value={preset} onChange={setPreset} options={CRON_PRESETS} />
        </Field>
        {preset === "custom" ? (
          <Field label="Cron (minute hour day month weekday)" hint="e.g. 30 8 * * 1-5 for weekdays at 08:30">
            <TextInput value={cron} onChange={(e) => setCron(e.target.value)} className="font-mono" />
          </Field>
        ) : null}
        <Field label="Time zone">
          <TextInput value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </Field>
        <Field label="Who does it">
          <Choice
            value={target}
            onChange={(v) => setTarget(v as "goal" | "agent")}
            options={[
              { value: "goal", label: "Chief of Staff plans it (goal)" },
              { value: "agent", label: "One agent does it" }
            ]}
          />
        </Field>
        {target === "agent" ? (
          <Field label="Agent">
            <Choice value={agentId} onChange={setAgentId} options={data.agents.map((a) => ({ value: a.id, label: a.name }))} />
          </Field>
        ) : null}
      </div>
      <Field label={target === "goal" ? "Goal" : "Instruction"}>
        <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3} className={fieldClass} placeholder="Pull last week's signups, revenue and churn, and write a one-page report." />
      </Field>
      {target === "goal" ? (
        <label className="flex items-center gap-2 text-xs text-[var(--foreground-50)]">
          <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
          Start the plan without review when it fits the daily budget
        </label>
      ) : null}
      {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
      <div>
        <Button size="sm" variant="app" loading={busy} disabled={!name.trim() || instruction.trim().length < 3} onClick={() => void save()}>
          Add schedule
        </Button>
      </div>
    </div>
  );
}

function SchedulesSection({ data, orgId, reload, setError }: { data: AutomationsData; orgId: string; reload: () => void; setError: (m: string) => void }) {
  const [adding, setAdding] = React.useState(false);
  const agentName = (id: string | null) => data.agents.find((a) => a.id === id)?.name ?? "agent";
  const act = (path: string, init: RequestInit) => api(`/api/orgs/${orgId}/automations/schedules/${path}`, init).then(reload).catch((e: Error) => setError(e.message));
  return (
    <SettingsPanel>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <SectionHeader title="Schedules" detail="Recurring work: a goal for the Chief of Staff or an instruction for one agent, on a timetable." />
        <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
          <CalendarClock aria-hidden="true" className="size-3.5" />
          {adding ? "Close" : "New schedule"}
        </Button>
      </div>
      {adding ? <ScheduleForm data={data} orgId={orgId} onSaved={() => { setAdding(false); reload(); }} /> : null}
      {data.schedules.length === 0 && !adding ? <p className="text-sm text-[var(--foreground-50)]">No schedules yet.</p> : null}
      <ul className="grid gap-2">
        {data.schedules.map((s) => (
          <li key={s.id} className="grid gap-1 rounded-[10px] border border-[var(--border-10)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{s.name}</span>
              <Badge variant={s.enabled ? "success" : "neutral"}>{s.enabled ? "On" : "Off"}</Badge>
              {s.lastStatus ? <Badge variant={STATUS_VARIANT[s.lastStatus] ?? "neutral"}>Last: {s.lastStatus}</Badge> : null}
              <span className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => void act(`${s.id}/run`, { method: "POST" })}>
                  <Play aria-hidden="true" className="size-3.5" /> Run now
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void act(s.id, { method: "PATCH", body: JSON.stringify({ enabled: !s.enabled }) })}>
                  {s.enabled ? "Turn off" : "Turn on"}
                </Button>
                <Button size="sm" variant="danger" aria-label={`Delete ${s.name}`} onClick={() => confirm(`Delete "${s.name}"?`) && void act(s.id, { method: "DELETE" })}>
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </Button>
              </span>
            </div>
            <p className="text-xs text-[var(--foreground-50)]">
              {s.description} ({s.timezone}) · {s.target === "goal" ? "Chief of Staff plans it" : agentName(s.agentId)} · next {when(s.nextRunAt)} · ran {s.runCount}×
            </p>
            <p className="text-sm text-[var(--foreground-80)]">{s.instruction}</p>
            {s.lastMessage ? <p className="text-xs text-[var(--foreground-50)]">{s.lastMessage}</p> : null}
          </li>
        ))}
      </ul>
    </SettingsPanel>
  );
}

// ── Triggers ──────────────────────────────────────────────────────────────────

type TriggerTemplate = { id: string; label: string; source: string; eventPattern: string; target: "goal" | "agent"; agentHint?: string; name: string; instruction: string };

const TRIGGER_TEMPLATES: TriggerTemplate[] = [
  { id: "stripe-customer", label: "Stripe: new customer → onboarding plan", source: "stripe", eventPattern: "customer.created", target: "goal", name: "New customer onboarding", instruction: "A new customer signed up. Plan their onboarding: a welcome email draft, a check of their account setup, and a follow-up task in a week." },
  { id: "sentry-alert", label: "Sentry alert → Engineering triage", source: "sentry", eventPattern: "issue.*,event_alert.*", target: "agent", agentHint: "engineering", name: "Sentry triage", instruction: "Triage this error: find the likely cause, say how many users it affects, and propose a fix. Do not deploy anything." },
  { id: "support-thread", label: "New support thread → Support agent", source: "support", eventPattern: "*", target: "agent", agentHint: "support", name: "Support first response", instruction: "Read this support thread, look up anything relevant, and draft a reply for approval." },
  { id: "github-ci", label: "GitHub CI failed → Engineering", source: "github", eventPattern: "workflow_run.completed,check_suite.completed", target: "agent", agentHint: "engineering", name: "CI failure", instruction: "A CI run finished. If it failed, find which step broke and why, and propose a fix as a draft change." },
  { id: "email", label: "Inbound email → an agent", source: "email", eventPattern: "*", target: "agent", name: "Inbound email", instruction: "Read this email and decide what it needs; draft any reply for approval." },
  { id: "custom", label: "Custom webhook", source: "webhook", eventPattern: "*", target: "agent", name: "", instruction: "" }
];

const SOURCES = [
  { value: "stripe", label: "Stripe" },
  { value: "sentry", label: "Sentry" },
  { value: "github", label: "GitHub" },
  { value: "support", label: "Support (Plain)" },
  { value: "email", label: "Inbound email" },
  { value: "webhook", label: "Any webhook" }
];

const SECRET_HINT: Record<string, string> = {
  stripe: "The endpoint's signing secret (whsec_…) from the Stripe dashboard.",
  github: "The webhook secret you set in GitHub.",
  sentry: "The integration's client secret.",
  support: "Plain's request signing secret, or a shared secret for the X-Steve-Signature header.",
  email: "A shared secret; the sender signs with the X-Steve-Signature header.",
  webhook: "A shared secret; the sender signs with the X-Steve-Signature header."
};

function TriggerForm({ data, orgId, onCreated }: { data: AutomationsData; orgId: string; onCreated: (url: string) => void }) {
  const [template, setTemplate] = React.useState(TRIGGER_TEMPLATES[0].id);
  const base = TRIGGER_TEMPLATES.find((t) => t.id === template)!;
  const pickAgent = (hint?: string) => data.agents.find((a) => hint && a.slug.startsWith(hint))?.id ?? data.agents[0]?.id ?? "";
  const [form, setForm] = React.useState({ ...base, agentId: pickAgent(base.agentHint), signingSecret: "" });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  function applyTemplate(id: string) {
    setTemplate(id);
    const next = TRIGGER_TEMPLATES.find((t) => t.id === id)!;
    setForm({ ...next, agentId: pickAgent(next.agentHint), signingSecret: "" });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ endpointUrl: string }>(`/api/orgs/${orgId}/automations/triggers`, {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          source: form.source,
          eventPattern: form.eventPattern,
          target: form.target,
          agentId: form.target === "agent" ? form.agentId : null,
          instruction: form.instruction,
          signingSecret: form.signingSecret || null
        })
      });
      onCreated(result.endpointUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Not saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-[10px] border border-[var(--border-10)] p-3">
      <Field label="Start from">
        <Choice value={template} onChange={applyTemplate} options={TRIGGER_TEMPLATES.map((t) => ({ value: t.id, label: t.label }))} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <TextInput value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Source">
          <Choice value={form.source} onChange={(v) => set({ source: v })} options={SOURCES} />
        </Field>
        <Field label="Events" hint="An event type, a prefix like pull_request.*, several separated by commas, or *">
          <TextInput value={form.eventPattern} onChange={(e) => set({ eventPattern: e.target.value })} className="font-mono" />
        </Field>
        <Field label="Who handles it">
          <Choice
            value={form.target}
            onChange={(v) => set({ target: v as "goal" | "agent" })}
            options={[
              { value: "agent", label: "One agent" },
              { value: "goal", label: "Chief of Staff plans it (always reviewed)" }
            ]}
          />
        </Field>
        {form.target === "agent" ? (
          <Field label="Agent">
            <Choice value={form.agentId} onChange={(v) => set({ agentId: v })} options={data.agents.map((a) => ({ value: a.id, label: a.name }))} />
          </Field>
        ) : null}
        <Field label="Signing secret (recommended)" hint={SECRET_HINT[form.source]}>
          <TextInput type="password" autoComplete="off" value={form.signingSecret} onChange={(e) => set({ signingSecret: e.target.value })} />
        </Field>
      </div>
      <Field label="Instruction" hint="The event's details are added below it, marked as outside data.">
        <textarea value={form.instruction} onChange={(e) => set({ instruction: e.target.value })} rows={3} className={fieldClass} />
      </Field>
      <p className="text-xs text-[var(--foreground-50)]">
        Work started by an outside event never gets pre-approved outside actions: emails, posts, payments, deploys and pushes always wait for you.
      </p>
      {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
      <div>
        <Button size="sm" variant="app" loading={busy} disabled={!form.name.trim() || form.instruction.trim().length < 3} onClick={() => void save()}>
          Create trigger
        </Button>
      </div>
    </div>
  );
}

function TriggersSection({ data, orgId, reload, setError }: { data: AutomationsData; orgId: string; reload: () => void; setError: (m: string) => void }) {
  const [adding, setAdding] = React.useState(false);
  const [shownUrl, setShownUrl] = React.useState<string | null>(null);
  const agentName = (id: string | null) => data.agents.find((a) => a.id === id)?.name ?? "agent";
  const act = (path: string, init: RequestInit) => api<{ endpointUrl?: string }>(`/api/orgs/${orgId}/automations/triggers/${path}`, init);
  return (
    <SettingsPanel>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <SectionHeader title="Triggers" detail="Start work when something happens elsewhere: a new customer, an error alert, a support thread, a failed build." />
        <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
          <Zap aria-hidden="true" className="size-3.5" />
          {adding ? "Close" : "New trigger"}
        </Button>
      </div>
      {shownUrl ? <OnceBox label="Paste this endpoint URL into the sending service." value={shownUrl} onDone={() => setShownUrl(null)} /> : null}
      {adding ? (
        <TriggerForm
          data={data}
          orgId={orgId}
          onCreated={(url) => {
            setShownUrl(url);
            setAdding(false);
            reload();
          }}
        />
      ) : null}
      {data.triggers.length === 0 && !adding ? <p className="text-sm text-[var(--foreground-50)]">No triggers yet.</p> : null}
      <ul className="grid gap-2">
        {data.triggers.map((t) => (
          <li key={t.id} className="grid gap-1 rounded-[10px] border border-[var(--border-10)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t.name}</span>
              <Badge variant="neutral">{t.source}</Badge>
              <Badge variant={t.enabled ? "success" : "neutral"}>{t.enabled ? "On" : "Off"}</Badge>
              {!t.signed ? <Badge variant="warning">Unsigned</Badge> : null}
              {t.lastStatus ? <Badge variant={STATUS_VARIANT[t.lastStatus] ?? "neutral"}>Last: {t.lastStatus}</Badge> : null}
              <span className="ml-auto flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => confirm("Issue a new endpoint URL? The current one stops working.") && void act(`${t.id}/rotate`, { method: "POST" }).then((r) => r.endpointUrl && setShownUrl(r.endpointUrl)).catch((e: Error) => setError(e.message))}
                >
                  <RefreshCw aria-hidden="true" className="size-3.5" /> New URL
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void act(t.id, { method: "PATCH", body: JSON.stringify({ enabled: !t.enabled }) }).then(reload).catch((e: Error) => setError(e.message))}>
                  {t.enabled ? "Turn off" : "Turn on"}
                </Button>
                <Button size="sm" variant="danger" aria-label={`Delete ${t.name}`} onClick={() => confirm(`Delete "${t.name}"?`) && void act(t.id, { method: "DELETE" }).then(reload).catch((e: Error) => setError(e.message))}>
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </Button>
              </span>
            </div>
            <p className="text-xs text-[var(--foreground-50)]">
              <span className="font-mono">{t.eventPattern}</span> → {t.target === "goal" ? "Chief of Staff (plan reviewed)" : agentName(t.agentId)} · fired {t.fireCount}× · last {when(t.lastFiredAt)} ·
              endpoint <span className="font-mono">{data.hookBaseUrl}{t.tokenPrefix}…</span>
            </p>
            <p className="text-sm text-[var(--foreground-80)]">{t.instruction}</p>
            {t.lastMessage ? <p className="text-xs text-[var(--foreground-50)]">{t.lastMessage}</p> : null}
          </li>
        ))}
      </ul>
      {data.recentEvents.length > 0 ? (
        <div className="grid gap-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">Recent events</p>
          <ul className="grid gap-1 text-xs">
            {data.recentEvents.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_VARIANT[e.status] ?? "neutral"}>{e.status}</Badge>
                <span className="font-mono">{e.source}:{e.eventType}</span>
                <span className="text-[var(--foreground-50)]">{e.summary ?? ""}{e.error ? ` — ${e.error}` : ""}</span>
                <span className="ml-auto text-[var(--foreground-50)]">{when(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SettingsPanel>
  );
}

// ── Channels ──────────────────────────────────────────────────────────────────

function ChannelsSection({ data, orgId, reload, setError }: { data: AutomationsData; orgId: string; reload: () => void; setError: (m: string) => void }) {
  const [adding, setAdding] = React.useState(false);
  const [kind, setKind] = React.useState<"slack" | "webhook">("slack");
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [events, setEvents] = React.useState<string[]>(["approval.required", "question.asked", "plan.proposed", "briefing.ready", "run.failed"]);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [testResult, setTestResult] = React.useState<Record<string, string>>({});
  const act = (path: string, init: RequestInit) => api<{ ok?: boolean; error?: string }>(`/api/orgs/${orgId}/automations/channels/${path}`, init);

  async function save() {
    setBusy(true);
    try {
      const result = await api<{ signingSecret: string | null }>(`/api/orgs/${orgId}/automations/channels`, {
        method: "POST",
        body: JSON.stringify({ kind, name, url, events })
      });
      if (result.signingSecret) setSecret(result.signingSecret);
      setAdding(false);
      setUrl("");
      setName("");
      reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Not saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPanel>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <SectionHeader title="Notifications" detail="Send approvals, questions, plans, briefings and run results to Slack or to your own webhook." />
        <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
          <Send aria-hidden="true" className="size-3.5" />
          {adding ? "Close" : "Add channel"}
        </Button>
      </div>
      {secret ? <OnceBox label="Verify deliveries with this signing secret (X-Steve-Signature header)." value={secret} onDone={() => setSecret(null)} /> : null}
      {adding ? (
        <div className="grid gap-3 rounded-[10px] border border-[var(--border-10)] p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type">
              <Choice value={kind} onChange={(v) => setKind(v as "slack" | "webhook")} options={[{ value: "slack", label: "Slack" }, { value: "webhook", label: "Webhook (signed JSON)" }]} />
            </Field>
            <Field label="Name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "slack" ? "#founders" : "Ops webhook"} />
            </Field>
            <Field label={kind === "slack" ? "Incoming webhook URL" : "URL"}>
              <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder={kind === "slack" ? "https://hooks.slack.com/services/…" : "https://…"} />
            </Field>
          </div>
          <fieldset className="flex flex-wrap gap-3 text-xs text-[var(--foreground-80)]">
            {data.eventTypes.map((e) => (
              <label key={e.type} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={events.includes(e.type)}
                  onChange={(event) => setEvents((list) => (event.target.checked ? [...list, e.type] : list.filter((t) => t !== e.type)))}
                />
                {e.label}
              </label>
            ))}
          </fieldset>
          <div>
            <Button size="sm" variant="app" loading={busy} disabled={!url.trim() || events.length === 0} onClick={() => void save()}>
              Add channel
            </Button>
          </div>
        </div>
      ) : null}
      {data.channels.length === 0 && !adding ? <p className="text-sm text-[var(--foreground-50)]">No channels yet. Approvals and briefings still arrive in the app and by email.</p> : null}
      <ul className="grid gap-2">
        {data.channels.map((c) => (
          <li key={c.id} className="grid gap-1 rounded-[10px] border border-[var(--border-10)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              {c.kind === "slack" ? <Send aria-hidden="true" className="size-3.5" /> : <Webhook aria-hidden="true" className="size-3.5" />}
              <span className="font-medium">{c.name}</span>
              <span className="font-mono text-xs text-[var(--foreground-50)]">{c.urlHint}</span>
              <Badge variant={c.enabled ? "success" : "neutral"}>{c.enabled ? "On" : "Off"}</Badge>
              {c.lastError ? <Badge variant="danger">Failing</Badge> : null}
              <span className="ml-auto flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void act(`${c.id}/test`, { method: "POST" })
                      .then((r) => setTestResult((m) => ({ ...m, [c.id]: r.ok ? "Sent" : `Failed: ${r.error}` })))
                      .then(reload)
                      .catch((e: Error) => setError(e.message))
                  }
                >
                  Test
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void act(c.id, { method: "PATCH", body: JSON.stringify({ enabled: !c.enabled }) }).then(reload).catch((e: Error) => setError(e.message))}>
                  {c.enabled ? "Turn off" : "Turn on"}
                </Button>
                <Button size="sm" variant="danger" aria-label={`Delete ${c.name}`} onClick={() => confirm(`Delete "${c.name}"?`) && void act(c.id, { method: "DELETE" }).then(reload).catch((e: Error) => setError(e.message))}>
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </Button>
              </span>
            </div>
            <p className="text-xs text-[var(--foreground-50)]">
              {c.events.map((e) => data.eventTypes.find((t) => t.type === e)?.label ?? e).join(" · ")}
              {c.lastDeliveredAt ? ` · last sent ${when(c.lastDeliveredAt)}` : ""}
            </p>
            {testResult[c.id] ? <p className="text-xs">{testResult[c.id]}</p> : null}
            {c.lastError ? <p className="text-xs text-[var(--destructive)]">{c.lastError}</p> : null}
          </li>
        ))}
      </ul>
    </SettingsPanel>
  );
}

// ── API keys ──────────────────────────────────────────────────────────────────

function ApiKeysSection({ data, orgId, reload, setError }: { data: AutomationsData; orgId: string; reload: () => void; setError: (m: string) => void }) {
  const [name, setName] = React.useState("");
  const [shownKey, setShownKey] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const active = data.apiKeys.filter((k) => !k.revokedAt);
  return (
    <SettingsPanel>
      <SectionHeader title="API" detail="Start runs, plans and read their status and events from your own tools." />
      {shownKey ? <OnceBox label="Your new API key." value={shownKey} onDone={() => setShownKey(null)} /> : null}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Key name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Zapier, CI, …" />
        </Field>
        <Button
          size="sm"
          variant="app"
          loading={busy}
          disabled={!name.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await api<{ key: string }>(`/api/orgs/${orgId}/automations/api-keys`, { method: "POST", body: JSON.stringify({ name }) });
              setShownKey(result.key);
              setName("");
              reload();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Not created.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <KeyRound aria-hidden="true" className="size-3.5" /> Create key
        </Button>
      </div>
      {active.length > 0 ? (
        <ul className="grid gap-1 text-sm">
          {active.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{k.name}</span>
              <span className="font-mono text-xs text-[var(--foreground-50)]">{k.prefix}…</span>
              <span className="text-xs text-[var(--foreground-50)]">{k.scopes.join(", ")} · last used {when(k.lastUsedAt)}</span>
              <Button
                size="sm"
                variant="danger"
                className="ml-auto"
                onClick={() => confirm(`Revoke "${k.name}"? Requests with it will fail.`) && void api(`/api/orgs/${orgId}/automations/api-keys/${k.id}`, { method: "DELETE" }).then(reload).catch((e: Error) => setError(e.message))}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <pre className="overflow-x-auto rounded-[8px] bg-[var(--foreground-5)] p-3 font-mono text-[11px] leading-5 text-[var(--foreground-80)]">
{`curl -X POST ${data.apiBaseUrl}/runs \\
  -H "Authorization: Bearer stv_…" -H "Content-Type: application/json" \\
  -d '{"agent":"engineering-default","instruction":"Write the release notes"}'

curl ${data.apiBaseUrl}/runs/<runId>            # status, output, cost
curl "${data.apiBaseUrl}/runs/<runId>/events?after=0"   # event log
# {"goal":"…"} instead starts a plan; GET /plans/<planId> reads it.`}
      </pre>
    </SettingsPanel>
  );
}

/** Schedules, triggers, notification channels and API keys (owners and admins). */
export function AutomationsView({ orgId }: { orgId: string }) {
  const [data, setData] = React.useState<AutomationsData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);
  const reload = React.useCallback(() => setVersion((v) => v + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    api<AutomationsData>(`/api/orgs/${orgId}/automations`)
      .then((next) => !cancelled && setData(next))
      .catch((caught: Error) => !cancelled && setError(caught.message));
    return () => {
      cancelled = true;
    };
  }, [orgId, version]);

  if (!data) return <p className="text-sm text-[var(--foreground-50)]">{error ?? "Loading…"}</p>;
  return (
    <div className="grid gap-4">
      {error ? (
        <p className="text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      ) : null}
      <SchedulesSection data={data} orgId={orgId} reload={reload} setError={setError} />
      <TriggersSection data={data} orgId={orgId} reload={reload} setError={setError} />
      <ChannelsSection data={data} orgId={orgId} reload={reload} setError={setError} />
      <ApiKeysSection data={data} orgId={orgId} reload={reload} setError={setError} />
    </div>
  );
}
