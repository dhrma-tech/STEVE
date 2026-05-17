"use client";

import { Paperclip, Play, X } from "lucide-react";
import { DepartmentContextTabs } from "@/components/departments/department-context-tabs";
import { DepartmentCover } from "@/components/departments/department-cover";
import { DepartmentRoadmapStrip } from "@/components/departments/department-roadmap-strip";
import { useDepartmentDetail } from "@/components/departments/use-department-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import type { CanvasDepartment } from "@/lib/canvas/data";
import type { DepartmentDetailData } from "@/lib/departments/data";

type DepartmentDetail = NonNullable<DepartmentDetailData>;

export function DepartmentBoardDialog({
  orgId,
  department,
  onOpenChange,
  onLaunchAgent
}: {
  orgId: string;
  department: CanvasDepartment | null;
  onOpenChange: (open: boolean) => void;
  onLaunchAgent: (department: DepartmentDetail) => void;
}) {
  return (
    <Dialog open={Boolean(department)} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88dvh] max-w-[920px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-[var(--border-10)] px-5 py-4 pr-12">
          <DialogTitle>{department?.name ?? "Department"} board</DialogTitle>
          <DialogDescription>
            Setup prompt, context, attachments, and roadmap for this department.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {department ? (
            <DepartmentBoard
              orgId={orgId}
              department={department}
              onClose={() => onOpenChange(false)}
              onLaunchAgent={(detail) => {
                onLaunchAgent(detail);
                onOpenChange(false);
              }}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DepartmentBoard({
  orgId,
  department,
  onClose,
  onLaunchAgent
}: {
  orgId: string;
  department: CanvasDepartment;
  onClose: () => void;
  onLaunchAgent: (department: DepartmentDetail) => void;
}) {
  const state = useDepartmentDetail(orgId, department.slug);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingState rows={6} label={`Loading ${department.name} board`} />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState title="Board did not load" description={state.error} retry={{ onClick: state.reload }} />;
  }

  const detail = state.detail;

  return (
    <div className="grid gap-4">
      <DepartmentCover
        slug={detail.slug}
        name={detail.name}
        color={detail.color}
        availability={detail.availability}
        badge={detail.spotlightBadge}
        compact
      />

      <section className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">Setup prompt</p>
            <h3 className="mt-1 text-lg font-medium">Prepare {detail.name}</h3>
          </div>
          <Badge variant={detail.availability === "active" ? "success" : "warning"}>{detail.availabilityLabel}</Badge>
        </div>
        <p className="font-mono text-sm leading-7 text-[var(--foreground-50)]">{detail.visual.setupPrompt}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="app" disabled={detail.availability !== "active"} onClick={() => onLaunchAgent(detail)}>
            <Play aria-hidden="true" className="size-4" />
            {detail.visual.launchPrompt}
          </Button>
          <Button variant="ghost" onClick={onClose} className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]">
            <X aria-hidden="true" className="size-4" />
            Close
          </Button>
        </div>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-medium">Context tabs</h3>
        <DepartmentContextTabs slug={detail.slug} context={detail.context} />
      </section>

      <section className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Attachments</h3>
          <Badge variant="neutral">{detail.files.length} files</Badge>
        </div>
        {detail.files.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {detail.files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-[var(--foreground-8)] text-[var(--foreground-80)]">
                  <Paperclip aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-medium">{file.name}</h4>
                  <p className="mt-1 truncate text-xs text-[var(--foreground-50)]">{file.folder?.name ?? "Workspace"}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            surface="dark"
            icon={<Paperclip aria-hidden="true" className="size-4" />}
            title="No attachments"
            description="Department files, generated references, and founder uploads will appear here when attached."
          />
        )}
      </section>

      <DepartmentRoadmapStrip items={detail.roadmapItems} />
    </div>
  );
}
