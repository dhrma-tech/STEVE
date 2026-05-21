"use client";

import * as React from "react";
import { Building2, ChevronRight, ExternalLink, FolderOpen, Gauge, GitBranch, Kanban, MessageSquare, RefreshCw, Send, Sparkles } from "lucide-react";

import { AgentControlCenter } from "@/components/agents/agent-control-center";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { DepartmentDetailPanel } from "@/components/departments/department-detail-panel";
import { FileLibrary } from "@/components/files/file-library";
import { TaskCreateDialog, type TaskCreateDefaults } from "@/components/tasks/task-create-dialog";
import { TaskWorkspace } from "@/components/tasks/task-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CanvasData, CanvasDepartment } from "@/lib/canvas/data";
import type { DepartmentDetailData } from "@/lib/departments/data";

export function CanvasSidePanel({
  data,
  selectedDepartment,
  activeTab,
  onActiveTabChange,
  onOpenRoadmap,
  onClearDepartment,
  onOpenDepartmentBoard,
  onLaunchDepartmentAgent,
  selectedTaskId,
  selectedAgentId,
  onLaunchTaskSession,
  onFileOpen
}: {
  data: CanvasData;
  selectedDepartment: CanvasDepartment | null;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  onOpenRoadmap: () => void;
  onClearDepartment: () => void;
  onOpenDepartmentBoard: (department: CanvasDepartment) => void;
  onLaunchDepartmentAgent: (department: NonNullable<DepartmentDetailData>) => void;
  selectedTaskId?: string | null;
  selectedAgentId?: string | null;
  onLaunchTaskSession: (sessionId: string) => void;
  onFileOpen?: (fileId: string) => void;
}) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createDefaults, setCreateDefaults] = React.useState<TaskCreateDefaults | null>(null);

  function createFromSuggested(item: CanvasData["suggestedTasks"][number]) {
    setCreateDefaults({
      title: item.title,
      description: `${item.stage} roadmap item.`,
      departmentId: item.department?.id ?? null,
      type: item.workType === "approval" ? "approval_task" : item.workType === "user" ? "user_task" : "agent_task",
      source: "suggested_next",
      roadmapItemId: item.id
    });
    setCreateOpen(true);
  }

  return (
    <aside aria-label="Workspace panel" className="animate-panel-slide-in flex min-h-[520px] w-full shrink-0 flex-col border-t border-[var(--border-10)] bg-[var(--background-sidepanel)] text-[var(--foreground-80)] lg:h-full lg:min-h-0 lg:w-[390px] lg:border-l lg:border-t-0 xl:w-[430px] [&_button]:focus-visible:ring-offset-[var(--background-sidepanel)]">
      {selectedDepartment ? (
        <DepartmentDetailPanel
          orgId={data.organization.id}
          department={selectedDepartment}
          onBack={onClearDepartment}
          onOpenBoard={onOpenDepartmentBoard}
          onLaunchAgent={onLaunchDepartmentAgent}
        />
      ) : (
        <Tabs value={activeTab} onValueChange={onActiveTabChange} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-[var(--border-10)] p-2">
            <TabsList className="flex w-full gap-1 overflow-x-auto scrollbar-none">
              <TabsTrigger value="home" className="flex-1 gap-2 px-2 text-xs">
                <Gauge className="size-3.5" />
                <span className="hidden sm:inline">Home</span>
              </TabsTrigger>
              <TabsTrigger value="cofounder" className="flex-1 gap-2 px-2 text-xs">
                <Sparkles className="size-3.5" />
                <span className="hidden sm:inline">AI</span>
              </TabsTrigger>
              <TabsTrigger value="company" className="flex-1 gap-2 px-2 text-xs">
                <Building2 className="size-3.5" />
                <span className="hidden sm:inline">Company</span>
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex-1 gap-2 px-2 text-xs">
                <Kanban className="size-3.5" />
                <span className="hidden sm:inline">Tasks</span>
              </TabsTrigger>
              <TabsTrigger value="library" className="flex-1 gap-2 px-2 text-xs">
                <FolderOpen className="size-3.5" />
                <span className="hidden sm:inline">Files</span>
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden p-4 [&>[data-state=inactive]]:hidden">
            <TabsContent value="home" className="mt-0 flex h-full flex-col overflow-hidden animate-tab-content-fade">
              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-4 pb-2">
                <div className="grid gap-4">
                  <PanelHeading eyebrow="Home" title={greeting(data.organization.name)} icon={<MessageSquare aria-hidden="true" className="size-4" />} />
                  <section className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3 shadow-[var(--shadow-outset-100)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium">Roadmap progress</h3>
                        <p className="mt-1 text-xs text-[var(--foreground-50)]">{data.roadmap.complete} of {data.roadmap.total} items complete</p>
                      </div>
                      <Badge variant="brand">{data.roadmap.progress}%</Badge>
                    </div>
                    <Progress value={data.roadmap.progress} aria-label="Roadmap progress" />
                    <Button variant="app" size="sm" onClick={onOpenRoadmap}>Open roadmap</Button>
                  </section>
                  <SuggestedSection
                    orgId={data.organization.id}
                    initial={data.suggestedTasks}
                    onLaunch={createFromSuggested}
                  />
                </div>
              </div>
              {/* Pinned chatbar — no history */}
              <div className="shrink-0 border-t border-[var(--border-10)] p-3">
                <HomeChatBar orgId={data.organization.id} onOpenAI={() => onActiveTabChange("cofounder")} />
              </div>
            </TabsContent>

            <TabsContent value="cofounder" className="mt-0 h-full animate-tab-content-fade">
              <ChatWorkspace orgId={data.organization.id} initialKind="cofounder" compact />
            </TabsContent>

            <TabsContent value="company" className="mt-0 h-full overflow-y-auto animate-tab-content-fade">
              <CompanyOverview orgId={data.organization.id} orgName={data.organization.name} />
            </TabsContent>

            <TabsContent value="tasks" className="mt-0 grid h-full gap-4 overflow-y-auto animate-tab-content-fade">
              <TaskWorkspace
                orgId={data.organization.id}
                initialTaskId={selectedTaskId}
                compact
                onLaunchSession={onLaunchTaskSession}
              />
            </TabsContent>

            <TabsContent value="library" className="mt-0 grid h-full gap-4 overflow-y-auto animate-tab-content-fade">
              <FileLibrary orgId={data.organization.id} compact onFileOpen={onFileOpen} />
            </TabsContent>
          </div>
        </Tabs>
      )}
      <TaskCreateDialog
        orgId={data.organization.id}
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaults={createDefaults}
      />
    </aside>
  );
}

