"use client";

import * as React from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { RoadmapCard } from "@/components/roadmap/roadmap-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { RoadmapData } from "@/lib/roadmap/data";

type RoadmapItem = RoadmapData["stages"][number]["items"][number];
type SVGLine = { d: string; key: string; color: string };
type CardRect = { x: number; y: number; w: number; h: number };

export function RoadmapStageBoard({
  roadmap,
  selectedItemId,
  onSelectItem
}: {
  roadmap: RoadmapData;
  selectedItemId: string | null;
  onSelectItem: (item: RoadmapItem) => void;
}) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const boardRef = React.useRef<HTMLDivElement>(null);
  const [svgLines, setSvgLines] = React.useState<SVGLine[]>([]);
  const [svgSize, setSvgSize] = React.useState({ w: 0, h: 0 });
  const [cardRects, setCardRects] = React.useState<CardRect[]>([]);

  // Flat list of all items for quick lookup
  const allItems = React.useMemo(
    () => roadmap.stages.flatMap(s => s.items),
    [roadmap]
  );

  // Department of the currently hovered item
  const hoveredDept = React.useMemo(() => {
    if (!hoveredId) return null;
    return allItems.find(i => i.id === hoveredId)?.department ?? null;
  }, [hoveredId, allItems]);
  const hoveredDeptId    = hoveredDept?.id    ?? null;
  const hoveredDeptColor = hoveredDept?.color ?? "#f59e0b";

  // All item IDs that share the same department (excluding the hovered card itself)
  const sameDeptIds = React.useMemo(() => {
    if (!hoveredId || !hoveredDeptId) return new Set<string>();
    return new Set(
      allItems
        .filter(i => i.id !== hoveredId && i.department?.id === hoveredDeptId)
        .map(i => i.id)
    );
  }, [hoveredId, hoveredDeptId, allItems]);

  // Compute SVG lines — dot-to-dot, routed through the inter-column gap
  React.useEffect(() => {
    if (!hoveredId || sameDeptIds.size === 0 || !boardRef.current) {
      setSvgLines([]);
      return;
    }

    const container = boardRef.current;
    const inner = container.firstElementChild as HTMLElement | null;
    if (inner) setSvgSize({ w: inner.scrollWidth, h: inner.scrollHeight });

    const cRect = container.getBoundingClientRect();
    const sx = container.scrollLeft;
    const sy = container.scrollTop;

    // Collect every card's bounding rect — used by the SVG mask to hide lines on cards
    const allCardEls = container.querySelectorAll("[data-roadmap-item-key]");
    const rects: CardRect[] = [];
    allCardEls.forEach(el => {
      const r = (el as HTMLElement).getBoundingClientRect();
      rects.push({
        x: r.left - cRect.left + sx,
        y: r.top  - cRect.top  + sy,
        w: r.width,
        h: r.height
      });
    });
    setCardRects(rects);

    // Get dot center relative to the scroll container
    const getDotPos = (itemId: string) => {
      const el = container.querySelector(
        `[data-roadmap-dot="${itemId}"]`
      ) as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        cx: r.left - cRect.left + sx + r.width  / 2,
        cy: r.top  - cRect.top  + sy + r.height / 2
      };
    };

    // Get the right-edge x of the stage column that contains a dot element
    const getColumnRightEdge = (itemId: string) => {
      const el = container.querySelector(
        `[data-roadmap-dot="${itemId}"]`
      ) as HTMLElement | null;
      if (!el) return null;
      // Walk up to the section[data-roadmap-stage]
      const section = el.closest("section[data-roadmap-stage]") as HTMLElement | null;
      if (!section) return null;
      const r = section.getBoundingClientRect();
      return r.right - cRect.left + sx;
    };

    const getColumnLeftEdge = (itemId: string) => {
      const el = container.querySelector(
        `[data-roadmap-dot="${itemId}"]`
      ) as HTMLElement | null;
      if (!el) return null;
      const section = el.closest("section[data-roadmap-stage]") as HTMLElement | null;
      if (!section) return null;
      const r = section.getBoundingClientRect();
      return r.left - cRect.left + sx;
    };

    const src = getDotPos(hoveredId);
    if (!src) { setSvgLines([]); return; }

    const newLines: SVGLine[] = [];

    sameDeptIds.forEach(targetId => {
      const tgt = getDotPos(targetId);
      if (!tgt) return;

      // Route: dot → column edge → inter-column gap midpoint → column edge → dot
      // This keeps the vertical routing segment inside the gap between stages
      const color = hoveredDeptColor;

      if (src.cx < tgt.cx) {
        const srcRight = getColumnRightEdge(hoveredId) ?? src.cx;
        const tgtLeft  = getColumnLeftEdge(targetId)   ?? tgt.cx;
        const gapMid   = (srcRight + tgtLeft) / 2;
        const d = `M ${src.cx},${src.cy} H ${gapMid} V ${tgt.cy} H ${tgt.cx}`;
        newLines.push({ d, key: `${hoveredId}→${targetId}`, color });
      } else if (src.cx > tgt.cx) {
        const tgtRight = getColumnRightEdge(targetId) ?? tgt.cx;
        const srcLeft  = getColumnLeftEdge(hoveredId) ?? src.cx;
        const gapMid   = (tgtRight + srcLeft) / 2;
        const d = `M ${src.cx},${src.cy} H ${gapMid} V ${tgt.cy} H ${tgt.cx}`;
        newLines.push({ d, key: `${hoveredId}→${targetId}`, color });
      } else {
        const colLeft = (getColumnLeftEdge(hoveredId) ?? src.cx) + 6;
        const d = `M ${src.cx},${src.cy} H ${colLeft} V ${tgt.cy} H ${tgt.cx}`;
        newLines.push({ d, key: `${hoveredId}→${targetId}`, color });
      }
    });

    setSvgLines(newLines);
  }, [hoveredId, sameDeptIds]);

  return (
    <div ref={boardRef} className="relative h-full min-h-0 overflow-x-auto overflow-y-auto pb-4">
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
                  <span aria-hidden="true" className="absolute bottom-7 left-6 top-7 w-px border-l border-dashed border-[var(--border-10)]" />
                  {stage.items.map((item, index) => (
                    <div key={item.id} className="relative grid gap-2 pl-6">
                      {/* Dot — connection anchor point */}
                      <span
                        aria-hidden="true"
                        data-roadmap-dot={item.id}
                        className="absolute left-0 top-9 grid size-3 place-items-center rounded-full border border-[var(--border-10)] bg-[var(--card)]"
                      >
                        {index < stage.items.length - 1 ? (
                          <span className="size-1 rounded-full bg-[var(--foreground-50)]" />
                        ) : null}
                      </span>
                      <RoadmapCard
                        item={item}
                        selected={selectedItemId === item.id}
                        highlighted={hoveredId === item.id || sameDeptIds.has(item.id)}
                        highlightColor={hoveredDeptColor}
                        dimmed={hoveredId !== null && hoveredId !== item.id && !sameDeptIds.has(item.id)}
                        onSelect={() => onSelectItem(item)}
                        onMouseEnter={() => setHoveredId(item.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      />
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

      {/* SVG connector overlay — lines masked so they disappear over card bodies */}
      {svgLines.length > 0 && (
        <svg
          className="pointer-events-none absolute left-0 top-0 z-10"
          style={{ width: svgSize.w, height: svgSize.h }}
          aria-hidden="true"
        >
          <defs>
            <mask id="roadmap-card-cutout">
              {/* White = show lines */}
              <rect width={svgSize.w} height={svgSize.h} fill="white" />
              {/* Black rectangles = hide lines over each card */}
              {cardRects.map((r, i) => (
                <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="black" rx="8" />
              ))}
            </mask>
          </defs>
          <g mask="url(#roadmap-card-cutout)">
            {svgLines.map(line => (
              <AnimatedConnector key={line.key} d={line.d} color={line.color} />
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}

function AnimatedConnector({ d, color }: { d: string; color: string }) {
  const pathRef = React.useRef<SVGPathElement>(null);

  React.useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    path.style.transition = "none";
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    const raf = requestAnimationFrame(() => {
      path.style.transition = "stroke-dashoffset 0.45s cubic-bezier(0.4, 0, 0.2, 1)";
      path.style.strokeDashoffset = "0";
    });
    return () => cancelAnimationFrame(raf);
  }, [d]);

  return (
    <path
      ref={pathRef}
      d={d}
      fill="none"
      stroke={color}
      strokeOpacity={0.3}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
