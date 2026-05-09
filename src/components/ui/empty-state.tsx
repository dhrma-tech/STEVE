import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
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
    <div
      className={cn(
        "grid place-items-center gap-3 rounded-[14px] border-[0.8px] p-6 text-center",
        surface === "dark" ? "border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] text-[var(--app-text)]" : "border-[var(--color-border-card)] bg-[var(--color-surface-raised)] text-[var(--foreground)]",
        className
      )}
      {...props}
    >
      {icon ? <div className="grid size-10 place-items-center rounded-[8px] bg-current/8 text-current">{icon}</div> : null}
      <div className="grid gap-1">
        <h3 className="text-base font-medium tracking-[0px]">{title}</h3>
        {description ? <p className="max-w-[42ch] text-sm leading-6 text-current/60">{description}</p> : null}
      </div>
      {action ? (
        <Button variant={surface === "dark" ? "app" : "dark"} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