function PanelHeading({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-[9px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)]">{icon}</span>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">{eyebrow}</p>
        <h2 className="text-lg font-medium tracking-[0px]">{title}</h2>
      </div>
    </div>
  );
}

function MiniRow({ title, detail, status }: { title: string; detail: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3 shadow-[var(--shadow-outset-100)]">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium">{title}</h3>
        <p className="mt-1 truncate text-xs text-[var(--foreground-50)]">{detail}</p>
      </div>
      <Badge variant={status === "complete" || status === "active" || status === "idle" ? "success" : status === "locked" ? "neutral" : "warning"}>
        {status}
      </Badge>
    </div>
  );
}

function StackStatus({ label, status }: { label: string; status: string }) {
  return <MiniRow title={label} detail="Company stack" status={status} />;
}

function HomeChatBar({ orgId, onOpenAI }: { orgId: string; onOpenAI: () => void }) {
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      // Create or reuse cofounder thread
      const threadRes = await fetch(`/api/orgs/${orgId}/chat/threads`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "cofounder", title: "Cofounder chat" })
      });
      const threadPayload = (await threadRes.json()) as { data?: { id: string } };
      const threadId = threadPayload.data?.id;
      if (!threadId) return;
      // Send message (fire-and-forget — response visible in AI tab)
      void fetch(`/api/orgs/${orgId}/chat/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body, mentions: [], attachmentNames: [] })
      });
      onOpenAI();
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-end gap-2 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-2.5">
      <textarea
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
        placeholder="Ask Cofounder anything…"
        disabled={sending}
        className="flex-1 resize-none bg-transparent text-sm text-[var(--foreground-80)] outline-none placeholder:text-[var(--foreground-30)] disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => void send()}
        disabled={!text.trim() || sending}
        className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-[var(--foreground)] text-[var(--background)] transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-30"
      >
        <Send aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

function greeting(company: string) {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${company}`;
  if (hour < 18) return `Good afternoon, ${company}`;
  return `Good evening, ${company}`;
}

