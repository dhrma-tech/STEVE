"use client";

import Link from "next/link";
import { GitBranch } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";

export function LoginPanel() {
  return (
    <div className="grid w-full max-w-[420px] gap-5 rounded-[16px] border border-white/20 bg-white/72 p-5 text-[var(--foreground)] shadow-[rgba(0,0,0,0.16)_0_24px_80px] backdrop-blur-[16px]">
      <div className="grid gap-2 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">Cofounder</p>
        <h1 className="text-[36px] font-normal leading-[1.1] tracking-[0px]">Run an entire company with agents.</h1>
        <p className="text-sm leading-6 text-[var(--foreground-50)]">
          Sign in with GitHub to create your workspace. We&apos;ll set up the repository, deployments, and database on your behalf.
        </p>
      </div>

      <Link href="/api/auth/github" className={buttonClassName({ variant: "dark", fullWidth: true })}>
        <GitBranch aria-hidden="true" className="size-4" />
        Continue with GitHub
      </Link>

      <div className="flex justify-center gap-4 text-xs text-[var(--foreground-50)]">
        <Link href="/privacy-policy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </div>
    </div>
  );
}
