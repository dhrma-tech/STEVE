import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { chapters } from "@/data/marketing-content";

/*
  Chapter card images — place these 4 files in /public:
    /chapter-start.png    (card 1 — Start)    recommended: 600×360, any ratio works
    /chapter-build.png    (card 2 — Build)    recommended: 600×360
    /chapter-sell.png     (card 3 — Sell)     recommended: 600×360
    /chapter-scale.png    (card 4 — Scale)    recommended: 600×360
  Format: PNG or JPEG. The placeholder below shows until the file exists.
*/
const chapterImages = [
  "/chapter-start.jpeg",
  "/chapter-build.jpeg",
  "/chapter-sell.jpeg",
  "/chapter-scale.jpeg",
] as const;

export function ChapterGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {chapters.map((chapter, index) => (
        <Link key={chapter.href} href={chapter.href} className="group outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]">
          <Card className="h-full overflow-hidden p-3 transition-transform group-hover:-translate-y-1">
            {/* Image slot — 3:2 ratio matching uploaded images (1264×842) */}
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[8px] bg-[var(--foreground-5)]">
              {/* Placeholder label shown until image file is placed in /public */}
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--foreground-30)]">
                  {chapterImages[index]}
                </p>
              </div>
              <img
                src={chapterImages[index]}
                alt={chapter.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div className="grid gap-3 p-2 pt-4">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 font-mono text-[8px] font-medium leading-[11.6px] text-[var(--foreground-60)]">
                  {chapter.label}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-[var(--foreground-60)]">
                  Read <ArrowRight aria-hidden="true" className="size-3" />
                </span>
              </div>
              <h3 className="text-xl font-medium tracking-[0px] text-[var(--foreground)]">{chapter.title}</h3>
              <p className="text-sm leading-6 text-[var(--foreground-60)]">{chapter.description}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

