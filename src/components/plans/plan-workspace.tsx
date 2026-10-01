"use client";

import * as React from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, ExternalLink, GitBranch, Sparkles, Trash2, Wallet } from "lucide-react";

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SerializedPlan } from "@/lib/agents/plans/store";

type PlanSummary = {
  id: string;
  goal: string;
  status: SerializedPlan["status"];
  steps: number;
  done: number;
  estimatedCostCents: number;
  createdAt: string;
};
type PlanNodeView = SerializedPlan["nodes"][number];
type AgentOption = { id: string; name: string; slug: string };
type ApiPayload<T> = { data?: T; error?: { message?: string } };

const SYSTEM_SLUGS = new Set(["chief-of-staff", "reviewer"]);
const FINAL = new Set(["completed", "failed", "cancelled"]);
const POLL_MS = 3000;

const PLAN_STATUS: Record<SerializedPlan["status"], { label: string; variant: BadgeVariant }> = {
  drafting: { label: "Planning", variant: "running" },
  proposed: { label: "Needs review", variant: "warning" },
  running: { label: "Running", variant: "running" },
  replanning: { label: "Replanning", variant: "warning" },
  reporting: { label: "Writing report", variant: "running" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Stopped", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "neutral" }
};

const NODE_STATUS: Record<PlanNodeView["status"], { label: string; variant: BadgeVariant }> = {
  pending: { label: "Waiting", variant: "neutral" },
  starting: { label: "Starting", variant: "running" },
  running: { label: "Running", variant: "running" },
  reviewing: { label: "In review", variant: "brand" },
  done: { label: "Done", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  skipped: { label: "Skipped", variant: "neutral" }
};

const cents = (value: number) => (value >= 100 ? `$${(value / 100).toFixed(2)}` : `${Math.round(value)}¢`);
const minutes = (value: number) => (value >= 60 ? `${Math.floor(value / 60)}h ${value % 60}m` : `${value}m`);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init ? { ...init, headers: { "content-type": "application/json", ...init.headers } } : undefined);
  const payload = (await response.json().catch(() => null)) as ApiPayload<T> | null;
  if (!response.ok || !payload?.data) throw new Error(payload?.error?.message ?? "Something went wrong.");
  return payload.data;
}

export function PlanWorkspace({
  orgId,
  initialPlanId,
  onOpenSession
}: {
  orgId: string;
  initialPlanId?: string | null;
  onOpenSession: (sessionId: string) => void;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(initialPlanId ?? null);

  return selectedId ? (
    <PlanDetail orgId={orgId} planId={selectedId} onBack={() => setSelectedId(null)} onOpenSession={onOpenSession} />
  ) : (
    <PlanList orgId={orgId} onSelect={setSelectedId} onOpenSession={onOpenSession} />
  );
}

// ── Goal box and list ─────────────────────────────────────────────────────────

function PlanList({ orgId, onSelect, onOpenSession }: { orgId: string; onSelect: (id: string) => void; onOpenSession: (sessionId: string) => void }) {
  const [plans, setPlans] = React.useState<PlanSummary[] | null>(null);
  const [goal, setGoal] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api<{ plans: PlanSummary[] }>(`/api/orgs/${orgId}/plans`);
        if (!cancelled) setPlans(data.plans);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Plans could not load.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  async function submit() {
    const text = goal.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ plan: SerializedPlan; sessionId: string }>(`/api/orgs/${orgId}/plans`, {
        method: "POST",
        body: JSON.stringify({ goal: text })
      });
      setGoal("");
      onSelect(data.plan.id);
      onOpenSession(data.sessionId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The goal could not be planned.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <PanelTitle icon={<GitBranch aria-hidden="true" className="size-4" />} eyebrow="Chief of Staff" title="Plans" />
      <section className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3 shadow-[var(--shadow-outset-100)]">
        <Textarea
          surface="dark"
          label="What outcome do you want?"
          description="The Chief of Staff splits it across departments. You review the plan before anything starts."
          placeholder="Launch our landing page and announce it"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submit();
          }}
          className="min-h-20"
        />
        <Button variant="app" size="sm" onClick={() => void submit()} loading={busy} disabled={goal.trim().length < 3}>
          <Sparkles aria-hidden="true" className="size-4" />
          Plan it
        </Button>
        {error ? <p className="text-xs text-[var(--destructive)]">{error}</p> : null}
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-medium">Recent plans</h3>
        {plans === null ? (
          <p className="text-xs text-[var(--foreground-50)]">Loading…</p>
        ) : plans.length === 0 ? (
          <EmptyState surface="dark" title="No plans yet" description="Give the Chief of Staff a goal to get a plan you can review." />
        ) : (
          plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelect(plan.id)}
              className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3 text-left shadow-[var(--shadow-outset-100)] transition-colors hover:bg-[var(--foreground-5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{plan.goal}</p>
                <p className="mt-1 text-xs text-[var(--foreground-50)]">
                  {plan.steps ? `${plan.done} of ${plan.steps} steps done` : "Planning"} · est. {cents(plan.estimatedCostCents)}
                </p>
              </div>
              <Badge variant={PLAN_STATUS[plan.status].variant}>{PLAN_STATUS[plan.status].label}</Badge>
            </button>
          ))
        )}
      </section>
    </div>
  );
}

