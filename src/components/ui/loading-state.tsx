import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  rows?: number;
  surface?: "light" | "dark";
  label?: string;
}

export function LoadingState({ rows = 3, surface = "dark", label = "Loading", className, ...props }: LoadingStateProps) {
  return (
    <div role="status" aria-label={label} className={cn("grid gap-3 rounded-[14px] border-[0.8px] p-4", surface === "dark" ? "border-[var(--border-10)]" : "border-[var(--color-border-card)]", className)} {...props}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton
          key={index}
          surface={surface}
          className={cn("h-4", index === rows - 1 ? "w-2/3" : "w-full")}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

