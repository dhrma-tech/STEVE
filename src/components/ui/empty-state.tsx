"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { motion, type HTMLMotionProps } from "framer-motion";

export interface EmptyStateProps extends HTMLMotionProps<"div"> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: ButtonProps["onClick"];
  };
  surface?: "light" | "dark";
}

export function EmptyState({ icon, title, description, action, surface = "dark", className, ...props }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "grid place-items-center gap-4 rounded-[18px] border-[0.8px] p-8 text-center shadow-sm",
        surface === "dark"
          ? "border-[var(--border-10)] bg-[var(--foreground-3)] text-[var(--foreground-80)]"
          : "border-[var(--color-border-card)] bg-[var(--color-surface-raised)] text-[var(--foreground)]",
        className
      )}
      {...props}
    >
      {icon ? (
        <div className="grid size-12 place-items-center rounded-[12px] bg-current/5 text-current/80 shadow-inner">
          {icon}
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <h3 className="text-base font-medium tracking-tight">{title}</h3>
        {description ? <p className="mx-auto max-w-[38ch] text-sm leading-6 text-current/50">{description}</p> : null}
      </div>
      {action ? (
        <Button variant={surface === "dark" ? "app" : "dark"} onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      ) : null}
    </motion.div>
  );
}

