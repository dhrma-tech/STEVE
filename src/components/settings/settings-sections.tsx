"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, KeyRound, Plus, RefreshCw, Save } from "lucide-react";
import type {
  AdvancedSettingsData,
  AiSettingsData,
  EnvFilesSettingsData,
  InboxSettingsData,
  NotificationSettingsData,
  OrganizationSettingsData,
  PreferencesSettingsData,
  SupportSettingsData
} from "@/lib/settings/data";
import type { IntegrationDetailData } from "@/lib/integrations/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FileUpload } from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleField } from "@/components/ui/toggle";

type ApiPayload<T> = { data?: T; error?: { message: string } };

export function SettingsPanel({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">{children}</div>;
}

export function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-medium">{title}</h3>
        {detail ? <p className="mt-1 text-sm leading-6 text-[var(--app-text-50)]">{detail}</p> : null}
      </div>
    </div>
  );
}

export function PreferencesSettingsForm({ orgId, initialData }: { orgId: string; initialData: PreferencesSettingsData }) {
  const [data, setData] = React.useState(initialData);
  const [preferredName, setPreferredName] = React.useState(initialData.preferences.preferredName ?? "");
  const [timezone, setTimezone] = React.useState(initialData.preferences.timezone ?? "UTC");
  const [theme, setTheme] = React.useState(initialData.preferences.theme);
  const [shadowsEnabled, setShadowsEnabled] = React.useState(initialData.preferences.shadowsEnabled);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    const payload = await api<PReferencesSettingsDataCompat>(`/api/orgs/${orgId}/settings/preferences`, {
      method: "PATCH",
      body: { preferredName, timezone, theme, shadowsEnabled }
    });
    setBusy(false);
    if (payload.data) {
      setData(payload.data);
      setMessage("Preferences saved.");
    } else {
      setMessage(payload.error?.message ?? "Preferences could not be saved.");
    }
  }

  async function uploadAvatar(files: File[]) {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    const dataUrl = file.type === "image/webp" && file.size < 750_000 ? await fileToDataUrl(file) : null;
    const payload = await api<PReferencesSettingsDataCompat>(`/api/orgs/${orgId}/settings/preferences/avatar`, {
      method: "POST",
      body: { name: file.name, mimeType: file.type, sizeBytes: file.size, dataUrl }
    });
    setBusy(false);
    if (payload.data) {
      setData(payload.data);
      setMessage("Profile photo saved.");
    } else {
      setMessage(payload.error?.message ?? "Profile photo could not be saved.");
    }
  }

  return (
    <SettingsPanel>
      <SectionHeader title="Profile and appearance" detail="Profile photo, timezone, theme, and shadow preferences persist to your workspace account." />
      <div className="grid gap-3 md:grid-cols-2">
        <Input surface="dark" label="Preferred name" value={preferredName} onChange={(event) => setPreferredName(event.target.value)} />
        <Input surface="dark" label="Email" value={data.user.email ?? ""} readOnly />
        <Input surface="dark" label="Timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
        <SelectField
          surface="dark"
          label="Theme"
          value={theme}
          onValueChange={setTheme}
          options={[
            { value: "light", label: "Light" },
            { value: "system", label: "System" },
            { value: "dark", label: "Dark" }
          ]}
        />
      </div>
      <ToggleField label="Shadows" description="Use depth shadows on raised workspace panels." checked={shadowsEnabled} onCheckedChange={setShadowsEnabled} />
      <FileUpload
        surface="dark"
        label="Upload profile photo"
        description="WebP only, max 5MB. Local sandbox stores a safe avatar reference."
        accept="image/webp"
        maxFiles={1}
        disabled={busy}
        onFilesSelected={uploadAvatar}
      />
      <StatusLine message={message} />
      <div className="flex flex-wrap gap-2">
        <Button variant="app" onClick={save} disabled={busy}>
          <Save aria-hidden="true" className="size-4" />
          Save preferences
        </Button>
        <DangerNote label="Delete account" detail="Destructive account deletion is reserved for the final audit pass and requires a dedicated confirmation flow." />
      </div>
      {data.vercel ? <KeyValueRows rows={[["Vercel project", String(data.vercel.config.project ?? "managed sandbox")], ["Vercel status", data.vercel.status]]} /> : null}
    </SettingsPanel>
  );
}

