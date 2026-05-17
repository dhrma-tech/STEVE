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

  return (
    <div
      className={cn(
        "grid w-[190px] gap-3 rounded-[14px] border bg-[var(--background-l0-85)] p-3 text-[var(--foreground-80)] shadow-[var(--shadow-dept-agent-node-dark)] backdrop-blur transition-[border-color,box-shadow,transform] duration-200 hover:scale-[1.02] hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)]",
        selected && "animate-node-select-pop"
      )}
      style={{
        borderColor: selected ? nodeData.color : "var(--border-10)",
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
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--foreground-50)]">{nodeData.description}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-[var(--foreground-50)]">
        <span>{nodeData.agents} agents</span>
        <span>{nodeData.tasks} tasks</span>
      </div>
    </div>
  );
}
