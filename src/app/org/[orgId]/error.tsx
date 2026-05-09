"use client";

import * as React from "react";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";

/**
 * Org-level error boundary.
 * Handles crashes within the authenticated workspace shell.
 */
export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log to error reporting service if available
    console.error("Org Workspace Error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[calc(100dvh-68px)] items-center justify-center bg-[var(--app-canvas)] p-6">
      <div className="w-full max-w-md">
        <ErrorState
          title="Workspace encounter an error"
          description={error.message ?? "We couldn't load your company workspace. This might be a temporary connection issue."}
          retry={{
            label: "Try reloading",
            onClick: () => reset(),
          }}
        />
        <div className="mt-6 flex justify-center">
           <Button variant="ghost" size="sm" onClick={() => window.location.href = "/"}>
              Return to homepage
           </Button>
        </div>
      </div>
    </main>
  );
}
