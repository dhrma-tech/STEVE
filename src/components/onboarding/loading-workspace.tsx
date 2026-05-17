"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const STEPS = [
  { label: "Brand kit saved",        ms: 800 },
  { label: "Activating departments", ms: 1000 },
  { label: "Setting up Engineering", ms: 900 },
  { label: "Canvas ready",           ms: 700 }
];

const STEP_DELAYS = STEPS.reduce<number[]>((acc, s, i) => {
  acc.push((acc[i - 1] ?? 0) + s.ms);
  return acc;
}, []);

const MIN_ANIM_MS = (STEP_DELAYS.at(-1) ?? 3400) + 600; // ~4600 ms

export function LoadingWorkspace({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [done, setDone] = React.useState(0);

  React.useEffect(() => {
    const dest = `/org/${orgId}/canvas?department=engineering&tab=company`;

    // Tick each step label on schedule
    const timers = STEP_DELAYS.map((delay, i) =>
      setTimeout(() => setDone(i + 1), delay)
    );

    // Activate departments (errors are silently ignored)
    const activate = fetch(`/api/orgs/${orgId}/activate-departments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    }).catch(() => null);

    // Must show animation for at least MIN_ANIM_MS
    const minWait = new Promise<void>((r) => setTimeout(r, MIN_ANIM_MS));

    // Hard cap: navigate after 8 s regardless of API state
    const hardCap = new Promise<void>((r) => setTimeout(r, 8000));

    void Promise.race([
      Promise.all([activate, minWait]),
      hardCap
    ]).then(() => {
      window.location.href = dest;
    });

    return () => timers.forEach(clearTimeout);
  }, [orgId]);

  const progress = Math.round((done / STEPS.length) * 100);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-[var(--background)]">

      {/* Ambient glow rings */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="animate-loading-pulse absolute size-[520px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(98,41,255,0.10) 0%, transparent 70%)" }} />
        <div className="animate-loading-pulse absolute size-[320px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(98,41,255,0.16) 0%, transparent 65%)", animationDelay: "0.4s" }} />
        <div className="animate-loading-pulse absolute size-[140px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(98,41,255,0.26) 0%, transparent 60%)", animationDelay: "0.8s" }} />
      </div>

      {/* Orbiting ring */}
      <div aria-hidden="true" className="pointer-events-none absolute flex items-center justify-center">
        <div className="animate-loading-orbit relative size-[200px] rounded-full border border-[var(--foreground-5)]">
          <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--tt-brand-color-500)] shadow-[0_0_12px_4px_rgba(98,41,255,0.6)]" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center">

        <h1
          className="animate-fade-rise mb-10 text-5xl font-normal leading-tight tracking-tight text-[var(--foreground)]"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          {orgName}
        </h1>

        <div className="grid min-w-[260px] gap-3">
          {STEPS.map((step, i) => {
            const isDone    = done > i;
            const isActive  = done === i;
            const isPending = done < i;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 transition-all duration-500 animate-fade-rise",
                  isPending ? "opacity-20" : "opacity-100"
                )}
                style={{ animationDelay: `${i * 0.12}s`, animationFillMode: "both" }}
              >
                <span className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border transition-all duration-500",
                  isDone   ? "border-[var(--tt-brand-color-500)] bg-[var(--tt-brand-color-500)]"
                           : isActive ? "border-[var(--foreground-30)]"
                           : "border-[var(--foreground-10)]"
                )}>
                  {isDone   ? <Check className="size-2.5 text-white" strokeWidth={3} />
                 : isActive ? <span className="animate-loading-dot size-1.5 rounded-full bg-[var(--foreground-40)]" />
                 : null}
                </span>
                <span className={cn(
                  "text-sm transition-colors duration-500",
                  isDone ? "text-[var(--foreground-80)]" : isActive ? "text-[var(--foreground-60)]" : "text-[var(--foreground-30)]"
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-10 h-px w-[260px] overflow-hidden rounded-full bg-[var(--foreground-8)]">
          <div
            className="h-full rounded-full bg-[var(--tt-brand-color-500)] transition-all duration-700 ease-out"
            style={{ width: `${progress}%`, boxShadow: "0 0 8px 1px rgba(98,41,255,0.6)" }}
          />
        </div>

        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-30)]">
          {done < STEPS.length ? "Building your workspace" : "Opening canvas…"}
        </p>
      </div>
    </div>
  );
}
