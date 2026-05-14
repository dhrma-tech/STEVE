import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  surface?: "light" | "dark";
}

export function Skeleton({ className, surface = "dark", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "motion-safe-shimmer rounded-[8px]",
        surface === "dark"
          ? "bg-[linear-gradient(90deg,var(--foreground-5),var(--foreground-15),var(--foreground-5))]"
          : "bg-[linear-gradient(90deg,rgba(38,35,35,0.05),rgba(38,35,35,0.11),rgba(38,35,35,0.05))]",
        className
      )}
      {...props}
    />
  );
}

