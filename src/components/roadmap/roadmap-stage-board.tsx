"use client";

import { AlertCircle, ArrowRight } from "lucide-react";
import { RoadmapCard } from "@/components/roadmap/roadmap-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { RoadmapData } from "@/lib/roadmap/data";

type RoadmapItem = RoadmapData["stages"][number]["items"][number];

export function RoadmapStageBoard({
  roadmap,
  selectedItemId,
  onSelectItem
}: {
  roadmap: RoadmapData;
  selectedItemId: string | null;
  onSelectItem: (item: RoadmapItem) => void;
}) {
  return (
    <div className="min-h-0 overflow-x-auto pb-4">
      <div className="flex min-w-max gap-4 pr-4">
        {roadmap.stages.map((stage) => (
          <section
            key={stage.id}
            data-roadmap-stage={stage.key}
            className="flex w-[286px] shrink-0 flex-col rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)]"
          >
            <header className="grid gap-3 border-b border-[var(--border-10)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">{stage.name}</p>
                  <h2 className="mt-1 text-base font-medium">{stage.completeCount}/{stage.itemCount || 1} complete</h2>
                </div>
                <Badge variant={stage.sourceStatus === "open_source_gap" ? "warning" : stage.progress === 100 ? "success" : "neutral"}>
                  {stage.sourceStatus === "open_source_gap" ? "source gap" : `${stage.progress}%`}
                </Badge>
              </div>
              <Progress value={stage.progress} />
              <p className="line-clamp-2 text-xs leading-5 text-[var(--foreground-50)]">{stage.description}</p>
            </header>

            <div className="relative grid gap-3 p-3">
              {stage.items.length ? (
                <>
                  <span aria-hidden="true" className="absolute bottom-7 left-6 top-7 w-px border-l border-dashed border-[rgba(255,255,255,0.16)]" />
                  {stage.items.map((item, index) => (
                    <div key={item.id} className="relative grid gap-2 pl-6">
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-9 grid size-3 place-items-center rounded-full border border-[var(--border-10)] bg-[var(--card)]"
                      >
                        {index < stage.items.length - 1 ? <span className="size-1 rounded-full bg-[var(--foreground-50)]" /> : null}
                      </span>
                      <RoadmapCard item={item} selected={selectedItemId === item.id} onSelect={() => onSelectItem(item)} />
                      {item.unlocks.length ? (
                        <div className="flex items-center gap-1 pl-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">
                          <ArrowRight aria-hidden="true" className="size-3" />
                          unlocks {item.unlocks.length}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </>
              ) : (
                <div className="grid min-h-[220px] place-items-center rounded-[10px] border border-dashed border-[var(--border-10)] bg-[var(--foreground-3)] p-4 text-center">
                  <div className="grid gap-2">
                    <span className="mx-auto grid size-10 place-items-center rounded-[9px] bg-[var(--tt-color-text-yellow-contrast)] text-[var(--alert)]">
                      <AlertCircle aria-hidden="true" className="size-5" />
                    </span>
                    <h3 className="text-sm font-medium">Coming soon</h3>
                    <p className="text-xs leading-5 text-[var(--foreground-50)]">Mature-stage milestones unlock once your company ships its first launch.</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
