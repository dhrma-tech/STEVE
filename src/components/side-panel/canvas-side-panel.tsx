"use client";

import * as React from "react";
import { Building2, MessageSquare, RefreshCw } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
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
  onLaunchTaskSession
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
    <aside className="flex min-h-[520px] w-full shrink-0 flex-col border-t border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-text)] lg:min-h-0 lg:w-[390px] lg:border-l lg:border-t-0 xl:w-[430px]">
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
          <div className="border-b border-[var(--app-border)] p-3">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="home" className="px-2 text-xs">Home</TabsTrigger>
              <TabsTrigger value="cofounder" className="px-2 text-xs">AI</TabsTrigger>
              <TabsTrigger value="company" className="px-2 text-xs">Co</TabsTrigger>
              <TabsTrigger value="tasks" className="px-2 text-xs">Tasks</TabsTrigger>
              <TabsTrigger value="library" className="px-2 text-xs">Files</TabsTrigger>
            </TabsList>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <TabsContent value="home" className="mt-0 grid gap-4">
              <PanelHeading eyebrow="Home" title={greeting(data.organization.name)} icon={<MessageSquare aria-hidden="true" className="size-4" />} />
              <section className="grid gap-3 rounded-[12px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">Roadmap progress</h3>
                    <p className="mt-1 text-xs text-[var(--app-text-50)]">{data.roadmap.complete} of {data.roadmap.total} items complete</p>
                  </div>
                  <Badge variant="brand">{data.roadmap.progress}%</Badge>
                </div>
                <Progress value={data.roadmap.progress} />
                <Button variant="app" size="sm" onClick={onOpenRoadmap}>Open roadmap</Button>
              </section>
              <section className="grid gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Suggested next</h3>
                  <Button variant="ghost" size="sm">
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Refresh
                  </Button>
                </div>
                {data.suggestedTasks.length ? (
                  data.suggestedTasks.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={item.status === "locked"}
                      className="rounded-[10px] outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--brand-300)] disabled:opacity-55"
                      onClick={() => createFromSuggested(item)}
                    >
                      <MiniRow title={item.title} detail={`${item.stage} - ${item.workType}`} status={item.status} />
                    </button>
                  ))
                ) : (
                  <EmptyState surface="dark" title="No suggested tasks" description="Roadmap suggestions will appear after more items unlock." />
                )}
              </section>
              <Textarea surface="dark" label="Ask Cofounder" placeholder="What should we do next?" />
            </TabsContent>

            <TabsContent value="cofounder" className="mt-0 grid gap-4">
              <ChatWorkspace orgId={data.organization.id} initialKind="cofounder" compact />
            </TabsContent>

            <TabsContent value="company" className="mt-0 grid gap-4">
              <PanelHeading eyebrow="Company" title={data.organization.name} icon={<Building2 aria-hidden="true" className="size-4" />} />
              <StackStatus label="Domain" status="sandbox" />
              <StackStatus label="Email" status="sandbox" />
              <StackStatus label="Payment" status="trial" />
              <StackStatus label="Hosting" status="managed" />
              <AgentControlCenter
                orgId={data.organization.id}
                initialAgentId={selectedAgentId}
                compact
                onLaunchSession={onLaunchTaskSession}
              />
            </TabsContent>

            <TabsContent value="tasks" className="mt-0 grid gap-4">
              <TaskWorkspace
                orgId={data.organization.id}
                initialTaskId={selectedTaskId}
                compact
                onLaunchSession={onLaunchTaskSession}
              />
            </TabsContent>

            <TabsContent value="library" className="mt-0 grid gap-4">
              <FileLibrary orgId={data.organization.id} compact />
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
      <span className="grid size-9 place-items-center rounded-[9px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.06)] text-[var(--app-primary-light)]">{icon}</span>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--app-text-50)]">{eyebrow}</p>
        <h2 className="text-lg font-medium tracking-[0px]">{title}</h2>
      </div>
    </div>
  );
}

function MiniRow({ title, detail, status }: { title: string; detail: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium">{title}</h3>
        <p className="mt-1 truncate text-xs text-[var(--app-text-50)]">{detail}</p>
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

function greeting(company: string) {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${company}`;
  if (hour < 18) return `Good afternoon, ${company}`;
  return `Good evening, ${company}`;
}
