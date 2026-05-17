"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function OptionCard({
  selected,
  title,
  description,
  recommended,
  onClick
}: {
  selected: boolean;
  title: string;
  description?: string;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "grid gap-2 rounded-[12px] border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focused)]",
        selected ? "border-[var(--tt-brand-color-500)] bg-[rgba(98,41,255,0.08)]" : "border-[var(--border-10)] bg-[var(--background-l0)] hover:bg-white"
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-medium tracking-[0px]">{title}</span>
        {recommended ? <span className="rounded-full bg-[var(--tt-brand-color-500)] px-2 py-1 text-[10px] uppercase text-white">Recommended</span> : null}
      </span>
      {description ? <span className="text-sm leading-6 text-[var(--foreground-50)]">{description}</span> : null}
    </button>
  );
}

