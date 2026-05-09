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
      className={`pointer-events-auto hidden w-[210px] rounded-[12px] border border-[var(--app-border)] bg-[rgba(29,29,34,0.78)] p-3 text-left text-[var(--app-text)] shadow-[rgba(0,0,0,0.28)_0_16px_40px] backdrop-blur transition-colors hover:bg-[rgba(37,37,43,0.92)] focus-visible:ring-2 focus-visible:ring-[var(--brand-300)] lg:grid ${className ?? ""}`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{department.name}</h3>
        <Badge variant={department.availability === "active" ? "success" : "warning"}>{department.agents.length}</Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--app-text-50)]">{department.description}</p>
      <div className="mt-3 flex gap-2 text-[11px] text-[var(--app-text-50)]">
        <span>{department.roadmapCount} roadmap</span>
        <span>{department.fileCount} files</span>
      </div>
    </button>
  );
}
