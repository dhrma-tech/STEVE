"use client";

import * as React from "react";
import { Building2, FolderOpen, Gauge, GitBranch, Kanban, MessageSquare, RefreshCw, Send, Sparkles } from "lucide-react";
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
                <GitBranch className="size-3.5" />
                <span className="hidden sm:inline">Co</span>
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
            <TabsContent value="home" className="mt-0 flex h-full flex-col gap-4 overflow-y-auto animate-tab-content-fade">
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
              <section className="grid gap-2 pb-2">
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
                      aria-label={item.status === "locked" ? `${item.title} — locked until previous stage completes` : `Create task: ${item.title}`}
                      title={item.status === "locked" ? "Complete previous roadmap items to unlock" : undefined}
                      className="rounded-[10px] outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--focused)] disabled:opacity-55 disabled:cursor-not-allowed"
                      onClick={() => createFromSuggested(item)}
                    >
                      <MiniRow title={item.title} detail={`${item.stage} - ${item.workType}`} status={item.status} />
                    </button>
                  ))
                ) : (
                  <EmptyState surface="dark" title="No suggested tasks" description="Roadmap suggestions will appear after more items unlock." />
                )}
              </section>
            </TabsContent>

            <TabsContent value="cofounder" className="mt-0 h-full animate-tab-content-fade">
              <ChatWorkspace orgId={data.organization.id} initialKind="cofounder" compact />
            </TabsContent>

            <TabsContent value="company" className="mt-0 grid h-full gap-4 overflow-y-auto animate-tab-content-fade">
              <AgentControlCenter
                orgId={data.organization.id}
                initialAgentId={selectedAgentId}
                orgName={data.organization.name}
                compact
                onLaunchSession={onLaunchTaskSession}
              />
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

function greeting(company: string) {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${company}`;
  if (hour < 18) return `Good afternoon, ${company}`;
  return `Good evening, ${company}`;
}
