import * as React from "react";
import { LoadingState } from "@/components/ui/loading-state";

/**
 * Route-level loading skeleton for the authenticated app shell.
 * Provides a consistent bridge during page transitions within /org/[orgId].
 */
export default function OrgLoading() {
  return (
    <div className="flex min-h-[calc(100dvh-68px)] flex-col bg-[var(--app-canvas)] lg:flex-row">
      {/* Simulation of the Canvas / Left area */}
      <div className="flex-1 p-6">
        <LoadingState rows={8} label="Initializing workspace" className="h-full border-none bg-transparent" />
      </div>

      {/* Simulation of the Side Panel */}
      <aside className="w-full border-t border-[var(--app-border)] bg-[var(--app-panel)] lg:w-[390px] lg:border-l lg:border-t-0 xl:w-[430px]">
        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-center gap-3">
             <div className="size-9 animate-pulse rounded-[9px] bg-[rgba(255,255,255,0.06)]" />
             <div className="space-y-2">
                <div className="h-2 w-16 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
                <div className="h-4 w-32 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
             </div>
          </div>
          <LoadingState rows={4} label="Loading panel content" className="border-none bg-transparent p-0" />
          <LoadingState rows={6} label="Loading tasks" className="border-none bg-transparent p-0" />
        </div>
      </aside>
    </div>
  );
}