type PReferencesSettingsDataCompat = PreferencesSettingsData;

export function AiSettingsForm({ orgId, initialData }: { orgId: string; initialData: AiSettingsData }) {
  const [data, setData] = React.useState(initialData);
  const [prompt, setPrompt] = React.useState(initialData.promptPersonalization);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    const payload = await api<AiSettingsData>(`/api/orgs/${orgId}/settings/ai`, { method: "PATCH", body });
    setBusy(false);
    if (payload.data) {
      setData(payload.data);
      setPrompt(payload.data.promptPersonalization);
      setMessage("AI settings saved.");
    } else {
      setMessage(payload.error?.message ?? "AI settings could not be saved.");
    }
  }

  return (
    <SettingsPanel>
      <SectionHeader title="Cofounder intelligence" detail="Suggested tasks, queue messages, review behavior, and model selection." />
      <div className="grid gap-3 md:grid-cols-2">
        <ToggleField label="Suggested tasks" checked={data.suggestedTasksEnabled} onCheckedChange={(checked) => patch({ suggestedTasksEnabled: checked })} />
        <ToggleField label="Queue messages" checked={data.queueMessagesEnabled} onCheckedChange={(checked) => patch({ queueMessagesEnabled: checked })} />
        <SelectField
          surface="dark"
          label="Cofounder Review Bot"
          value={data.reviewBotMode}
          onValueChange={(value) => patch({ reviewBotMode: value })}
          options={[
            { value: "blockers_only", label: "Blockers only" },
            { value: "every_change", label: "Every change" },
            { value: "off", label: "Off" }
          ]}
        />
        <SelectField
          surface="dark"
          label="AI model"
          value={data.aiModel}
          onValueChange={(value) => patch({ aiModel: value })}
          options={[
            { value: "claude-sonnet-sandbox", label: "Claude Sonnet sandbox" },
            { value: "gpt-5.4-sandbox", label: "GPT-5.4 sandbox" },
            { value: "gpt-5.4-mini-sandbox", label: "GPT-5.4 Mini sandbox" }
          ]}
        />
      </div>
      <Textarea surface="dark" label={`Prompt personalization (${prompt.length}/2000)`} value={prompt} maxLength={2000} onChange={(event) => setPrompt(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button variant="app" disabled={busy} onClick={() => patch({ promptPersonalization: prompt })}>
          <Save aria-hidden="true" className="size-4" />
          Save prompt
        </Button>
        <Badge variant="neutral">{data.byok.label}</Badge>
      </div>
      <UsageStrip used={data.creditUsage.usedCents} included={data.creditUsage.includedUsageCents} remaining={data.creditUsage.remainingCents} />
      <StatusLine message={message} />
    </SettingsPanel>
  );
}

export function EnvFilesSettingsPanel({ orgId, initialData }: { orgId: string; initialData: EnvFilesSettingsData }) {
  const [data, setData] = React.useState(initialData);
  const [key, setKey] = React.useState("STRIPE_SECRET_KEY");
  const [value, setValue] = React.useState("");
  const [environment, setEnvironment] = React.useState("staging");
  const [message, setMessage] = React.useState<string | null>(null);

  async function upload(files: File[]) {
    const file = files[0];
    if (!file) return;
    const content = await file.text();
    const payload = await api<EnvFilesSettingsData>(`/api/orgs/${orgId}/settings/env-files`, {
      method: "POST",
      body: { fileName: file.name, content, environment, pushToVercel: true }
    });
    if (payload.data) {
      setData(payload.data);
      setMessage(".env metadata saved and pushed to Vercel sandbox.");
    } else {
      setMessage(payload.error?.message ?? "Env file could not be saved.");
    }
  }

  async function saveSecret() {
    const payload = await api<EnvFilesSettingsData>(`/api/orgs/${orgId}/settings/secrets`, {
      method: "POST",
      body: { key, value, environment, pushToVercel: true }
    });
    if (payload.data) {
      setData(payload.data);
      setValue("");
      setMessage("Secret metadata saved. Value remains write-only.");
    } else {
      setMessage(payload.error?.message ?? "Secret could not be saved.");
    }
  }

  return (
    <SettingsPanel>
      <SectionHeader title="Env files and secrets" detail="Values are accepted write-only and never returned in plain text." />
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <FileUpload surface="dark" label="Upload .env" description="Parses KEY=value rows into write-only secret records." accept=".env,text/plain" maxFiles={1} onFilesSelected={upload} />
        <SelectField
          surface="dark"
          label="Environment"
          value={environment}
          onValueChange={setEnvironment}
          options={[
            { value: "development", label: "Development" },
            { value: "test", label: "Test" },
            { value: "staging", label: "Staging" },
            { value: "production", label: "Production" }
          ]}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input surface="dark" label="Secret key" value={key} onChange={(event) => setKey(event.target.value)} />
        <Input surface="dark" label="Secret value" type="password" value={value} onChange={(event) => setValue(event.target.value)} />
        <div className="grid content-end">
          <Button variant="app" disabled={!key.trim() || !value} onClick={saveSecret}>
            <KeyRound aria-hidden="true" className="size-4" />
            Save
          </Button>
        </div>
      </div>
      <SecretList secrets={data.secrets} />
      <KeyValueRows rows={data.exportLinks.map((link) => [link.label, link.status])} />
      <StatusLine message={message} />
    </SettingsPanel>
  );
}

export function NotificationSettingsForm({ orgId, initialData }: { orgId: string; initialData: NotificationSettingsData }) {
  const [data, setData] = React.useState(initialData);
  async function patch(body: Record<string, unknown>) {
    const payload = await api<NotificationSettingsData>(`/api/orgs/${orgId}/settings/notifications`, { method: "PATCH", body });
    if (payload.data) setData(payload.data);
  }
  return (
    <SettingsPanel>
      <SectionHeader title="Notification preferences" detail="Workspace alerts, task updates, billing emails, and mention delivery." />
      <ToggleField label="Desktop alerts" checked={data.desktopAlerts} onCheckedChange={(checked) => patch({ desktopAlerts: checked })} />
      <ToggleField label="Email task updates" checked={data.emailTaskUpdates} onCheckedChange={(checked) => patch({ emailTaskUpdates: checked })} />
      <ToggleField label="Email billing" checked={data.emailBilling} onCheckedChange={(checked) => patch({ emailBilling: checked })} />
      <ToggleField label="In-app mentions" checked={data.inAppMentions} onCheckedChange={(checked) => patch({ inAppMentions: checked })} />
    </SettingsPanel>
  );
}

export function OrganizationSettingsForm({ orgId, initialData }: { orgId: string; initialData: OrganizationSettingsData }) {
  const [data, setData] = React.useState(initialData);
  const [name, setName] = React.useState(initialData.organization.name);
  const [description, setDescription] = React.useState(initialData.organization.description ?? "");
  const [source, setSource] = React.useState("Claude");
  const [content, setContent] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);

  async function saveOrg() {
    const payload = await api<OrganizationSettingsData>(`/api/orgs/${orgId}/settings/organization`, { method: "PATCH", body: { name, description } });
    if (payload.data) {
      setData(payload.data);
      setMessage("Organization saved.");
    } else setMessage(payload.error?.message ?? "Organization could not be saved.");
  }

  async function importContext() {
    const payload = await api<OrganizationSettingsData>(`/api/orgs/${orgId}/settings/organization/context-import`, { method: "POST", body: { source, content } });
    if (payload.data) {
      setData(payload.data);
      setContent("");
      setMessage("Context imported.");
    } else setMessage(payload.error?.message ?? "Context could not be imported.");
  }

  return (
    <SettingsPanel>
      <SectionHeader title="Organization and members" detail="Company profile, team members, and imported context from external thinking tools." />
      <div className="grid gap-3 md:grid-cols-2">
        <Input surface="dark" label="Company name" value={name} onChange={(event) => setName(event.target.value)} />
        <Input surface="dark" label="Slug" value={data.organization.slug} readOnly />
      </div>
      <Textarea surface="dark" label="Company context" value={description} onChange={(event) => setDescription(event.target.value)} />
      <Button variant="app" onClick={saveOrg}>
        <Save aria-hidden="true" className="size-4" />
        Save organization
      </Button>
      <div className="grid gap-3 rounded-[10px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
        <SectionHeader title="Context import" />
        <SelectField
          surface="dark"
          label="Source"
          value={source}
          onValueChange={setSource}
          options={["ChatGPT", "Claude", "Paperclip", "OpenClaw", "Other"].map((item) => ({ value: item, label: item }))}
        />
        <Textarea surface="dark" label="Imported context" value={content} onChange={(event) => setContent(event.target.value)} />
        <Button variant="app" disabled={!content.trim()} onClick={importContext}>Import context</Button>
      </div>
      <MemberList members={data.members} />
      <KeyValueRows rows={data.contextImports.map((item) => [item.source, `${item.content.length} chars`])} emptyLabel="No context imports yet." />
      <StatusLine message={message} />
    </SettingsPanel>
  );
}

