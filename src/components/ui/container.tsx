import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function MarketingContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[1100px] px-6", className)} {...props} />;
}

export function MarketingNavContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto flex w-full max-w-[1440px] items-center px-5", className)} {...props} />;
}

export function AppViewport({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <main className={cn("min-h-dvh bg-[var(--app-canvas)] text-[var(--app-text)]", className)} {...props} />;
}

export function AppSplit({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid min-h-dvh grid-cols-1 bg-[var(--app-canvas)] text-[var(--app-text)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,456px)]",
        className
      )}
      {...props}
    />
  );
}

