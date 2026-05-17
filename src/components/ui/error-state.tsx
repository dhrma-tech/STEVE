import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  retry?: {
    label?: string;
    onClick?: ButtonProps["onClick"];
  };
  surface?: "light" | "dark";
}

export function ErrorState({ title, description, retry, surface = "dark", className, ...props }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "grid place-items-center gap-3 rounded-[14px] border-[0.8px] p-6 text-center",
        surface === "dark"
          ? "border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] text-[var(--foreground-80)]"
          : "border-[rgba(239,68,68,0.35)] bg-[#fff6f6] text-[var(--foreground)]",
        className
      )}
      {...props}
    >
      <div className="grid size-10 place-items-center rounded-[8px] bg-[rgba(239,68,68,0.15)] text-[var(--destructive)]">
        <AlertTriangle aria-hidden="true" className="size-5" />
      </div>
      <div className="grid gap-1">
        <h3 className="text-base font-medium tracking-[0px]">{title}</h3>
        {description ? <p className="max-w-[42ch] text-sm leading-6 text-current/60">{description}</p> : null}
      </div>
      {retry ? (
        <Button variant={surface === "dark" ? "danger" : "dark"} onClick={retry.onClick}>
          {retry.label ?? "Retry"}
        </Button>
      ) : null}
    </div>
  );
}