export function InboxSettingsPanel({ orgId, initialData }: { orgId: string; initialData: InboxSettingsData }) {
  const [data, setData] = React.useState(initialData);
  const [domain, setDomain] = React.useState("example.com");
  const [agentId, setAgentId] = React.useState(initialData.agents[0]?.id ?? "");
  const [address, setAddress] = React.useState("engineer@example.com");

  async function addDomain() {
    const payload = await api<InboxSettingsData>(`/api/orgs/${orgId}/settings/inbox/domains`, { method: "POST", body: { domain } });
    if (payload.data) setData(payload.data);
  }
  async function addAddress() {
    const payload = await api<InboxSettingsData>(`/api/orgs/${orgId}/settings/inbox/agent-addresses`, { method: "POST", body: { agentId, address } });
    if (payload.data) setData(payload.data);
  }

  return (
    <SettingsPanel>
      <SectionHeader title="Domains and agent inboxes" detail="Domain setup, DNS records, and agent email addresses." />
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Input surface="dark" label="Domain" value={domain} onChange={(event) => setDomain(event.target.value)} />
        <div className="grid content-end">
          <Button variant="app" onClick={addDomain}><Plus aria-hidden="true" className="size-4" />Domain</Button>
        </div>
      </div>
      <KeyValueRows rows={data.domains.map((item) => [item.domain, item.status])} emptyLabel="No inbox domains yet." />
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <SelectField surface="dark" label="Agent" value={agentId} onValueChange={setAgentId} options={data.agents.map((agent) => ({ value: agent.id, label: agent.name }))} />
        <Input surface="dark" label="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
        <div className="grid content-end">
          <Button variant="app" disabled={!agentId} onClick={addAddress}>Assign</Button>
        </div>
      </div>
      <KeyValueRows rows={data.agentInboxes.map((item) => [item.address, `${item.agent.name} / ${item.status}`])} emptyLabel="No agent inboxes yet." />
    </SettingsPanel>
  );
}