// ── One plan ──────────────────────────────────────────────────────────────────

function PlanDetail({
  orgId,
  planId,
  onBack,
  onOpenSession
}: {
  orgId: string;
  planId: string;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
}) {
  const [plan, setPlan] = React.useState<SerializedPlan | null>(null);
  const [agents, setAgents] = React.useState<AgentOption[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const status = plan?.status;

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      try {
        const data = await api<{ plan: SerializedPlan }>(`/api/orgs/${orgId}/plans/${planId}`);
        if (cancelled) return;
        setPlan(data.plan);
        // Keep following a plan that is moving; a proposed or finished one changes only when someone acts.
        if (!FINAL.has(data.plan.status) && data.plan.status !== "proposed") timer = setTimeout(() => void load(), POLL_MS);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "The plan could not load.");
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orgId, planId, status]);

  React.useEffect(() => {
    if (status !== "proposed") return;
    let cancelled = false;
    async function loadAgents() {
      try {
        const data = await api<{ agents: AgentOption[] }>(`/api/orgs/${orgId}/agents`);
        if (!cancelled) setAgents(data.agents.filter((agent) => !SYSTEM_SLUGS.has(agent.slug)));
      } catch {
        /* reassignment is optional; the plan still shows */
      }
    }
    void loadAgents();
    return () => {
      cancelled = true;
    };
  }, [orgId, status]);

  async function act(label: string, url: string, init?: RequestInit) {
    setBusy(label);
    setError(null);
    try {
      const data = await api<{ plan: SerializedPlan }>(url, init);
      setPlan(data.plan);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  const editNode = (change: Record<string, unknown>) =>
    act(`edit:${String(change.id)}`, `/api/orgs/${orgId}/plans/${planId}`, { method: "PATCH", body: JSON.stringify({ nodes: [change] }) });

  if (!plan) {
    return (
      <div className="grid gap-4">
        <BackButton onBack={onBack} />
        {error ? <p className="text-xs text-[var(--destructive)]">{error}</p> : <p className="text-xs text-[var(--foreground-50)]">Loading plan…</p>}
      </div>
    );
  }

  const live = plan.nodes.filter((node) => node.status !== "skipped");
  const done = live.filter((node) => node.status === "done").length;
  const editable = plan.status === "proposed";
  const keyTitle = new Map(plan.nodes.map((node) => [node.key, node.title]));
  const chiefSession = plan.status === "reporting" ? plan.reportSessionId : plan.planningSessionId;

  return (
    <div className="grid gap-4">
      <BackButton onBack={onBack} />

      <section className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3 shadow-[var(--shadow-outset-100)]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-medium leading-6">{plan.goal}</h2>
          <Badge variant={PLAN_STATUS[plan.status].variant}>{PLAN_STATUS[plan.status].label}</Badge>
        </div>
        {plan.summary ? <p className="text-sm leading-6 text-[var(--foreground-60)]">{plan.summary}</p> : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--foreground-50)]">
          {live.length ? <Stat icon={<CheckCircle2 className="size-3.5" />} text={`${done} of ${live.length} steps`} /> : null}
          <Stat icon={<Wallet className="size-3.5" />} text={`est. ${cents(plan.estimatedCostCents)}${plan.costCents ? ` · spent ${cents(plan.costCents)}` : ""}`} />
          {plan.estimatedMinutes ? <Stat icon={<Clock className="size-3.5" />} text={`~${minutes(plan.estimatedMinutes)}`} /> : null}
          {plan.replanCount ? <Stat icon={<GitBranch className="size-3.5" />} text={`replanned ${plan.replanCount}×`} /> : null}
        </div>
        {plan.departments.length ? (
          <div className="flex flex-wrap gap-1.5">
            {plan.departments.map((name) => (
              <Badge key={name}>{name}</Badge>
            ))}
          </div>
        ) : null}
        {plan.errorMessage ? (
          <p className="flex gap-2 rounded-[8px] border border-[var(--tt-color-text-yellow-contrast)] bg-[var(--tt-color-text-yellow-contrast)] p-2 text-xs leading-5 text-[var(--alert)]">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {plan.errorMessage}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {editable ? (
            <Button variant="app" size="sm" loading={busy === "approve"} onClick={() => void act("approve", `/api/orgs/${orgId}/plans/${planId}/approve`, { method: "POST" })}>
              Approve and start
            </Button>
          ) : null}
          {chiefSession && !FINAL.has(plan.status) && plan.status !== "running" ? (
            <Button variant="ghost" size="sm" onClick={() => onOpenSession(chiefSession)}>
              <ExternalLink aria-hidden="true" className="size-3.5" />
              Watch the Chief of Staff
            </Button>
          ) : null}
          {!FINAL.has(plan.status) ? (
            <Button variant="danger" size="sm" loading={busy === "cancel"} onClick={() => void act("cancel", `/api/orgs/${orgId}/plans/${planId}/cancel`, { method: "POST" })}>
              Cancel plan
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-xs text-[var(--destructive)]">{error}</p> : null}
      </section>

      {plan.reportText ? (
        <section className="grid gap-2 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
          <h3 className="text-sm font-medium">Report</h3>
          <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--foreground-80)]">{plan.reportText}</p>
        </section>
      ) : null}

      {plan.nodes.length ? (
        <section className="grid gap-2">
          <h3 className="text-sm font-medium">{editable ? "Steps — edit before approving" : "Steps"}</h3>
          {plan.nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              editable={editable && node.status !== "skipped"}
              agents={agents}
              busy={busy === `edit:${node.id}`}
              dependsOn={node.dependsOn.map((key) => keyTitle.get(key) ?? key)}
              onEdit={(change) => void editNode({ id: node.id, ...change })}
              onOpenSession={onOpenSession}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function NodeCard({
  node,
  editable,
  agents,
  busy,
  dependsOn,
  onEdit,
  onOpenSession
}: {
  node: PlanNodeView;
  editable: boolean;
  agents: AgentOption[];
  busy: boolean;
  dependsOn: string[];
  onEdit: (change: Record<string, unknown>) => void;
  onOpenSession: (sessionId: string) => void;
}) {
  const [title, setTitle] = React.useState(node.title);
  const skipped = node.status === "skipped";
  const status = NODE_STATUS[node.status];

  return (
    <article
      className={`grid gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3 shadow-[var(--shadow-outset-100)] ${skipped ? "opacity-50" : ""}`}
      aria-busy={busy}
    >
      <div className="flex items-start justify-between gap-2">
        {editable ? (
          <Input
            surface="dark"
            aria-label="Step title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              if (title.trim() && title.trim() !== node.title) onEdit({ title: title.trim() });
            }}
            className="h-8 text-sm"
          />
        ) : (
          <h4 className="text-sm font-medium leading-5">{node.title}</h4>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={status.variant}>{status.label}</Badge>
          {editable ? (
            <button
              type="button"
              aria-label={`Remove ${node.title}`}
              onClick={() => onEdit({ remove: true })}
              className="grid size-7 place-items-center rounded-[7px] text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-8)] hover:text-[var(--destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {editable && agents.length ? (
        <SelectField
          surface="dark"
          label="Owner"
          value={node.agent?.id}
          options={agents.map((agent) => ({ value: agent.id, label: agent.name }))}
          onValueChange={(agentId) => {
            if (agentId !== node.agent?.id) onEdit({ agentId });
          }}
        />
      ) : (
        <p className="text-xs text-[var(--foreground-50)]">
          {node.agent?.name ?? "Unassigned"}
          {node.department ? ` · ${node.department.name}` : ""}
          {` · est. ${cents(node.estimatedCostCents)}, ~${minutes(node.estimatedMinutes)}`}
          {node.attempts > 1 ? ` · attempt ${node.attempts}` : ""}
        </p>
      )}

      {node.description && editable ? <p className="text-xs leading-5 text-[var(--foreground-60)]">{node.description}</p> : null}
      {dependsOn.length ? <p className="text-xs text-[var(--foreground-50)]">After: {dependsOn.join(", ")}</p> : null}
      {node.acceptanceCriteria.length ? (
        <ul className="grid gap-0.5 text-xs leading-5 text-[var(--foreground-60)]">
          {node.acceptanceCriteria.map((criterion) => (
            <li key={criterion}>✓ {criterion}</li>
          ))}
        </ul>
      ) : null}
      {editable && node.riskHotspots.length ? (
        <ul className="grid gap-0.5 text-xs leading-5 text-[var(--alert)]">
          {node.riskHotspots.map((risk) => (
            <li key={risk} className="flex gap-1.5">
              <AlertTriangle aria-hidden="true" className="mt-1 size-3 shrink-0" />
              {risk}
            </li>
          ))}
        </ul>
      ) : null}

      {node.result && node.status !== "failed" ? <p className="text-xs leading-5 text-[var(--foreground-80)]">{node.result.summary}</p> : null}
      {node.result?.artifacts.length ? (
        <p className="text-xs text-[var(--foreground-50)]">
          {node.result.artifacts.map((artifact) => `${artifact.type}: ${artifact.title ?? artifact.ref}`).join(" · ")}
        </p>
      ) : null}
      {node.reviewResult ? (
        <p className="text-xs text-[var(--foreground-50)]">
          Review: {node.reviewResult.verdict === "pass" ? "passed" : node.reviewResult.verdict === "fail" ? "rejected" : "skipped"} — {node.reviewResult.summary}
        </p>
      ) : null}
      {node.feedback && node.status !== "done" ? <p className="whitespace-pre-wrap text-xs leading-5 text-[var(--destructive)]">{node.feedback}</p> : null}

      {node.sessionId || node.reviewSessionId ? (
        <div className="flex flex-wrap gap-2">
          {node.sessionId ? (
            <Button variant="ghost" size="sm" onClick={() => onOpenSession(node.sessionId!)}>
              <ExternalLink aria-hidden="true" className="size-3.5" />
              Open work
            </Button>
          ) : null}
          {node.reviewSessionId ? (
            <Button variant="ghost" size="sm" onClick={() => onOpenSession(node.reviewSessionId!)}>
              Open review
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function PanelTitle({ icon, eyebrow, title }: { icon: React.ReactNode; eyebrow: string; title: string }) {
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

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onBack} className="w-fit">
      <ArrowLeft aria-hidden="true" className="size-3.5" />
      All plans
    </Button>
  );
}

function Stat({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden="true">{icon}</span>
      {text}
    </span>
  );
}
