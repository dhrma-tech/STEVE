"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";

export function DepartmentNode({ data, selected }: NodeProps) {
  const nodeData = data as {
    name: string;
    description: string;
    color: string;
    availability: string;
    agents: number;
    tasks: number;
  };

  return (
    <div
      className="grid w-[190px] gap-3 rounded-[14px] border bg-[rgba(37,37,43,0.92)] p-3 text-[var(--app-text)] shadow-[rgba(0,0,0,0.28)_0_16px_50px] backdrop-blur transition-transform"
      style={{
        borderColor: selected ? nodeData.color : "rgba(255,255,255,0.12)",
        boxShadow: selected ? `0 0 0 1px ${nodeData.color}, rgba(0,0,0,0.28) 0 16px 50px` : undefined
      }}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px]" style={{ background: `${nodeData.color}22`, color: nodeData.color }}>
          {nodeData.name.slice(0, 1)}
        </span>
        <Badge variant={nodeData.availability === "active" ? "success" : "warning"}>{nodeData.availability.replace("_", " ")}</Badge>
      </div>
      <div>
        <h3 className="font-medium tracking-[0px]">{nodeData.name}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--app-text-50)]">{nodeData.description}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-[var(--app-text-50)]">
        <span>{nodeData.agents} agents</span>
        <span>{nodeData.tasks} tasks</span>
      </div>
    </div>
  );
}