export function SupportSettingsPanel({ data }: { data: SupportSettingsData }) {
  return (
    <SettingsPanel>
      <SectionHeader title="Support surface" detail="Support widget status and support agent handoff state." />
      <KeyValueRows
        rows={[
          ["Widget", `${data.widget.displayName} / ${data.widget.status}`],
          ["Mode", data.widget.mode],
          ["Configured", data.widget.configured ? "yes" : "no"],
          ["Support agent", data.supportAgent?.name ?? "No support agent"]
        ]}
      />
      {data.supportAgent?.inboxes.length ? <KeyValueRows rows={data.supportAgent.inboxes.map((inbox) => [inbox.address, inbox.status])} /> : <EmptyState title="No support inbox" description="Assign a support agent address from Inbox settings." />}
    </SettingsPanel>
  );
}

export function AdvancedSettingsPanel({ orgId, initialData }: { orgId: string; initialData: AdvancedSettingsData }) {
  const [data, setData] = React.useState(initialData);
  const [supabaseUrl, setSupabaseUrl] = React.useState("https://project.supabase.co");
  const [repoUrl, setRepoUrl] = React.useState("https://github.com/company/repo");
  const [confirmation, setConfirmation] = React.useState("");
  const [action, setAction] = React.useState<"supabase" | "repo" | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function confirm() {
    if (!action) return;
    const path = action === "supabase" ? "import-supabase" : "switch-repo";
    const body = action === "supabase" ? { projectUrl: supabaseUrl, confirmation } : { repoUrl, confirmation };
    const payload = await api<AdvancedSettingsData>(`/api/orgs/${orgId}/settings/advanced/${path}`, { method: "POST", body });
    if (payload.data) {
      setData(payload.data);
      setAction(null);
      setConfirmation("");
      setMessage("Advanced setting updated.");
    } else {
      setMessage(payload.error?.message ?? "Advanced action failed.");
    }
  }

  return (
    <SettingsPanel>
      <SectionHeader title="Advanced ownership" detail="Bring your own Supabase project or GitHub repo with explicit destructive confirmations." />
      <KeyValueRows rows={[["GitHub", `${data.github?.mode ?? "sandbox"} / ${data.github?.status ?? "unknown"}`], ["Supabase", `${data.supabase?.mode ?? "sandbox"} / ${data.supabase?.status ?? "unknown"}`], ["Vercel", `${data.vercel?.mode ?? "sandbox"} / ${data.vercel?.status ?? "unknown"}`]]} />
      <div className="grid gap-3 md:grid-cols-2">
        <Input surface="dark" label="Own Supabase project URL" value={supabaseUrl} onChange={(event) => setSupabaseUrl(event.target.value)} />
        <Input surface="dark" label="Own GitHub repo URL" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" onClick={() => setAction("supabase")}>Import own Supabase</Button>
        <Button variant="danger" onClick={() => setAction("repo")}>Switch own repo</Button>
      </div>
      {action ? (
        <div className="grid gap-3 rounded-[10px] border border-[rgba(239,68,68,0.38)] bg-[rgba(239,68,68,0.08)] p-3">
          <SectionHeader title="Destructive confirmation" detail={`Type ${action === "supabase" ? data.confirmations.importSupabase : data.confirmations.switchRepo} before confirming.`} />
          <Input
            surface="dark"
            label="Confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={action === "supabase" ? data.confirmations.importSupabase : data.confirmations.switchRepo}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={confirm}>Confirm</Button>
            <Button variant="ghost" className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" onClick={() => setAction(null)}>Cancel</Button>
          </div>
        </div>
      ) : null}
      <KeyValueRows rows={data.auditLogs.map((log) => [log.action, log.createdAt])} emptyLabel="No advanced actions yet." />
      <StatusLine message={message} />
    </SettingsPanel>
  );
}

