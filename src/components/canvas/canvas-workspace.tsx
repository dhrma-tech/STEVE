"use client";

import * as React from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type Viewport
} from "@xyflow/react";
import { GripVertical, Maximize2, Workflow } from "lucide-react";
import { Rnd } from "react-rnd";
import { CofounderNode } from "@/components/canvas/cofounder-node";
import { DepartmentNode } from "@/components/canvas/department-node";
import { QueryShells } from "@/components/canvas/query-shells";
import { WorkspacePreviewCard } from "@/components/canvas/workspace-preview-card";
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
  const [panelFloating, setPanelFloating] = React.useState(false);
  const [panelBounds, setPanelBounds] = React.useState({ x: 0, y: 0, width: 420, height: 0 });
  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("canvasPanelBounds") : null;
    if (saved) {
      try { setPanelBounds(JSON.parse(saved) as typeof panelBounds); } catch { /* ignore */ }
    } else {
      setPanelBounds({ x: Math.max(0, window.innerWidth - 440), y: 68, width: 420, height: window.innerHeight - 68 });
    }
  }, []);
  const selectedDepartment = React.useMemo(() => departmentForNodeId(data.departments, selectedNodeId), [data.departments, selectedNodeId]);
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkspaceNode>(React.useMemo(() => buildNodes(data, selectedNodeId), [data, selectedNodeId]));
  const [edges, , onEdgesChange] = useEdgesState(React.useMemo(() => buildEdges(data), [data]));

  React.useEffect(() => {
    if (!initialRoadmapOpen) return;
    queueMicrotask(() => setRoadmapVisible(true));
  }, [initialRoadmapOpen]);

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
  }, []);

  const onNodeDoubleClick = React.useCallback<NodeMouseHandler>((_event, node) => {
    const department = node.type === "department" ? departmentForNodeId(data.departments, node.id) : null;
    if (department) setBoardDepartment(department);
  }, [data.departments]);

  const selectDepartment = React.useCallback((department: CanvasDepartment) => {
    setSelectedNodeId(`department:${department.slug}`);
  }, []);

  const launchDepartmentAgent = React.useCallback(async (department?: { id: string; name: string; defaultAgent: { id: string } | null; visual: { launchPrompt: string; setupPrompt: string } }) => {
    if (!department) {
      return;
    }

    try {
      const response = await fetch(`/api/orgs/${data.organization.id}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `${department.name}: ${department.visual.launchPrompt}`,
          description: department.visual.setupPrompt,
          departmentId: department.id,
          agentId: department.defaultAgent?.id ?? null,
          type: "agent_task",
          executeMode: "now",
          autoAssign: true,
          appTarget: "staging",
          source: "department_launch"
        })
      });
      const payload = await response.json() as { data?: { id: string; sessions?: Array<{ id: string }> } };
      setSessionId(payload.data?.sessions?.[0]?.id ?? payload.data?.id ?? "new");
      setSessionVisible(true);
    } catch {
      setSessionId(null);
      setSessionVisible(false);
    }
  }, [data.organization.id]);

  const launchSession = React.useCallback((nextSessionId: string) => {
    setSessionId(nextSessionId);
    setSessionVisible(true);
  }, []);

  return (
    <ReactFlowProvider>
      <main className="flex min-h-[calc(100dvh-68px)] flex-col bg-[var(--background)] text-[var(--foreground-80)] lg:flex-row">
        <section className={cn(
          "relative min-w-0 flex-1 overflow-hidden transition-all duration-300",
          selectedDepartment ? "h-[200px] lg:h-auto" : "h-[calc(100dvh-140px)] lg:h-auto"
        )}>
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
            selectionOnDrag
            className="bg-[radial-gradient(circle_at_center,var(--foreground-8),transparent_42%),var(--background)]"
          >
            {/* Section D: no grid dots on canvas — color transparent removes dots without structural change */}
            <Background color="transparent" gap={28} size={1} />
            <Controls position="bottom-right" showInteractive={false} />
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              nodeColor={(node) => (node.type === "department" ? String((node.data as DepartmentNodeData).color) : "#eeeee8")}
              maskColor="rgba(30,30,35,0.64)"
              className="!bottom-[88px] !bg-[var(--background-l0-80)]"
            />
            <Panel position="top-left" className="!m-4">
              <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--border-10)] bg-[var(--background-l0-80)] p-2 shadow-[var(--shadow-outset-100)] backdrop-blur">
                <Button variant="app" size="sm" onClick={() => setSelectedNodeId(null)}>
                  <Maximize2 aria-hidden="true" className="size-4" />
                  Overview
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("home")}>
                  <Workflow aria-hidden="true" className="size-4" />
                  Dashboard
                </Button>
              </div>
            </Panel>
          </ReactFlow>

          <div className="pointer-events-none absolute inset-0 hidden xl:block">
            {data.departments.slice(0, 4).map((department, index) => (
              <WorkspacePreviewCard
                key={department.id}
                department={department}
                onSelect={() => selectDepartment(department)}
                className={previewClass(index)}
              />
            ))}
          </div>
        </section>

        {!panelFloating ? (
          <div className={cn(
            "flex-none transition-all duration-300 lg:w-[390px] xl:w-[430px]",
            selectedDepartment ? "flex-1" : "h-0 overflow-hidden lg:h-auto lg:overflow-visible"
          )}>
            <div className="hidden items-center justify-end border-b border-[var(--border-10)] bg-[var(--background-sidepanel)] px-2 py-1 lg:flex">
              <button
                type="button"
                title="Float panel"
                onClick={() => setPanelFloating(true)}
                className="grid size-6 place-items-center rounded text-[var(--foreground-50)] hover:text-[var(--foreground-80)]"
              >
                <GripVertical aria-hidden="true" className="size-4" />
              </button>
            </div>
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
        ) : (
          <Rnd
            position={{ x: panelBounds.x, y: panelBounds.y }}
            size={{ width: panelBounds.width, height: panelBounds.height || "calc(100dvh - 68px)" }}
            onDragStop={(_e, d) => {
              const next = { ...panelBounds, x: d.x, y: d.y };
              setPanelBounds(next);
              localStorage.setItem("canvasPanelBounds", JSON.stringify(next));
            }}
            onResizeStop={(_e, _dir, ref, _delta, pos) => {
              const next = { x: pos.x, y: pos.y, width: ref.offsetWidth, height: ref.offsetHeight };
              setPanelBounds(next);
              localStorage.setItem("canvasPanelBounds", JSON.stringify(next));
            }}
            minWidth={300}
            minHeight={300}
            maxWidth="90vw"
            bounds="window"
            dragHandleClassName="panel-drag-handle"
            style={{ zIndex: 2000 }}
          >
            <div className="flex h-full flex-col overflow-hidden rounded-[12px] border border-[var(--border-10)] bg-[var(--background-sidepanel)] shadow-[var(--tt-shadow-elevated-md)]">
              <div className="panel-drag-handle flex cursor-move items-center justify-between border-b border-[var(--border-10)] px-3 py-2 hover:bg-[var(--foreground-5)]">
                <span className="flex items-center gap-2 text-xs text-[var(--foreground-50)]">
                  <GripVertical aria-hidden="true" className="size-4" />
                  Drag to move · resize from edges
                </span>
                <button
                  type="button"
                  onClick={() => setPanelFloating(false)}
                  className="text-xs text-[var(--foreground-50)] hover:text-[var(--foreground-80)]"
                >
                  Dock
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
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
          </Rnd>
        )}
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

function previewClass(index: number) {
  if (index === 0) return "absolute left-6 top-24";
  if (index === 1) return "absolute right-6 top-24";
  if (index === 2) return "absolute bottom-8 left-6";
  return "absolute bottom-8 right-6";
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
