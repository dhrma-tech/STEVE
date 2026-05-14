"use client";

import { ArrowLeft, ExternalLink, Play } from "lucide-react";
import { DepartmentCover } from "@/components/departments/department-cover";
import { DepartmentSections } from "@/components/departments/department-sections";
import { useDepartmentDetail } from "@/components/departments/use-department-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import type { CanvasDepartment } from "@/lib/canvas/data";
import type { DepartmentDetailData } from "@/lib/departments/data";

type DepartmentDetail = NonNullable<DepartmentDetailData>;

export function DepartmentDetailPanel({
  orgId,
  department,
  onBack,
  onOpenBoard,
  onLaunchAgent
}: {
  orgId: string;
  department: CanvasDepartment;
  onBack: () => void;
  onOpenBoard: (department: CanvasDepartment) => void;
  onLaunchAgent: (department: DepartmentDetail) => void;
}) {
  const state = useDepartmentDetail(orgId, department.slug);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to dashboard
      </Button>

      <div className="mt-4 grid gap-4">
        {state.status === "loading" ? (
          <>
            <DepartmentCover
              slug={department.slug}
              name={department.name}
              color={department.color}
              availability={department.availability}
              badge={department.spotlightBadge}
            />
            <LoadingState rows={5} label={`Loading ${department.name}`} />
          </>
        ) : null}

        {state.status === "error" ? (
          <ErrorState title="Department did not load" description={state.error} retry={{ onClick: state.reload }} />
        ) : null}

        {state.status === "ready" ? (
          <>
            <DepartmentCover
              slug={state.detail.slug}
              name={state.detail.name}
              color={state.detail.color}
              availability={state.detail.availability}
              badge={state.detail.spotlightBadge}
            />
            <section className="grid gap-4 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">Department detail</p>
                  <h2 className="mt-1 text-2xl font-medium tracking-[0px]">{state.detail.name}</h2>
                  <p className="mt-3 font-mono text-xs leading-6 text-[var(--foreground-50)]">{state.detail.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={state.detail.availability === "active" ? "success" : "warning"}>{state.detail.statusLabel}</Badge>
                  <Badge variant="neutral">{state.detail.defaultAgentName}</Badge>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Metric label="Agents" value={state.detail.agents.length} />
                <Metric label="Tasks" value={state.detail.taskCount} />
                <Metric label="Roadmap" value={state.detail.roadmapCount} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="app" size="sm" disabled={state.detail.availability !== "active"} onClick={() => onLaunchAgent(state.detail)}>
                  <Play aria-hidden="true" className="size-4" />
                  {state.detail.visual.launchPrompt}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onOpenBoard(department)} className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]">
                  <ExternalLink aria-hidden="true" className="size-4" />
                  Open board
                </Button>
              </div>
            </section>
            <DepartmentSections department={state.detail} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-3">
      <p className="text-2xl leading-none">{value}</p>
      <p className="mt-2 text-xs text-[var(--foreground-50)]">{label}</p>
    </div>
  );
}
