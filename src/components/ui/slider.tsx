"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils/cn";

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root ref={ref} className={cn("relative flex h-6 w-full touch-none select-none items-center", className)} {...props}>
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-[var(--foreground-10)]">
      <SliderPrimitive.Range className="absolute h-full bg-[var(--tt-brand-color-500)]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block size-5 rounded-full border-[0.8px] border-[var(--border-10)] bg-white shadow-[rgba(0,0,0,0.14)_0_2px_8px] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[var(--focused)] disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));

Slider.displayName = SliderPrimitive.Root.displayName;

export interface SliderFieldProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  label: string;
  valueLabel?: string;
  description?: string;
}

export function SliderField({ label, valueLabel, description, className, ...props }: SliderFieldProps) {
  return (
    <label className={cn("grid gap-2 text-sm text-[var(--foreground-80)]", className)}>
      <span className="flex items-center justify-between gap-3">
        <span className="font-medium">{label}</span>
        {valueLabel ? <span className="font-mono text-xs text-[var(--foreground-50)]">{valueLabel}</span> : null}
      </span>
      <Slider {...props} />
      {description ? <span className="text-xs leading-5 text-[var(--foreground-40)]">{description}</span> : null}
    </label>
  );
}

