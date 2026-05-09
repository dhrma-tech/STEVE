"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils/cn";

export const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value = 0, ...props }, ref) => (
  <ProgressPrimitive.Root ref={ref} className={cn("relative h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.1)]", className)} value={value} {...props}>
    <ProgressPrimitive.Indicator
      className="size-full flex-1 bg-[var(--brand-500)] transition-transform"
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));

Progress.displayName = ProgressPrimitive.Root.displayName;

export interface ProgressFieldProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  label: string;
  valueLabel?: string;
}

export function ProgressField({ label, valueLabel, className, ...props }: ProgressFieldProps) {
  return (
    <div className={cn("grid gap-2 text-sm text-[var(--app-text)]", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{label}</span>
        {valueLabel ? <span className="font-mono text-xs text-[var(--app-text-50)]">{valueLabel}</span> : null}
      </div>
      <Progress {...props} />
    </div>
  );
}

