"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot } from "lucide-react";

export function CofounderNode({ data }: NodeProps) {
  const nodeData = data as { label: string; subtitle: string; progress: number };

  return (
    <div className="grid min-w-[210px] gap-3 rounded-[18px] border border-[rgba(238,238,232,0.34)] bg-[rgba(14,14,17,0.88)] p-4 text-center text-[var(--app-text)] shadow-[rgba(0,0,0,0.4)_0_24px_80px] backdrop-blur">
      <Handle type="source" position={Position.Top} className="opacity-0" />
      <Handle type="target" position={Position.Bottom} className="opacity-0" />
      <div className="mx-auto grid size-12 place-items-center rounded-[14px] border border-[var(--app-border)] bg-[var(--app-primary-light)] text-[var(--app-black-base)]">
        <Bot aria-hidden="true" className="size-5" />
      </div>
      <div>
        <h2 className="text-lg font-medium tracking-[0px]">{nodeData.label}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--app-text-50)]">{nodeData.subtitle}</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.1)]">
        <span className="block h-full rounded-full bg-[var(--app-primary-light)]" style={{ width: `${nodeData.progress}%` }} />
      </div>
    </div>
  );
}
