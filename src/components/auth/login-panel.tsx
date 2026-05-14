"use client";

import * as React from "react";
import Link from "next/link";
import { GitBranch, Loader2 } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";

export function LoginPanel({ previewModeEnabled = true }: { previewModeEnabled?: boolean }) {
  const [displayName, setDisplayName] = React.useState("Founder");
  const [email, setEmail] = React.useState("founder@example.com");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function sandboxLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/sandbox-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName, email })
    });
    const payload = (await response.json()) as { data?: { nextRoute?: string }; error?: { message: string } };

    if (!response.ok) {
      setError(payload.error?.message ?? "We couldn't start your session. Please try again.");
      setLoading(false);
      return;
    }

    window.location.href = payload.data?.nextRoute ?? "/onboarding";
  }

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

      {previewModeEnabled ? (
        <form className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--background)] p-3" onSubmit={sandboxLogin}>
          <div className="grid gap-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">Preview mode</p>
            <p className="text-xs leading-5 text-[var(--foreground-50)]">Try the product without GitHub. Your workspace runs on managed infrastructure you can graduate at any time.</p>
          </div>
          <Input label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Button type="submit" variant="light" disabled={loading}>
            {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            Continue as guest founder
          </Button>
        </form>
      ) : null}

      {error ? <ErrorState surface="light" title="Login failed" description={error} /> : null}

      <div className="flex justify-center gap-4 text-xs text-[var(--foreground-50)]">
        <Link href="/privacy-policy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </div>
    </div>
  );
}
