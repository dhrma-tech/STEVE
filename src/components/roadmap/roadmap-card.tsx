"use client";

import { CheckCircle2, LockKeyhole, ShieldCheck, UserRound, Wand2 } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { RoadmapData } from "@/lib/roadmap/data";

type RoadmapItem = RoadmapData["stages"][number]["items"][number];

export function RoadmapCard({
  item,
  selected,
  onSelect
}: {
  item: RoadmapItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-roadmap-item-key={item.key}
      className={cn(
        "animate-sd-slide-up group relative grid min-h-[116px] w-full gap-3 rounded-[8px] border-[0.8px] bg-[var(--foreground-5)] p-3 text-left outline-none transition-[background,border-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-[var(--foreground-8)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]",
        item.status === "complete" && "border-[rgba(52,168,83,0.58)]",
        item.status === "available" && "border-[rgba(157,138,255,0.62)] shadow-[rgba(157,138,255,0.12)_0_0_0_1px]",
        item.status === "locked" && "border-[var(--border-10)] opacity-78",
        selected && "border-[var(--primary)] bg-[var(--foreground-10)] shadow-[rgba(255,255,255,0.12)_0_0_0_1px]"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("grid size-8 place-items-center rounded-[8px] border", iconClass(item.status))}>
          <CardIcon status={item.status} workType={item.workType} />
        </span>
        <Badge variant={statusVariant(item.status)}>{item.statusLabel}</Badge>
      </div>
      <div className="grid gap-1">
        <h3 className="line-clamp-2 text-sm font-medium leading-5 text-[var(--foreground-80)]">{item.title}</h3>
        <p className="line-clamp-1 text-xs text-[var(--foreground-50)]">{item.department?.name ?? item.stage?.name ?? "Company"}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Badge variant={item.status === "locked" ? "neutral" : item.workType === "approval" ? "warning" : item.workType === "user" ? "running" : "brand"}>
          {item.workTypeLabel}
        </Badge>
        {item.unlocks.length ? <span className="font-mono text-[11px] text-[var(--foreground-50)]">+{item.unlocks.length}</span> : null}
      </div>
    </button>
  );
}

function CardIcon({ status, workType }: { status: string; workType: string }) {
  if (status === "complete") return <CheckCircle2 aria-hidden="true" className="size-4" />;
  if (status === "locked") return <LockKeyhole aria-hidden="true" className="size-4" />;
  if (workType === "user") return <UserRound aria-hidden="true" className="size-4" />;
  if (workType === "approval") return <ShieldCheck aria-hidden="true" className="size-4" />;
  return <Wand2 aria-hidden="true" className="size-4" />;
}

function iconClass(status: string) {
  if (status === "complete") return "border-[rgba(52,168,83,0.45)] bg-[rgba(52,168,83,0.15)] text-[var(--tt-color-text-green-contrast)]";
  if (status === "available") return "border-[rgba(157,138,255,0.42)] bg-[rgba(157,138,255,0.15)] text-[var(--focused)]";
  return "border-[rgba(255,255,255,0.12)] bg-[var(--foreground-5)] text-[var(--foreground-50)]";
}

function statusVariant(status: string): BadgeVariant {
  if (status === "complete") return "success";
  if (status === "available") return "brand";
  return "neutral";
}