// ── Company Overview ──────────────────────────────────────────────────────────

type IntegrationItem = { provider: string; label: string; category: string; integration: { status: string; mode: string; displayName: string } | null };
type AgentItem = { id: string; name: string; description: string | null; status: string; permissionMode: string | null };

const STACK_PROVIDERS = [
  { provider: "domain", label: "Domain" },
  { provider: "email", label: "Email" },
  { provider: "stripe", label: "Payment" },
  { provider: "vercel", label: "Hosting" }
];

type SuggestedItem = CanvasData["suggestedTasks"][number];

function SuggestedSection({
  orgId,
  initial,
  onLaunch
}: {
  orgId: string;
  initial: SuggestedItem[];
  onLaunch: (item: SuggestedItem) => void;
}) {
  const [items, setItems] = React.useState<SuggestedItem[]>(initial);
  const [loading, setLoading] = React.useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/tasks?view=list`);
      const payload = (await res.json()) as { data?: { suggestedTasks?: SuggestedItem[] } };
      setItems(payload.data?.suggestedTasks ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid gap-2 pb-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Suggested next</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]"
        >
          <RefreshCw aria-hidden="true" className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      {items.length ? (
        items.slice(0, 4).map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.status === "locked"}
            aria-label={item.status === "locked" ? `${item.title} — locked` : `Create task: ${item.title}`}
            title={item.status === "locked" ? "Complete previous roadmap items to unlock" : undefined}
            className="rounded-[10px] outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--focused)] disabled:opacity-55 disabled:cursor-not-allowed"
            onClick={() => onLaunch(item)}
          >
            <MiniRow title={item.title} detail={`${item.stage} - ${item.workType}`} status={item.status} />
          </button>
        ))
      ) : (
        <EmptyState surface="dark" title="No suggested tasks" description="Roadmap suggestions will appear after more items unlock." />
      )}
    </section>
  );
}

const STACK_FIELDS: Record<string, Array<{ key: string; label: string; type: string; placeholder: string }>> = {
  domain:  [{ key: "domainName", label: "Domain name", type: "text", placeholder: "example.com" }],
  email:   [
    { key: "emailProvider", label: "Provider", type: "text", placeholder: "resend / sendgrid / smtp" },
    { key: "apiKey",        label: "API key",  type: "password", placeholder: "re_..." }
  ],
  stripe:  [
    { key: "publishableKey", label: "Publishable key", type: "text",     placeholder: "pk_live_..." },
    { key: "secretKey",      label: "Secret key",      type: "password", placeholder: "sk_live_..." }
  ],
  vercel:  [
    { key: "projectName",    label: "Project name",    type: "text", placeholder: "my-company" },
    { key: "productionUrl",  label: "Production URL",  type: "url",  placeholder: "https://app.example.com" },
    { key: "stagingUrl",     label: "Staging URL",     type: "url",  placeholder: "https://staging.example.com" }
  ]
};

function CompanyOverview({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [integrations, setIntegrations] = React.useState<IntegrationItem[] | null>(null);
  const [agents, setAgents] = React.useState<AgentItem[] | null>(null);
  const [showAllAgents, setShowAllAgents] = React.useState(false);
  const [setupProvider, setSetupProvider] = React.useState<string | null>(null);
  const [setupConfig, setSetupConfig] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const reloadIntegrations = React.useCallback(() => {
    fetch(`/api/orgs/${orgId}/integrations`)
      .then((r) => r.json() as Promise<{ data?: { providers: IntegrationItem[] } }>)
      .then((p) => setIntegrations(p.data?.providers ?? []))
      .catch(() => setIntegrations([]));
  }, [orgId]);

  React.useEffect(() => {
    reloadIntegrations();
    fetch(`/api/orgs/${orgId}/agents`)
      .then((r) => r.json() as Promise<{ data?: { agents: AgentItem[] } }>)
      .then((p) => setAgents(p.data?.agents ?? []))
      .catch(() => setAgents([]));
  }, [orgId, reloadIntegrations]);

  function openSetup(provider: string, currentConfig?: Record<string, unknown>) {
    setSetupProvider(provider);
    setSaveError(null);
    const fields = STACK_FIELDS[provider] ?? [];
    const prefill: Record<string, string> = {};
    for (const f of fields) {
      prefill[f.key] = typeof currentConfig?.[f.key] === "string" ? String(currentConfig[f.key]) : "";
    }
    setSetupConfig(prefill);
  }

  async function saveSetup() {
    if (!setupProvider) return;
    setSaving(true);
    setSaveError(null);
    try {
      const firstValue = Object.values(setupConfig).find(Boolean) ?? setupProvider;
      const response = await fetch(`/api/orgs/${orgId}/integrations/${setupProvider}/connect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: { ...setupConfig, sandbox: false, displayName: firstValue } })
      });
      if (!response.ok) {
        const p = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setSaveError(p?.error?.message ?? "Could not connect.");
        return;
      }
      reloadIntegrations();
      setSetupProvider(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not connect.");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect(provider: string) {
    try {
      await fetch(`/api/orgs/${orgId}/integrations/${provider}/disconnect`, { method: "POST" });
      reloadIntegrations();
    } catch { /* ignore */ }
  }

  const stackItems = STACK_PROVIDERS.map(({ provider, label }) => {
    const item = integrations?.find((i) => i.provider === provider);
    const connected = item?.integration && item.integration.mode !== "sandbox";
    return {
      provider,
      label,
      connected: !!connected,
      sandbox: !!item?.integration && !connected,
      displayName: connected ? (item!.integration!.displayName || label) : null,
      rawConfig: item?.integration ? (item.integration as unknown as { config?: Record<string, unknown> }).config : undefined
    };
  });

  const visibleAgents = showAllAgents ? (agents ?? []) : (agents ?? []).slice(0, 6);

  return (
    <div className="grid gap-5 pb-4">
      <h2 className="text-xl font-semibold tracking-[-0.3px] text-[var(--foreground)]">{orgName}</h2>

      {/* STACK */}
      <section className="grid gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--foreground-40)]">Stack</p>
        <div className="overflow-hidden rounded-[12px] border border-[var(--border-10)] bg-[var(--background-l0)]">
          {stackItems.map(({ provider, label, connected, sandbox, displayName, rawConfig }, i) => (
            <div key={provider} className={i < stackItems.length - 1 ? "border-b border-[var(--border-10)]" : ""}>
              {/* Row header */}
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-[var(--foreground-3)]"
                onClick={() => setupProvider === provider ? setSetupProvider(null) : openSetup(provider, rawConfig)}
              >
                <span className="font-medium text-[var(--foreground-80)]">{label}</span>
                {connected ? (
                  <span className="text-xs font-medium text-green-600">{displayName}</span>
                ) : sandbox ? (
                  <span className="rounded-full border border-[var(--border-10)] px-2.5 py-0.5 text-xs text-[var(--foreground-40)]">Configure →</span>
                ) : (
                  <span className="rounded-full border border-[var(--tt-color-text-blue)] px-2.5 py-0.5 text-xs text-[var(--tt-color-text-blue)]">Set up →</span>
                )}
              </button>

              {/* Inline setup form */}
              {setupProvider === provider ? (
                <div className="grid gap-3 border-t border-[var(--border-10)] bg-[var(--foreground-3)] px-4 py-4">
                  {(STACK_FIELDS[provider] ?? []).map((field) => (
                    <label key={field.key} className="grid gap-1 text-xs text-[var(--foreground-60)]">
                      {field.label}
                      <input
                        type={field.type}
                        placeholder={field.placeholder}
                        value={setupConfig[field.key] ?? ""}
                        onChange={(e) => setSetupConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className="h-8 w-full rounded-[7px] border border-[var(--border-10)] bg-[var(--background)] px-2.5 text-sm text-[var(--foreground-80)] outline-none focus:border-[var(--focused)] focus:ring-1 focus:ring-[var(--focused)]"
                      />
                    </label>
                  ))}
                  {saveError ? (
                    <p className="text-xs text-[var(--destructive)]">{saveError}</p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveSetup}
                      disabled={saving}
                      className="flex-1 rounded-[8px] bg-[var(--foreground)] py-1.5 text-xs font-semibold text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Connect"}
                    </button>
                    {(connected || sandbox) ? (
                      <button
                        type="button"
                        onClick={() => { disconnect(provider); setSetupProvider(null); }}
                        className="rounded-[8px] border border-[var(--border-10)] px-3 py-1.5 text-xs text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-5)]"
                      >
                        Disconnect
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setSetupProvider(null)}
                      className="rounded-[8px] border border-[var(--border-10)] px-3 py-1.5 text-xs text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-5)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* AGENTS */}
      <section className="grid gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-left"
          onClick={() => setShowAllAgents((v) => !v)}
        >
          <span className="grid size-6 place-items-center rounded-[6px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-50)]">
            <Building2 aria-hidden="true" className="size-3.5" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--foreground-40)]">Agents</span>
          <ChevronRight aria-hidden="true" className={`size-3.5 text-[var(--foreground-40)] transition-transform ${showAllAgents ? "rotate-90" : ""}`} />
        </button>
        <div className="overflow-hidden rounded-[12px] border border-[var(--border-10)] bg-[var(--background-l0)]">
          {!agents ? (
            <div className="px-4 py-3 text-xs text-[var(--foreground-50)]">Loading agents…</div>
          ) : agents.length === 0 ? (
            <div className="px-4 py-3 text-xs text-[var(--foreground-50)]">No agents yet.</div>
          ) : (
            visibleAgents.map((agent, i) => (
              <div key={agent.id} className={`flex items-start gap-3 px-4 py-3 ${i < visibleAgents.length - 1 ? "border-b border-[var(--border-10)]" : ""}`}>
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center text-[var(--foreground-40)]">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="3" cy="3" r="1.5" fill="currentColor" opacity="0.7" />
                    <circle cx="7" cy="3" r="1.5" fill="currentColor" opacity="0.7" />
                    <circle cx="11" cy="3" r="1.5" fill="currentColor" opacity="0.7" />
                    <circle cx="3" cy="7" r="1.5" fill="currentColor" opacity="0.7" />
                    <circle cx="7" cy="7" r="1.5" fill="currentColor" opacity="0.7" />
                    <circle cx="11" cy="7" r="1.5" fill="currentColor" opacity="0.7" />
                    <circle cx="3" cy="11" r="1.5" fill="currentColor" opacity="0.7" />
                    <circle cx="7" cy="11" r="1.5" fill="currentColor" opacity="0.7" />
                    <circle cx="11" cy="11" r="1.5" fill="currentColor" opacity="0.7" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--foreground-80)]">{agent.name}</p>
                  {agent.description ? (
                    <p className="truncate text-xs text-[var(--foreground-50)]">{agent.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="rounded-[6px] border border-[var(--border-10)] px-2 py-0.5 text-xs text-[var(--foreground-60)] transition-colors hover:bg-[var(--foreground-5)]"
                  >
                    Edit
                  </button>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    agent.status === "active" || agent.status === "idle"
                      ? "bg-[rgba(34,197,94,0.1)] text-[rgba(34,197,94,0.9)]"
                      : "border border-[var(--border-10)] text-[var(--foreground-50)]"
                  }`}>
                    {agent.status === "active" || agent.status === "idle"
                      ? `${agent.permissionMode === "review_required" ? "Manual" : "Auto"} · Active`
                      : "Template"}
                  </span>
                </div>
              </div>
            ))
          )}
          {agents && agents.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllAgents((v) => !v)}
              className="flex w-full items-center justify-center gap-1 border-t border-[var(--border-10)] py-2.5 text-xs text-[var(--foreground-50)] hover:bg-[var(--foreground-3)]"
            >
              {showAllAgents ? "Show less" : `+${agents.length - 6} more`}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
