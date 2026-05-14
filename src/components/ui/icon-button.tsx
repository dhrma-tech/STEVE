"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type IconButtonVariant = "light" | "app" | "ghost" | "danger";
type IconButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<IconButtonVariant, string> = {
  light:
    "border-[0.8px] border-[var(--border-10)] bg-[var(--background-l0)] text-[var(--foreground)] shadow-[var(--shadows-light-buttons-sm)] hover:brightness-[1.02]",
  app:
    "border-[0.8px] border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground)] hover:bg-[var(--foreground-10)]",
  ghost:
    "border-[0.8px] border-transparent bg-transparent text-current hover:bg-[var(--foreground-8)]",
  danger:
    "border-[0.8px] border-[var(--tt-color-text-red-contrast)] bg-[var(--tt-color-text-red-contrast)] text-[var(--destructive)] hover:bg-[var(--tt-color-text-red-contrast)]"
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "size-8 [&_svg]:size-4",
  md: "size-10 [&_svg]:size-[18px]",
  lg: "size-11 [&_svg]:size-5"
};

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: React.ReactNode;
  label: string;
  tooltip?: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, icon, label, tooltip, variant = "app", size = "md", type = "button", ...props }, ref) => (
    <TooltipProvider delayDuration={180}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            type={type}
            aria-label={label}
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-[8px] outline-none transition-colors duration-[var(--tt-transition-duration-short)] focus-visible:ring-2 focus-visible:ring-[var(--focused)] disabled:pointer-events-none disabled:opacity-50",
              variantClasses[variant],
              sizeClasses[size],
              className
            )}
            {...props}
          >
            {icon}
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltip ?? label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
);

IconButton.displayName = "IconButton";

