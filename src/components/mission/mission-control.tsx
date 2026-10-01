"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Activity, Pause, Play } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MissionOverview } from "@/lib/mission/data";
import { ApprovalsInbox } from "./approvals-inbox";
import { BriefingsView } from "./briefings-view";
import { GoalBox } from "./goal-box";
import { HealthView } from "./health-view";
import { AutomationsView } from "./automations-view";
import { SecurityView } from "./security-view";
import { LiveView } from "./live-view";
import { api, cents, panelClass } from "./ui";

const POLL_MS = 4000;
const TABS = ["live", "approvals", "briefings", "health", "automations", "security"] as const;
type Tab = (typeof TABS)[number];

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div className={`${panelClass} gap-1`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">{label}</p>
      <p className={`text-xl font-medium ${tone === "warning" ? "text-[var(--alert)]" : ""}`}>{value}</p>
    </div>
  );
}

/** Mission Control: state a goal, watch the team work, decide what waits for you, read the briefing. */
export function MissionControl({ orgId, initialTab, role }: { orgId: string; initialTab: string | null; role: string }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "live");
  const [overview, setOverview] = React.useState<MissionOverview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);
  const [pausing, setPausing] = React.useState(false);
  const refresh = React.useCallback(() => setVersion((v) => v + 1), []);
  const readOnly = role === "viewer";
  const isManager = role === "owner" || role === "admin";

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      try {
        const data = await api<MissionOverview>(`/api/orgs/${orgId}/mission`);
        if (!cancelled) setOverview(data);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Mission Control could not load.");
      }
      if (!cancelled) timer = setTimeout(() => void load(), POLL_MS);
    }
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orgId, version]);

  async function togglePause() {
    if (!overview) return;
    setPausing(true);
    try {
      await api(`/api/orgs/${orgId}/settings/agent-policy`, { method: "PATCH", body: JSON.stringify({ agentsPaused: !overview.spend.paused }) });
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change the pause.");
    } finally {
      setPausing(false);
    }
  }

  const counts = overview?.counts;
  const spend = overview?.spend;

  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-[9px] border border-[var(--border-10)] bg-[var(--foreground-5)]">
            <Activity aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">Agents</p>
            <h1 className="text-lg font-medium">Mission Control</h1>
          </div>
        </div>
        {spend && isManager ? (
          <Button variant={spend.paused ? "app" : "danger"} size="sm" loading={pausing} onClick={() => void togglePause()}>
            {spend.paused ? <Play aria-hidden="true" className="size-3.5" /> : <Pause aria-hidden="true" className="size-3.5" />}
            {spend.paused ? "Resume all agents" : "Pause all agents"}
          </Button>
        ) : null}
      </header>

      {spend?.paused ? (
        <p className="rounded-[10px] border border-[var(--tt-color-text-yellow-contrast)] bg-[var(--tt-color-text-yellow-contrast)] p-3 text-sm text-[var(--alert)]">
          All agents are paused. Nothing starts or continues until you resume.
        </p>
      ) : null}
      {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Working now" value={counts ? String(counts.activeRuns) : "—"} />
        <Stat label="Waiting for you" value={counts ? String(counts.waitingForYou) : "—"} tone={counts?.waitingForYou ? "warning" : undefined} />
        <Stat label="Spent today" value={spend ? `${cents(spend.todayCents)} / ${cents(spend.dailyBudgetCents)}` : "—"} />
        <Stat label="Plans to review" value={counts ? String(counts.plansToReview) : "—"} tone={counts?.plansToReview ? "warning" : undefined} />
      </div>

      {!readOnly ? <GoalBox orgId={orgId} onPlanned={({ planId }) => router.push(`/org/${orgId}/canvas?plan=${planId}`)} /> : null}

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="grid gap-4">
        <TabsList className="flex w-full max-w-3xl gap-1">
          <TabsTrigger value="live" className="flex-1 text-xs">Live</TabsTrigger>
          <TabsTrigger value="approvals" className="flex-1 gap-1.5 text-xs">
            Approvals
            {counts && counts.approvals + counts.questions > 0 ? <Badge variant="warning">{counts.approvals + counts.questions}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="briefings" className="flex-1 text-xs">Briefings</TabsTrigger>
          <TabsTrigger value="health" className="flex-1 text-xs">Health</TabsTrigger>
          {isManager ? <TabsTrigger value="automations" className="flex-1 text-xs">Automations</TabsTrigger> : null}
          {isManager ? <TabsTrigger value="security" className="flex-1 text-xs">Security</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="live" className="mt-0">
          {overview ? <LiveView orgId={orgId} overview={overview} onChanged={refresh} /> : <p className="text-sm text-[var(--foreground-50)]">Loading…</p>}
        </TabsContent>
        <TabsContent value="approvals" className="mt-0">
          <ApprovalsInbox orgId={orgId} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="briefings" className="mt-0">
          <BriefingsView orgId={orgId} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="health" className="mt-0">
          {tab === "health" ? <HealthView orgId={orgId} onChanged={refresh} /> : null}
        </TabsContent>
        {isManager ? (
          <TabsContent value="automations" className="mt-0">
            {tab === "automations" ? <AutomationsView orgId={orgId} /> : null}
          </TabsContent>
        ) : null}
        {isManager ? (
          <TabsContent value="security" className="mt-0">
            {tab === "security" ? <SecurityView orgId={orgId} /> : null}
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
