"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

export function DepartmentNode({ data, selected }: NodeProps) {
  const nodeData = data as {
    name: string;
    description: string;
    color: string;
    availability: string;
    agents: number;
    tasks: number;
  };

  const isActive = nodeData.availability === "active";

  return (
    <div
      className={cn(
        "group relative w-[210px] overflow-hidden rounded-[16px] border bg-[var(--background-l0)] text-[var(--foreground-80)]",
        "cursor-pointer transition-all duration-200 ease-out",
        "hover:scale-[1.03] hover:shadow-[0_8px_36px_rgba(0,0,0,0.13)]",
        selected ? "scale-[1.02]" : "shadow-[0_2px_12px_rgba(0,0,0,0.07)]"
      )}
      style={{
        borderColor: selected ? nodeData.color : "rgba(0,0,0,0.08)",
        boxShadow: selected
          ? `0 0 0 1.5px ${nodeData.color}, 0 10px 40px ${nodeData.color}28`
          : undefined
      }}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />

      {/* Colored top accent strip */}
      <div className="h-[3px] w-full transition-opacity duration-200" style={{ background: nodeData.color }} />

      <div className="grid gap-3 p-3.5">
        {/* Avatar + badge */}
        <div className="flex items-start justify-between gap-2">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-[10px] text-sm font-bold transition-transform duration-200 group-hover:scale-110"
            style={{
              background: `${nodeData.color}18`,
              color: nodeData.color,
              boxShadow: `0 0 0 1px ${nodeData.color}28`
            }}
          >
            {nodeData.name.slice(0, 1)}
          </span>
          <Badge variant={isActive ? "success" : "warning"} className="mt-0.5 shrink-0 text-[10px]">
            {nodeData.availability.replace("_", " ")}
          </Badge>
        </div>

        {/* Name + description */}
        <div>
          <h3 className="text-sm font-semibold tracking-[-0.1px] text-[var(--foreground)]">
            {nodeData.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-[11px] leading-[1.55] text-[var(--foreground-50)]">
            {nodeData.description}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 border-t border-[var(--border-10)] pt-2.5 text-[11px] text-[var(--foreground-40)]">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full" style={{ background: nodeData.agents > 0 ? nodeData.color : "var(--foreground-20)" }} />
            {nodeData.agents} {nodeData.agents === 1 ? "agent" : "agents"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[var(--foreground-20)]" />
            {nodeData.tasks} {nodeData.tasks === 1 ? "task" : "tasks"}
          </span>
        </div>
      </div>

      {/* Hover color wash */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[16px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(ellipse at center, ${nodeData.color}05 0%, transparent 70%)` }}
      />
    </div>
  );
}
