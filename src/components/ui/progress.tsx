"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils/cn";

export const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { "aria-label"?: string }
>(({ className, value = 0, "aria-label": ariaLabel, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-[var(--foreground-10)]", className)}
    value={value}
    aria-label={ariaLabel ?? "Progress"}
    aria-valuenow={value ?? 0}
    aria-valuemin={0}
    aria-valuemax={100}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="size-full flex-1 bg-[var(--tt-brand-color-500)] transition-transform"
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
    <div className={cn("grid gap-2 text-sm text-[var(--foreground-80)]", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{label}</span>
        {valueLabel ? <span className="font-mono text-xs text-[var(--foreground-50)]">{valueLabel}</span> : null}
      </div>
      <Progress aria-label={label} {...props} />
    </div>
  );
}
