import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { getDepartmentVisual } from "@/data/departments";
import { cn } from "@/lib/utils/cn";

type DepartmentCoverProps = {
  slug: string;
  name: string;
  color: string;
  availability: string;
  badge?: string | null;
  compact?: boolean;
  className?: string;
};

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return function next() {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function DepartmentCover({ slug, name, color, availability, badge, compact = false, className }: DepartmentCoverProps) {
  const visual = getDepartmentVisual(slug);
  const style = {
    background: visual.cover.background,
    "--department-grid": visual.cover.gridColor,
    "--department-accent": color || visual.cover.accent
  } as React.CSSProperties;

  const rand = lcg(hashCode(slug));
  const particles = Array.from({ length: 15 }, (_, id) => ({
    id,
    x: rand() * 88 + 4,
    y: rand() * 76 + 8,
    startX: +((rand() * 8 - 4).toFixed(1)),
    startY: +((rand() * 6 - 3).toFixed(1)),
    dimOpacity: +((rand() * 0.2 + 0.1).toFixed(2)),
    brightOpacity: +((rand() * 0.3 + 0.5).toFixed(2)),
    delay: +((rand() * 5).toFixed(2)),
  }));

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[12px] border border-[var(--border-10)] text-[var(--foreground-80)] shadow-[var(--tt-shadow-elevated-md)]",
        compact ? "min-h-[116px]" : "min-h-[172px]",
        className
      )}
      style={style}
    >
      <div
        aria-hidden="true"
        className="animate-pixel-wave absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(var(--department-grid) 1px, transparent 1px), linear-gradient(90deg, var(--department-grid) 1px, transparent 1px)",
          backgroundSize: "22px 22px"
        }}
      />
      <div aria-hidden="true" className="absolute -right-8 -top-10 size-32 rounded-full bg-[var(--department-accent)] opacity-20 blur-2xl" />
      <div aria-hidden="true" className="absolute bottom-4 right-5 font-mono text-[52px] font-semibold leading-none text-white/14">
        {visual.cover.motif}
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((p) => (
          <div
            key={p.id}
            className="animate-pixel-drift absolute size-[2px] rounded-sm bg-white"
            style={{
              left: `${p.x.toFixed(1)}%`,
              top: `${p.y.toFixed(1)}%`,
              animationDelay: `${p.delay}s`,
              "--department-pixel-start-x": `${p.startX}px`,
              "--department-pixel-start-y": `${p.startY}px`,
              "--department-pixel-dim-opacity": String(p.dimOpacity),
              "--department-pixel-bright-opacity": String(p.brightOpacity),
            } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="relative flex h-full min-h-[inherit] flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/62">Department cover</p>
            <h2 className={cn("font-medium tracking-[0px]", compact ? "text-xl" : "text-3xl")}>{name}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {badge ? <Badge variant="brand">{badge}</Badge> : null}
            <Badge variant={availability === "active" ? "success" : "warning"}>{availability.replace("_", " ")}</Badge>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="h-1.5 w-24 rounded-full bg-[var(--department-accent)] shadow-[0_0_24px_var(--department-accent)]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/50">{visual.coverAsset}</span>
        </div>
      </div>
    </div>
  );
}
