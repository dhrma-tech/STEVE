"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot } from "lucide-react";

export function CofounderNode({ data }: NodeProps) {
  const nodeData = data as { label: string; subtitle: string; progress: number };

  return (
    <div className="animate-node-breath grid min-w-[210px] gap-3 rounded-[18px] border border-[var(--border-30)] bg-[var(--background-l0-85)] p-4 text-center text-[var(--foreground-80)] shadow-[var(--shadow-dept-agent-node-dark)] backdrop-blur">
      <Handle type="source" position={Position.Top} className="opacity-0" />
      <Handle type="target" position={Position.Bottom} className="opacity-0" />
      <div className="mx-auto grid size-12 place-items-center rounded-[14px] border border-[var(--border-10)] bg-[var(--primary)] text-[var(--primary-foreground)]">
        <Bot aria-hidden="true" className="size-5" />
      </div>
      <div>
        <h2 className="text-lg font-medium tracking-[0px]">{nodeData.label}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--foreground-50)]">{nodeData.subtitle}</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--foreground-10)]">
        <span className="block h-full rounded-full bg-[var(--tt-brand-color-500)]" style={{ width: `${nodeData.progress}%` }} />
      </div>
    </div>
  );
}
