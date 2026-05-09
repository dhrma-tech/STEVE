import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ChapterArt } from "@/components/marketing/pixel-art";
import { Card } from "@/components/ui/card";
import { chapters } from "@/data/marketing-content";

const tones = ["green", "blue", "pink", "gold"] as const;

export function ChapterGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {chapters.map((chapter, index) => (
        <Link key={chapter.href} href={chapter.href} className="group outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]">
          <Card className="h-full overflow-hidden p-3 transition-transform group-hover:-translate-y-1">
            <ChapterArt tone={tones[index]} />
            <div className="grid gap-3 p-2 pt-4">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-[var(--color-border-pill)] px-2 py-1 font-mono text-[8px] font-medium leading-[11.6px] text-[var(--color-ink-muted)]">
                  {chapter.label}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-[var(--color-ink-muted)]">
                  Read <ArrowRight aria-hidden="true" className="size-3" />
                </span>
              </div>
              <h3 className="text-xl font-medium tracking-[0px] text-[var(--foreground)]">{chapter.title}</h3>
              <p className="text-sm leading-6 text-[var(--color-ink-muted)]">{chapter.description}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

