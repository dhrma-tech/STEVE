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
import { CofounderNode } from "@/components/canvas/cofounder-node";
import { DepartmentAgentPopup } from "@/components/canvas/department-agent-popup";
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
  const [ollamaStatus, setOllamaStatus] = React.useState<"checking" | "up" | "down">("checking");
  const prevOllamaStatus = React.useRef<"checking" | "up" | "down">("checking");

  React.useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/health/ollama");
        setOllamaStatus(res.ok ? "up" : "down");
      } catch {
        setOllamaStatus("down");
      }
    }
    void check();
    const id = setInterval(() => void check(), 30000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    prevOllamaStatus.current = ollamaStatus;
  }, [ollamaStatus]);

  const [agentPopup, setAgentPopup] = React.useState<{
    departmentId: string;
    departmentName: string;
    departmentColor: string;
    x: number;
    y: number;
  } | null>(null);
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

  const onNodeClick = React.useCallback<NodeMouseHandler>((event, node) => {
    if (node.type !== "department") return;
    setSelectedNodeId(node.id);
    const dept = departmentForNodeId(data.departments, node.id);
    if (dept) {
      const canvasRect = (event.target as HTMLElement).closest("section")?.getBoundingClientRect();
      const relX = event.clientX - (canvasRect?.left ?? 0);
      const relY = event.clientY - (canvasRect?.top ?? 0);
      setAgentPopup({
        departmentId: dept.id,
        departmentName: dept.name,
        departmentColor: dept.color,
        x: relX,
        y: relY
      });
    }
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

          {/* Agent popup — appears near clicked node */}
          {agentPopup ? (
            <DepartmentAgentPopup
              orgId={data.organization.id}
              departmentId={agentPopup.departmentId}
              departmentName={agentPopup.departmentName}
              departmentColor={agentPopup.departmentColor}
              screenX={agentPopup.x}
              screenY={agentPopup.y}
              onClose={() => setAgentPopup(null)}
              onLaunch={(sid) => { setSessionId(sid); setSessionVisible(true); setAgentPopup(null); }}
              onCreateAgent={() => { setActiveTab("company"); setAgentPopup(null); }}
            />
          ) : null}

          {/* Ollama status indicator — bottom-right */}
          <div
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-[var(--border-10)] bg-[var(--background-sidepanel)] px-2.5 py-1 text-[11px] text-[var(--foreground-50)]"
            style={{ zIndex: Z_CANVAS_CHROME }}
            title={
              ollamaStatus === "up" ? "Mistral (local) — Running. Agents are available." :
              ollamaStatus === "down" ? "Ollama offline — Agents will fail. Start Ollama in WSL2." :
              "Checking Ollama status…"
            }
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                ollamaStatus === "up" ? "bg-green-400" :
                ollamaStatus === "down" ? "animate-pulse bg-red-400" :
                "animate-pulse bg-[var(--foreground-30)]"
              )}
            />
            Mistral
          </div>

          {/* Canvas controls — bottom-left */}
          <CanvasControls
            departments={data.departments}
            onOverview={() => setSelectedNodeId(null)}
            onDashboard={() => { setSelectedNodeId(null); setActiveTab("home"); }}
            onSelectDepartment={selectDepartment}
          />
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
    <div className="absolute bottom-0 left-3 z-10 pb-1">
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
