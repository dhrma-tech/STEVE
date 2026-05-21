"use client";

import type { ReactNode } from "react";
import { BookOpen, Building2, CheckCircle2, Cpu, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OrgShellData } from "@/lib/orgs/shell";

export function SidePanelTabs({ shell }: { shell: OrgShellData }) {
  const progress = shell.counts.roadmapTotal ? Math.round((shell.counts.roadmapComplete / shell.counts.roadmapTotal) * 100) : 0;

  return (
    <aside className="hidden min-h-0 w-[360px] shrink-0 border-l border-[var(--border-10)] bg-[var(--background-sidepanel)] xl:block">
      <Tabs defaultValue="home" className="flex h-full flex-col">
        <div className="border-b border-[var(--border-10)] p-3">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="home" className="px-2 text-xs">Home</TabsTrigger>
            <TabsTrigger value="cofounder" className="px-2 text-xs">AI</TabsTrigger>
            <TabsTrigger value="company" className="px-2 text-xs">Co</TabsTrigger>
            <TabsTrigger value="tasks" className="px-2 text-xs">Tasks</TabsTrigger>
            <TabsTrigger value="library" className="px-2 text-xs">Library</TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <TabsContent value="home" className="mt-0 grid gap-4">
            <PanelHeader icon={<CheckCircle2 aria-hidden="true" className="size-4" />} title={greeting()} label="Home" />
            <section className="grid gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
              <div className="flex items-center justify-between text-sm">
                <span>Roadmap progress</span>
                <span className="text-[var(--foreground-50)]">{shell.counts.roadmapComplete}/{shell.counts.roadmapTotal}</span>
              </div>
              <Progress value={progress} />
            </section>
            <MetricGrid shell={shell} />
          </TabsContent>
          <TabsContent value="cofounder" className="mt-0 grid gap-4">
            <PanelHeader icon={<Cpu aria-hidden="true" className="size-4" />} title="Cofounder" label="Assistant" />
            <p className="text-sm leading-6 text-[var(--foreground-50)]">
              Cofounder has organization context, roadmap state, departments, files, and activation history ready for chat wiring.
            </p>
            <StatusRows rows={[["Mode", shell.user.isSandbox ? "sandbox" : "provider"], ["Agents", String(shell.counts.agents)], ["Departments", String(shell.counts.departments)]]} />
          </TabsContent>
          <TabsContent value="company" className="mt-0 grid gap-4">
            <PanelHeader icon={<Building2 aria-hidden="true" className="size-4" />} title={shell.organization.name} label="Company" />
            <StatusRows
              rows={[
                ["Workspace", shell.organization.status],
                ["Design", shell.organization.designOnboardingStatus],
                ["Plan", shell.billing?.plan ?? "trial"],
                ["Integrations", `${shell.counts.sandboxIntegrations}/${shell.counts.integrations} sandbox`]
              ]}
            />
            <div className="flex flex-wrap gap-2">
              {shell.integrations.slice(0, 8).map((integration) => (
                <Badge key={integration.id} variant={integration.mode === "sandbox" ? "warning" : "success"}>
                  {integration.provider}
                </Badge>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="tasks" className="mt-0 grid gap-4">
            <PanelHeader icon={<ListTodo aria-hidden="true" className="size-4" />} title="Tasks" label="Queue" />
            <StatusRows rows={[["Active", String(shell.counts.activeTasks)], ["Inbox", String(shell.unreadInboxCount)], ["Roadmap ready", String(Math.max(shell.counts.roadmapTotal - shell.counts.roadmapComplete, 0))]]} />
          </TabsContent>
          <TabsContent value="library" className="mt-0 grid gap-4">
            <PanelHeader icon={<BookOpen aria-hidden="true" className="size-4" />} title="Library" label="Library" />
            <StatusRows rows={[["Files", String(shell.counts.files)], ["Business plan", shell.counts.files > 0 ? "saved" : "pending"], ["Visibility", "workspace"]]} />
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  );
}

function PanelHeader({ icon, title, label }: { icon: ReactNode; title: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-[9px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)]">{icon}</span>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">{label}</p>
        <h2 className="text-lg font-medium tracking-[0px]">{title}</h2>
      </div>
    </div>
  );
}

function MetricGrid({ shell }: { shell: OrgShellData }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        ["Departments", shell.counts.departments],
        ["Agents", shell.counts.agents],
        ["Active tasks", shell.counts.activeTasks],
        ["Files", shell.counts.files]
      ].map(([label, value]) => (
        <div key={label} className="rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
          <p className="text-2xl leading-none">{value}</p>
          <p className="mt-2 text-xs text-[var(--foreground-50)]">{label}</p>
        </div>
      ))}
    </div>
  );
}

function StatusRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="grid gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 border-b border-[var(--border-10)] py-2 text-sm last:border-b-0">
          <span className="text-[var(--foreground-50)]">{label}</span>
          <span className="text-right text-[var(--foreground-80)]">{value}</span>
        </div>
      ))}
    </div>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
