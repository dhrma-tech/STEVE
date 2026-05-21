"use client";

import * as React from "react";
import {
  Background,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type Viewport
} from "@xyflow/react";
import { Building2, Maximize2, Workflow, X } from "lucide-react";
import { Z_CANVAS_CHROME } from "@/lib/z-index";
import { CanvasFileDetail } from "@/components/files/canvas-file-detail";
import { CofounderNode } from "@/components/canvas/cofounder-node";
import { TaskCreateDialog } from "@/components/tasks/task-create-dialog";
import { Badge } from "@/components/ui/badge";
import { DepartmentNode } from "@/components/canvas/department-node";
import { InteractiveBackground } from "@/components/canvas/interactive-background";
import { QueryShells } from "@/components/canvas/query-shells";
import { DepartmentBoardDialog } from "@/components/departments/department-board";
import { CanvasSidePanel } from "@/components/side-panel/canvas-side-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { CanvasData, CanvasDepartment } from "@/lib/canvas/data";

type CanvasWorkspaceProps = {
  data: CanvasData;
  query: Record<string, string | string[] | undefined>;
};

type CofounderNodeData = {
  label: string;
  subtitle: string;
  progress: number;
};

type DepartmentNodeData = {
  slug: string;
  name: string;
  description: string;
  color: string;
  availability: string;
  agents: number;
  tasks: number;
};

type WorkspaceNode = Node<CofounderNodeData | DepartmentNodeData>;

const nodeTypes = {
  cofounder: CofounderNode,
  department: DepartmentNode
};

