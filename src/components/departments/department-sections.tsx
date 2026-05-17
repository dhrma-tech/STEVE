"use client";

import { Cpu, Files, ListChecks, MessageSquareText } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DepartmentContextTabs } from "@/components/departments/department-context-tabs";
import type { DepartmentDetailData } from "@/lib/departments/data";

type DepartmentDetail = NonNullable<DepartmentDetailData>;

export function DepartmentSections({ department }: { department: DepartmentDetail }) {
  return (
    <Accordion type="multiple" defaultValue={["agents", "tasks", "files", "context"]} className="grid gap-2">
      <DepartmentAccordionItem value="agents" icon={<Cpu aria-hidden="true" className="size-4" />} title="Agents" count={department.agents.length}>
        {department.agents.length ? (
          <div className="grid gap-2">
            {department.agents.map((agent) => (
              <MiniRecord key={agent.id} title={agent.name} detail={agent.isDefault ? "Default department agent" : agent.description ?? "Custom agent"} status={agent.status} />
            ))}
          </div>
        ) : (
          <EmptyState surface="dark" title="No agents yet" description="Launch this department to create a default agent." />
        )}
      </DepartmentAccordionItem>

      <DepartmentAccordionItem value="tasks" icon={<ListChecks aria-hidden="true" className="size-4" />} title="Tasks" count={department.taskCount}>
        {department.tasks.length ? (
          <div className="grid gap-2">
            {department.tasks.map((task) => (
              <MiniRecord key={task.id} title={task.title} detail={task.roadmapItem?.title ?? task.type} status={task.status} />
            ))}
          </div>
        ) : (
          <EmptyState surface="dark" title="No tasks yet" description="Tasks created for this department will appear here." />
        )}
      </DepartmentAccordionItem>

      <DepartmentAccordionItem value="files" icon={<Files aria-hidden="true" className="size-4" />} title="Files" count={department.fileCount}>
        {department.files.length ? (
          <div className="grid gap-2">
            {department.files.map((file) => (
              <MiniRecord key={file.id} title={file.name} detail={`${file.folder?.name ?? "Workspace"} - ${formatBytes(file.sizeBytes)}`} status={file.visibility} />
            ))}
          </div>
        ) : (
          <EmptyState surface="dark" title="No files yet" description="Files added to this department will appear here." />
        )}
      </DepartmentAccordionItem>

      <DepartmentAccordionItem value="context" icon={<MessageSquareText aria-hidden="true" className="size-4" />} title="Details" count={Object.keys(department.context).length}>
        <DepartmentContextTabs slug={department.slug} context={department.context} />
      </DepartmentAccordionItem>
    </Accordion>
  );
}

function DepartmentAccordionItem({
  value,
  icon,
  title,
  count,
  children
}: {
  value: string;
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="overflow-hidden rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)]">
      <AccordionTrigger className="min-h-[54px] px-3 py-3 text-[var(--foreground-80)] hover:text-white">
        <span className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-[var(--foreground-8)] text-[var(--foreground-80)]">{icon}</span>
          <span className="truncate">{title}</span>
          <Badge variant="neutral">{count}</Badge>
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-3 pb-3 text-[var(--foreground-50)]">{children}</AccordionContent>
    </AccordionItem>
  );
}

function MiniRecord({ title, detail, status }: { title: string; detail: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-3">
      <div className="min-w-0">
        <h4 className="truncate text-sm font-medium text-[var(--foreground-80)]">{title}</h4>
        <p className="mt-1 truncate text-xs text-[var(--foreground-50)]">{detail}</p>
      </div>
      <Badge variant={statusVariant(status)}>{status.replace("_", " ")}</Badge>
    </div>
  );
}

function statusVariant(status: string): BadgeVariant {
  if (["complete", "completed", "active", "idle", "organization"].includes(status)) return "success";
  if (["running", "available"].includes(status)) return "running";
  if (["locked", "archived"].includes(status)) return "neutral";
  if (["blocked", "canceled"].includes(status)) return "danger";
  return "warning";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
