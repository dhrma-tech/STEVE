"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function CofounderNode({ data }: NodeProps) {
  const nodeData = data as { label: string; subtitle: string; progress: number };

  return (
    <div className="relative animate-node-breath">
      <Handle type="source" position={Position.Top} className="opacity-0" />
      <Handle type="target" position={Position.Bottom} className="opacity-0" />

      {/* Outer pulse ring */}
      <div
        className="absolute -inset-3 rounded-[24px] border border-[var(--tt-brand-color-500)] opacity-20"
        style={{ animation: "cofounder-ring 3s ease-in-out infinite" }}
      />
      <div
        className="absolute -inset-1.5 rounded-[22px] border border-[var(--tt-brand-color-500)] opacity-10"
        style={{ animation: "cofounder-ring 3s ease-in-out infinite 0.5s" }}
      />

      {/* Card */}
      <div className="relative grid min-w-[220px] gap-3.5 rounded-[20px] border border-[var(--border-20)] bg-[var(--background-l0)] p-5 text-center text-[var(--foreground-80)] shadow-[0_4px_24px_rgba(0,0,0,0.12)] backdrop-blur">
        {/* Icon */}
        <div className="mx-auto flex size-14 items-center justify-center rounded-[16px] bg-[var(--foreground)] text-[var(--background)] shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="6" cy="6" r="2.5" fill="currentColor" opacity="0.9" />
            <circle cx="12" cy="6" r="2.5" fill="currentColor" opacity="0.9" />
            <circle cx="18" cy="6" r="2.5" fill="currentColor" opacity="0.9" />
            <circle cx="6" cy="12" r="2.5" fill="currentColor" opacity="0.9" />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            <circle cx="18" cy="12" r="2.5" fill="currentColor" opacity="0.9" />
            <circle cx="6" cy="18" r="2.5" fill="currentColor" opacity="0.9" />
            <circle cx="12" cy="18" r="2.5" fill="currentColor" opacity="0.9" />
            <circle cx="18" cy="18" r="2.5" fill="currentColor" opacity="0.9" />
          </svg>
        </div>

        {/* Text */}
        <div>
          <h2 className="text-base font-semibold tracking-[-0.2px] text-[var(--foreground)]">{nodeData.label}</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--foreground-50)]">{nodeData.subtitle}</p>
        </div>

        {/* Progress bar */}
        <div className="overflow-hidden rounded-full bg-[var(--foreground-8)] h-1">
          <div
            className="h-full rounded-full bg-[var(--tt-brand-color-500)] transition-all duration-700"
            style={{ width: `${nodeData.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
