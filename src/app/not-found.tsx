"use client";

import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-[var(--foreground)]">
      <motion.section 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="grid w-full max-w-lg gap-6 rounded-[24px] border border-[var(--color-border-card)] bg-[var(--color-surface-raised)] p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.08)]"
      >
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-[var(--color-ink-faint)]">Error 404</p>
          <h1 className="mt-4 text-[32px] font-normal leading-tight tracking-tight">We couldn&apos;t find that page.</h1>
          <p className="mx-auto mt-4 max-w-[34ch] text-[15px] leading-7 text-[var(--color-ink-muted)]">
            The link may have moved or never existed. Head back home or jump into the docs to find what you need.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Link href="/" className={buttonClassName({ variant: "dark", className: "w-full sm:w-auto" })}>
            Return home
          </Link>
          <Link href="/docs" className={buttonClassName({ variant: "ghost", className: "w-full sm:w-auto" })}>
            Read the docs
          </Link>
        </div>
      </motion.section>
    </main>
  );
}