export function PaymentsSettingsPanel({ orgId, initialData }: { orgId: string; initialData: NonNullable<IntegrationDetailData> }) {
  const [data, setData] = React.useState(initialData);
  const [message, setMessage] = React.useState<string | null>(null);
  async function action(kind: "connect" | "check" | "disconnect") {
    const payload = await api<NonNullable<IntegrationDetailData>>(`/api/orgs/${orgId}/integrations/stripe/${kind}`, { method: "POST", body: kind === "connect" ? { config: { testMode: "configured", liveMode: "needs_live_keys", webhookStatus: "sandbox_ready" } } : undefined });
    if (payload.data) {
      setData(payload.data);
      setMessage(`Stripe ${kind} complete.`);
    } else setMessage(payload.error?.message ?? `Stripe ${kind} failed.`);
  }
  return (
    <SettingsPanel>
      <SectionHeader title="Stripe payments" detail="Test keys, live keys, webhook status, and mode-specific payment readiness." />
      <KeyValueRows rows={[["Status", data.integration.status], ["Mode", data.integration.mode], ["Test mode", String(data.integration.config.testMode ?? "needs_keys")], ["Live mode", String(data.integration.config.liveMode ?? "not_configured")], ["Webhook", String(data.integration.config.webhookStatus ?? "sandbox")]]} />
      <SecretList secrets={data.secrets.map((secret) => ({ ...secret, integration: { id: data.integration.id, provider: "stripe", status: data.integration.status }, isWriteOnly: true, valuePreview: "••••••••", createdAt: secret.updatedAt, rotatedAt: null }))} />
      <div className="flex flex-wrap gap-2">
        <Button variant="app" onClick={() => action("connect")}>Connect sandbox</Button>
        <Button variant="ghost" className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" onClick={() => action("check")}><RefreshCw aria-hidden="true" className="size-4" />Check</Button>
        <Button variant="danger" onClick={() => action("disconnect")}>Disconnect</Button>
      </div>
      <StatusLine message={message} />
    </SettingsPanel>
  );
}