export function CanvasWorkspace({ data, query }: CanvasWorkspaceProps) {
  const querySelectedNodeId = selectedNodeFromQuery(query);
  const queryTab = initialTabFromQuery(query);
  const initialTaskId = firstParam(query.task);
  const initialAgentId = firstParam(query.agent);
  const initialSelectedId = querySelectedNodeId ?? (queryTab || initialTaskId || initialAgentId ? null : data.viewState.selectedNodeId ?? null);
  const initialTab = queryTab ?? (initialTaskId ? "tasks" : initialAgentId ? "company" : data.viewState.activeTab ?? "home");
  const initialRoadmapOpen = firstParam(query.open_tech_tree) === "1";
  const initialSessionId = firstParam(query.session);
  const [viewport, setViewport] = React.useState<Viewport>(data.viewState.viewport);
  const [activeTab, setActiveTab] = React.useState(initialTab);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(initialSelectedId);
  const [boardDepartment, setBoardDepartment] = React.useState<CanvasDepartment | null>(null);
  const [roadmapVisible, setRoadmapVisible] = React.useState(initialRoadmapOpen);
  const [sessionVisible, setSessionVisible] = React.useState(Boolean(initialSessionId));
  const [sessionId, setSessionId] = React.useState(initialSessionId);
  const [libraryFileId, setLibraryFileId] = React.useState<string | null>(null);
  const [expandedDept, setExpandedDept] = React.useState<CanvasDepartment | null>(null);
  const [taskCreateDept, setTaskCreateDept] = React.useState<CanvasDepartment | null>(null);

  const selectedDepartment = React.useMemo(() => departmentForNodeId(data.departments, selectedNodeId), [data.departments, selectedNodeId]);
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkspaceNode>(React.useMemo(() => buildNodes(data, selectedNodeId), [data, selectedNodeId]));
  const [edges, , onEdgesChange] = useEdgesState(React.useMemo(() => buildEdges(data), [data]));

  React.useEffect(() => {
    if (!initialRoadmapOpen) return;
    queueMicrotask(() => setRoadmapVisible(true));
  }, [initialRoadmapOpen]);

  // Allow AppShell map button to open roadmap even when modal was already closed
  React.useEffect(() => {
    const handler = () => setRoadmapVisible(true);
    window.addEventListener("open-roadmap", handler);
    return () => window.removeEventListener("open-roadmap", handler);
  }, []);

  React.useEffect(() => {
    if (!initialSessionId) return;
    queueMicrotask(() => {
      setSessionId(initialSessionId);
      setSessionVisible(true);
    });
  }, [initialSessionId]);

  React.useEffect(() => {
    setNodes(buildNodes(data, selectedNodeId));
  }, [data, selectedNodeId, setNodes]);

  React.useEffect(() => {
    void persistViewState({
      orgId: data.organization.id,
      viewport,
      selectedNodeId,
      activeTab
    });
  }, [activeTab, data.organization.id, selectedNodeId, viewport]);

  const onNodeClick = React.useCallback<NodeMouseHandler>((_event, node) => {
    if (node.type !== "department") return;
    setSelectedNodeId(node.id);
    const dept = departmentForNodeId(data.departments, node.id);
    if (dept) setExpandedDept(dept);
  }, [data.departments]);

  const onNodeDoubleClick = React.useCallback<NodeMouseHandler>((_event, node) => {
    const department = node.type === "department" ? departmentForNodeId(data.departments, node.id) : null;
    if (department) setBoardDepartment(department);
  }, [data.departments]);

  const selectDepartment = React.useCallback((department: CanvasDepartment) => {
    setSelectedNodeId(`department:${department.slug}`);
  }, []);

  const launchDepartmentAgent = React.useCallback(async (department?: { id: string; name: string; defaultAgent: { id: string } | null; visual?: { launchPrompt?: string; setupPrompt?: string } }) => {
    if (!department) return;

    const agentId = department.defaultAgent?.id ?? null;

    // If no default agent for this department, can't launch
    if (!agentId) return;

    try {
      // Use agents launch API directly — reliable path that always creates + returns a session
      const response = await fetch(`/api/orgs/${data.organization.id}/agents/${agentId}/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: null })
      });
      const payload = await response.json() as { data?: { kind: string; session: { id: string } } };
      const sid = payload.data?.session?.id ?? null;
      if (sid) {
        setSessionId(sid);
        setSessionVisible(true);
      }
    } catch {
      // silently ignore
    }
  }, [data.organization.id]);

  const launchSession = React.useCallback((nextSessionId: string) => {
    setSessionId(nextSessionId);
    setSessionVisible(true);
  }, []);

  return (
    <ReactFlowProvider>
      <main className="flex h-full flex-col bg-[var(--background)] text-[var(--foreground-80)] lg:flex-row">
        <section className={cn(
          "relative min-w-0 flex-1 overflow-hidden transition-all duration-300 bg-[var(--background)]",
          selectedDepartment ? "h-[200px] lg:h-full" : "h-[calc(100dvh-72px)] lg:h-full"
        )}>
          <InteractiveBackground />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            defaultViewport={data.viewState.viewport}
            minZoom={0.35}
            maxZoom={1.7}
            fitView
            fitViewOptions={{ padding: 0.22 }}
            onMoveEnd={(_event, nextViewport) => setViewport(nextViewport)}
            panOnScroll
            panOnScrollSpeed={1.8}
            zoomOnScroll={false}
            zoomOnPinch
            zoomOnDoubleClick={false}
            selectionOnDrag
            className="bg-transparent"
          >
            <Background color="transparent" gap={28} size={1} />
          </ReactFlow>

          {/* Department expand panel — centered modal on card click */}
          {expandedDept ? (
            <DepartmentExpandPanel
              department={expandedDept}
              activeTasks={data.activeTasks.filter((t) => t.department?.id === expandedDept.id)}
              onClose={() => setExpandedDept(null)}
              onOpenBoard={() => { setBoardDepartment(expandedDept); setExpandedDept(null); }}
              onCreateTask={() => {
                const dept = expandedDept;
                setExpandedDept(null);
                setTaskCreateDept(dept);
              }}
              onLaunchAgent={() => {
                const dept = expandedDept;
                if (!dept) return;
                const defaultAgent = dept.agents.find((a) => a.isDefault) ?? dept.agents[0] ?? null;
                setExpandedDept(null);
                launchDepartmentAgent({ id: dept.id, name: dept.name, defaultAgent });
              }}
            />
          ) : null}

          {/* Ollama status indicator — bottom-right */}

          {/* Canvas controls — bottom-left */}
          <CanvasControls
            departments={data.departments}
            onOverview={() => setSelectedNodeId(null)}
            onDashboard={() => { setSelectedNodeId(null); setActiveTab("home"); }}
            onSelectDepartment={selectDepartment}
          />

          {/* File detail overlay — covers canvas when a file is opened from the Library panel */}
          {libraryFileId ? (
            <div className="absolute inset-0 z-30 overflow-hidden">
              <CanvasFileDetail
                orgId={data.organization.id}
                fileId={libraryFileId}
                onClose={() => setLibraryFileId(null)}
              />
            </div>
          ) : null}
        </section>

        <div className="flex-none lg:h-full lg:w-[390px] xl:w-[430px]">
          <div className="flex h-full flex-col overflow-hidden rounded-[12px] border border-[var(--border-10)] bg-[var(--background-sidepanel)] shadow-[var(--tt-shadow-elevated-md)]">
            <CanvasSidePanel
              data={data}
              selectedDepartment={selectedDepartment}
              activeTab={activeTab}
              onActiveTabChange={setActiveTab}
              onOpenRoadmap={() => setRoadmapVisible(true)}
              onClearDepartment={() => setSelectedNodeId(null)}
              onOpenDepartmentBoard={setBoardDepartment}
              onLaunchDepartmentAgent={launchDepartmentAgent}
              selectedTaskId={initialTaskId}
              selectedAgentId={initialAgentId}
              onLaunchTaskSession={launchSession}
              onFileOpen={setLibraryFileId}
            />
          </div>
        </div>
      </main>
      <QueryShells
        data={data}
        roadmapVisible={roadmapVisible}
        onRoadmapVisibleChange={setRoadmapVisible}
        sessionVisible={sessionVisible}
        onSessionVisibleChange={setSessionVisible}
        sessionId={sessionId}
        onSessionLaunch={launchSession}
      />
      <DepartmentBoardDialog
        orgId={data.organization.id}
        department={boardDepartment}
        onOpenChange={(open) => !open && setBoardDepartment(null)}
        onLaunchAgent={launchDepartmentAgent}
      />
      <TaskCreateDialog
        orgId={data.organization.id}
        open={taskCreateDept !== null}
        onOpenChange={(open) => { if (!open) setTaskCreateDept(null); }}
        defaults={taskCreateDept ? { departmentId: taskCreateDept.id, source: "canvas" } : null}
        onCreated={() => { setTaskCreateDept(null); setActiveTab("tasks"); }}
      />
    </ReactFlowProvider>
  );
}

function buildNodes(data: CanvasData, selectedNodeId: string | null): WorkspaceNode[] {
  const radius = 380;
  const center = { x: 0, y: 0 };
  const departments = data.departments.map((department, index): WorkspaceNode => {
    const angle = (Math.PI * 2 * index) / data.departments.length - Math.PI / 2;
    return {
      id: `department:${department.slug}`,
      type: "department",
      selected: selectedNodeId === `department:${department.slug}`,
      position: {
        x: center.x + Math.cos(angle) * radius - 95,
        y: center.y + Math.sin(angle) * radius - 68
      },
      data: {
        slug: department.slug,
        name: department.name,
        description: department.description,
        color: department.color,
        availability: department.availability,
        agents: department.agents.length,
        tasks: department.taskCount
      }
    };
  });

  return [
    {
      id: "cofounder",
      type: "cofounder",
      position: { x: center.x - 105, y: center.y - 80 },
      data: {
        label: "Cofounder",
        subtitle: data.organization.description ?? "Company operating center",
        progress: data.roadmap.progress
      }
    },
    ...departments
  ];
}

function buildEdges(data: CanvasData): Edge[] {
  const baseEdges = data.departments.map((department) => ({
    id: `orbit:${department.slug}`,
    source: "cofounder",
    target: `department:${department.slug}`,
    type: "smoothstep",
    /* Section D orbital edges: dashed, animated stroke-dashoffset (canvasDashFlow per Section L).
       markerEnd.color is an SVG attribute — CSS var() cannot resolve there; keep as literal.
       style.stroke IS a CSS style property — var() resolves correctly. */
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "rgba(255,255,255,0.3)" },
    style: {
      stroke: "var(--border-20)",
      strokeWidth: 1.2,
      strokeDasharray: "8 10",
      animation: "canvasDashFlow 20s linear infinite"
    }
  }));

  const activeEdges = data.departments
    .filter((department) => department.availability === "active")
    .slice(0, 4)
    .map((department) => ({
      id: `active:${department.slug}`,
      source: "cofounder",
      target: `department:${department.slug}`,
      type: "smoothstep",
      animated: true,
      label: "agent",
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: department.color },
      style: {
        stroke: department.color,
        strokeWidth: 1.7
      },
      labelStyle: {
        fill: "#f9f9f9",
        fontSize: 11
      },
      labelBgStyle: {
        fill: "var(--background-l0-80)"
      }
    }));

  return [...baseEdges, ...activeEdges];
}

function departmentForNodeId(departments: CanvasDepartment[], nodeId: string | null) {
  if (!nodeId?.startsWith("department:")) return null;
  const slug = nodeId.replace("department:", "");
  return departments.find((department) => department.slug === slug) ?? null;
}

async function persistViewState({
  orgId,
  viewport,
  selectedNodeId,
  activeTab
}: {
  orgId: string;
  viewport: Viewport;
  selectedNodeId: string | null;
  activeTab: string;
}) {
  await fetch(`/api/orgs/${orgId}/canvas/view-state`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ viewport, selectedNodeId, activeTab })
  }).catch(() => null);
}

function CanvasControls({
  departments,
  onOverview,
  onDashboard,
  onSelectDepartment
}: {
  departments: CanvasDepartment[];
  onOverview: () => void;
  onDashboard: () => void;
  onSelectDepartment: (dept: CanvasDepartment) => void;
}) {
  const [showDepts, setShowDepts] = React.useState(false);
  const { fitView } = useReactFlow();

  return (
    <div className="absolute bottom-6 left-3 z-10">
      {/* Departments popover */}
      {showDepts && (
        <>
          <div className="fixed inset-0" onClick={() => setShowDepts(false)} />
          <div className="absolute bottom-12 left-0 z-20 w-[240px] overflow-hidden rounded-[12px] border border-[var(--border-10)] bg-[var(--background-l0-85)] shadow-[var(--tt-shadow-elevated-md)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-[var(--border-10)] px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">Departments</p>
              <button type="button" onClick={() => setShowDepts(false)} className="text-[var(--foreground-50)] hover:text-[var(--foreground-80)]">
                <X className="size-3.5" />
              </button>
            </div>
            <div className="p-1.5">
              {departments.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-[var(--foreground-50)]">No departments yet. Complete onboarding to activate them.</p>
              ) : null}
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => { onSelectDepartment(dept); setShowDepts(false); }}
                  className="flex w-full items-center justify-between gap-3 rounded-[8px] px-3 py-2 text-left hover:bg-[var(--foreground-8)]"
                >
                  <span className="text-sm font-medium text-[var(--foreground-80)]">{dept.name}</span>
                  <span className={`text-[10px] font-medium ${dept.availability === "active" ? "text-[var(--success-100)]" : "text-[var(--foreground-50)]"}`}>
                    {dept.availability === "active" ? "active" : "soon"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-1">
        {[
          { icon: <Maximize2 className="size-3.5" />, label: "Overview", onClick: () => { onOverview(); fitView({ padding: 0.22, duration: 400 }); } },
          { icon: <Workflow className="size-3.5" />, label: "Dashboard", onClick: onDashboard },
          { icon: <Building2 className="size-3.5" />, label: "Departments", onClick: () => setShowDepts(!showDepts) }
        ].map(({ icon, label, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="flex items-center gap-1.5 rounded-[8px] border border-[var(--border-10)] bg-[var(--background-l0-80)] px-2 py-1 text-[11px] font-medium text-[var(--foreground-70)] backdrop-blur transition-colors hover:bg-[var(--foreground-10)] hover:text-[var(--foreground-80)]"
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function selectedNodeFromQuery(query: Record<string, string | string[] | undefined>) {
  const department = firstParam(query.department);
  return department ? `department:${department}` : null;
}

function initialTabFromQuery(query: Record<string, string | string[] | undefined>) {
  const tab = firstParam(query.tab);
  return tab && ["home", "cofounder", "company", "tasks", "library"].includes(tab) ? tab : null;
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// ── Department Expand Panel ───────────────────────────────────────────────────

import type { CanvasTask } from "@/lib/canvas/data";

function DepartmentExpandPanel({
  department,
  activeTasks,
  onClose,
  onOpenBoard,
  onCreateTask,
  onLaunchAgent
}: {
  department: CanvasDepartment;
  activeTasks: CanvasTask[];
  onClose: () => void;
  onOpenBoard: () => void;
  onCreateTask: () => void;
  onLaunchAgent: () => void;
}) {
  const isActive = department.availability === "active";

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.18)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="animate-dept-expand-in w-[420px] max-h-[80vh] overflow-y-auto rounded-[20px] border border-[var(--border-10)] bg-[var(--background-l0)] shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color header strip */}
        <div className="h-[4px] rounded-t-[20px]" style={{ background: department.color }} />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className="grid size-12 shrink-0 place-items-center rounded-[12px] text-xl font-bold"
                style={{ background: `${department.color}18`, color: department.color, boxShadow: `0 0 0 1.5px ${department.color}30` }}
              >
                {department.name.slice(0, 1)}
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.2px] text-[var(--foreground)]">{department.name}</h2>
                <Badge variant={isActive ? "success" : "warning"} className="mt-1 text-[10px]">
                  {department.availability.replace("_", " ")}
                </Badge>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 shrink-0 place-items-center rounded-[8px] border border-[var(--border-10)] text-[var(--foreground-40)] transition-colors hover:bg-[var(--foreground-5)] hover:text-[var(--foreground-80)]"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>

          {/* Description */}
          <p className="mt-4 text-sm leading-6 text-[var(--foreground-60)]">{department.description}</p>

          {/* Agents */}
          {department.agents.length > 0 ? (
            <section className="mt-5">
              <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--foreground-40)]">
                Agents · {department.agents.length}
              </p>
              <div className="grid gap-1.5">
                {department.agents.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`size-2 rounded-full ${agent.status === "active" ? "bg-green-400" : agent.status === "idle" ? "bg-[var(--foreground-30)]" : "bg-[var(--foreground-20)]"}`}
                      />
                      <span className="text-sm font-medium text-[var(--foreground-80)]">{agent.name}</span>
                      {agent.isDefault ? (
                        <span className="rounded-full bg-[var(--foreground-8)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--foreground-40)]">default</span>
                      ) : null}
                    </div>
                    <span className="text-[11px] capitalize text-[var(--foreground-40)]">{agent.status}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Active tasks */}
          {activeTasks.length > 0 ? (
            <section className="mt-5">
              <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--foreground-40)]">
                Active tasks · {activeTasks.length}
              </p>
              <div className="grid gap-1.5">
                {activeTasks.slice(0, 4).map((task) => (
                  <div key={task.id} className="flex items-center justify-between rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] px-3 py-2.5">
                    <span className="truncate text-sm text-[var(--foreground-80)]">{task.title}</span>
                    <Badge variant={task.status === "running" ? "running" : "neutral"} className="ml-3 shrink-0 text-[10px]">
                      {task.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Action buttons */}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenBoard}
              className="flex items-center gap-1.5 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-5)] px-3.5 py-2 text-sm font-medium text-[var(--foreground-80)] transition-colors hover:bg-[var(--foreground-10)]"
            >
              Open board
            </button>
            <button
              type="button"
              onClick={onCreateTask}
              className="flex items-center gap-1.5 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-5)] px-3.5 py-2 text-sm font-medium text-[var(--foreground-80)] transition-colors hover:bg-[var(--foreground-10)]"
            >
              Create task
            </button>
            {isActive && department.agents.some((a) => a.isDefault) ? (
              <button
                type="button"
                onClick={onLaunchAgent}
                className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-sm font-medium transition-colors"
                style={{ background: `${department.color}18`, color: department.color, border: `1px solid ${department.color}30` }}
              >
                Launch agent
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
