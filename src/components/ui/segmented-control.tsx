"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils/cn";

export type SegmentedControlItem = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export interface SegmentedControlProps extends Omit<React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>, "children"> {
  items: readonly SegmentedControlItem[];
  surface?: "light" | "dark";
  itemClassName?: string;
}

export function SegmentedControl({ items, className, itemClassName, surface = "light", ...props }: SegmentedControlProps) {
  return (
    <TabsPrimitive.Root className={className} {...props}>
      <TabsPrimitive.List
        className={cn(
          "flex w-full overflow-x-auto rounded-[8px] border-[0.8px] p-1 scrollbar-none",
          surface === "dark"
            ? "border-[var(--border-10)] bg-[var(--foreground-5)]"
            : "border-[rgba(38,35,35,0.04)] bg-[rgba(231,231,227,0.4)]"
        )}
      >
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              "min-h-8 flex-1 rounded-[6px] px-3 py-[7px] text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focused)] disabled:pointer-events-none disabled:opacity-45",
              surface === "dark"
                ? "text-[var(--foreground-50)] data-[state=active]:bg-[var(--primary)] data-[state=active]:text-[var(--primary-foreground)]"
                : "text-[var(--color-ink-muted)] data-[state=active]:bg-[var(--color-surface)] data-[state=active]:text-[var(--color-ink-strongest)]",
              itemClassName
            )}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}