function SecretList({ secrets }: { secrets: Array<{ id: string; key: string; environment: string; valuePreview: string; hasValue?: boolean; updatedAt: string; integration?: { provider: string; status: string } | null }> }) {
  if (!secrets.length) return <EmptyState title="No secrets stored" description="Add a secret or upload an env file to create write-only records." />;
  return <KeyValueRows rows={secrets.map((secret) => [`${secret.key} (${secret.environment})`, `${secret.valuePreview} / ${secret.integration?.provider ?? "workspace"}`])} />;
}

function MemberList({ members }: { members: OrganizationSettingsData["members"] }) {
  return <KeyValueRows rows={members.map((member) => [member.user.name, `${member.role} / ${member.user.email ?? "no email"}`])} />;
}

function UsageStrip({ used, included, remaining }: { used: number; included: number; remaining: number }) {
  return <KeyValueRows rows={[["Used", formatCents(used)], ["Included", formatCents(included)], ["Remaining", formatCents(remaining)]]} />;
}

function KeyValueRows({ rows, emptyLabel = "No records." }: { rows: Array<[string, string]>; emptyLabel?: string }) {
  if (!rows.length) return <p className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3 text-sm text-[var(--app-text-50)]">{emptyLabel}</p>;
  return (
    <div className="grid overflow-hidden rounded-[10px] border border-[var(--app-border)]">
      {rows.map(([label, value]) => (
        <div key={`${label}-${value}`} className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] bg-[rgba(255,255,255,0.035)] px-3 py-2 text-sm last:border-b-0">
          <span className="min-w-0 truncate text-[var(--app-text-50)]">{label}</span>
          <span className="min-w-0 truncate text-right text-[var(--app-text)]">{value}</span>
        </div>
      ))}
    </div>
  );
}

function StatusLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-2 text-sm text-[var(--app-text-50)]">
      <CheckCircle2 aria-hidden="true" className="size-4 text-[var(--app-primary-light)]" />
      {message}
    </p>
  );
}

function DangerNote({ label, detail }: { label: string; detail: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[8px] border border-[rgba(239,68,68,0.38)] px-3 py-2 text-sm text-red-100">
      <AlertTriangle aria-hidden="true" className="size-4" />
      <span className="font-medium">{label}</span>
      <span className="hidden text-red-100/65 md:inline">{detail}</span>
    </span>
  );
}

export function ExternalLinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-2 text-sm text-[var(--app-primary-light)]">
      <ExternalLink aria-hidden="true" className="size-4" />
      {label}
    </a>
  );
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      <Copy aria-hidden="true" className="size-4" />
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

async function api<T>(url: string, { method, body }: { method: string; body?: unknown }) {
  const response = await fetch(url, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  return response.json() as Promise<ApiPayload<T>>;
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Could not read file.")));
    reader.readAsDataURL(file);
  });
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
