"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils/cn";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("inline-flex rounded-[8px] border-[0.8px] border-[var(--border-10)] bg-[var(--foreground-5)] p-1", className)}
    {...props}
  />
));

TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "rounded-[6px] px-3 py-2 text-sm text-[var(--foreground-50)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focused)] disabled:pointer-events-none disabled:opacity-45 data-[state=active]:bg-[var(--primary)] data-[state=active]:text-[var(--primary-foreground)]",
      className
    )}
    {...props}
  />
));

TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]", className)} {...props} />
));

TabsContent.displayName = TabsPrimitive.Content.displayName;

