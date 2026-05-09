"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Application Root Error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-[var(--foreground)]">
      <motion.section 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="grid w-full max-w-lg gap-6 rounded-[24px] border border-[rgba(239,68,68,0.2)] bg-[var(--color-surface-raised)] p-10 text-center shadow-[0_32px_120px_rgba(239,68,68,0.06)]"
      >
        <div className="mx-auto grid size-14 place-items-center rounded-[16px] bg-[rgba(239,68,68,0.08)] text-[var(--danger)]">
          <AlertCircle aria-hidden="true" className="size-7" />
        </div>

        <div>
           <p className="font-mono text-xs font-medium uppercase tracking-widest text-[var(--danger)]">System Alert</p>
           <h1 className="mt-3 text-[28px] font-normal leading-tight tracking-tight">Something needs another pass.</h1>
           <p className="mx-auto mt-3 max-w-[36ch] text-[15px] leading-7 text-[var(--color-ink-muted)]">
             {error.message || "An unexpected system error occurred while rendering this page."}
           </p>
        </div>
        
        <div className="flex flex-col items-center gap-3">
          <Button variant="dark" onClick={reset} className="w-full sm:w-auto">
            Try again
          </Button>
          <Button variant="ghost" onClick={() => window.location.href = "/"} className="w-full sm:w-auto">
             Return to homepage
          </Button>
        </div>
      </motion.section>
    </main>
  );
}

