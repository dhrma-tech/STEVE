"use client";

import { Badge } from "@/components/ui/badge";
import type { CanvasDepartment } from "@/lib/canvas/data";

export function WorkspacePreviewCard({
  department,
  className,
  onSelect
}: {
  department: CanvasDepartment;
  className?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`pointer-events-auto hidden w-[210px] rounded-[12px] border border-[var(--border-10)] bg-[var(--background-l0-80)] p-3 text-left text-[var(--foreground-80)] shadow-[var(--shadow-dept-agent-node-dark)] backdrop-blur transition-colors hover:bg-[var(--background-l0-85)] focus-visible:ring-2 focus-visible:ring-[var(--focused)] lg:grid ${className ?? ""}`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{department.name}</h3>
        <Badge variant={department.availability === "active" ? "success" : "warning"}>{department.agents.length}</Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--foreground-50)]">{department.description}</p>
      <div className="mt-3 flex gap-2 text-[11px] text-[var(--foreground-50)]">
        <span>{department.roadmapCount} roadmap</span>
        <span>{department.fileCount} files</span>
      </div>
    </button>
  );
}
