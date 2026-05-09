import * as React from "react";

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-6 text-[var(--foreground)]">
      <div className="grid w-full max-w-[240px] gap-6 text-center">
        <div className="mx-auto flex gap-1.5">
           <div className="size-2 animate-bounce rounded-full bg-[var(--color-ink-faint)] [animation-delay:-0.3s]" />
           <div className="size-2 animate-bounce rounded-full bg-[var(--color-ink-faint)] [animation-delay:-0.15s]" />
           <div className="size-2 animate-bounce rounded-full bg-[var(--color-ink-faint)]" />
        </div>
        <div className="space-y-3">
           <div className="mx-auto h-2 w-32 animate-pulse rounded-full bg-[var(--color-border-card)]" />
           <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-border-card)]/30">
              <div className="h-full w-1/3 animate-[shimmer_2s_infinite_linear] rounded-full bg-[var(--color-ink-faint)]" style={{ backgroundSize: '200% 100%' }} />
           </div>
        </div>
      </div>
    </main>
  );
}

