"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type IconButtonVariant = "light" | "app" | "ghost" | "danger";
type IconButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<IconButtonVariant, string> = {
  light:
    "border-[0.8px] border-[rgba(32,32,32,0.1)] bg-[var(--color-surface)] text-[var(--foreground)] shadow-[rgba(0,0,0,0.06)_0_2px_3px,rgba(255,255,255,0.35)_0_0_0.357px_1.5px_inset,#fff_0_2px_0_inset] hover:bg-[var(--color-surface-raised)]",
  app: "border-[0.8px] border-[var(--app-border)] bg-[rgba(255,255,255,0.06)] text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.1)]",
  ghost: "border-[0.8px] border-transparent bg-transparent text-current hover:bg-[rgba(255,255,255,0.08)]",
  danger: "border-[0.8px] border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.1)] text-red-100 hover:bg-[rgba(239,68,68,0.18)]"
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
              "inline-flex shrink-0 items-center justify-center rounded-[8px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand-300)] disabled:pointer-events-none disabled:opacity-50",
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

