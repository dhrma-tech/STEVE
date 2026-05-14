"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cn } from "@/lib/utils/cn";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-6 w-11 rounded-full border-[0.8px] border-[var(--border-10)] bg-[var(--foreground-8)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focused)] data-[state=checked]:bg-[var(--success-30)]",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[21px]" />
  </SwitchPrimitive.Root>
));

Switch.displayName = SwitchPrimitive.Root.displayName;

export interface ToggleFieldProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label: string;
  description?: string;
}

export function ToggleField({ label, description, className, ...props }: ToggleFieldProps) {
  return (
    <label className={cn("flex items-start justify-between gap-4 rounded-[8px] border-[0.8px] border-[var(--border-10)] bg-[var(--foreground-3)] p-3 text-[var(--foreground-80)]", className)}>
      <span className="grid gap-1">
        <span className="text-sm font-medium">{label}</span>
        {description ? <span className="text-xs leading-5 text-[var(--foreground-50)]">{description}</span> : null}
      </span>
      <Switch {...props} />
    </label>
  );
}

export const ToggleButton = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>
>(({ className, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-[8px] border-[0.8px] border-[var(--border-10)] bg-[var(--foreground-3)] px-3 text-sm text-[var(--foreground-80)] outline-none transition-colors hover:bg-[var(--foreground-8)] focus-visible:ring-2 focus-visible:ring-[var(--focused)] data-[state=on]:bg-[var(--primary)] data-[state=on]:text-[var(--primary-foreground)]",
      className
    )}
    {...props}
  />
));

ToggleButton.displayName = TogglePrimitive.Root.displayName;

