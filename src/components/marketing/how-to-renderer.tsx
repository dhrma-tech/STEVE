"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownToLine } from "lucide-react";
import type { HowToChapter } from "@/data/how-to-content";
import { Button, buttonClassName } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FeatureCallout } from "@/components/ui/card";
import { ChapterArt } from "@/components/marketing/pixel-art";

export function HowToRenderer({ chapter }: { chapter: HowToChapter }) {
  const [active, setActive] = React.useState(chapter.sections[0]?.id ?? "");

  React.useEffect(() => {
    const observers = chapter.sections.map((section) => {
      const element = document.getElementById(section.id);
      if (!element) {
        return null;
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActive(section.id);
          }
        },
        { rootMargin: "-35% 0px -55% 0px" }
      );
      observer.observe(element);
      return observer;
    });

    return () => observers.forEach((observer) => observer?.disconnect());
  }, [chapter.sections]);

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-[116px] lg:self-start">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" className="w-full justify-between rounded-[14px] border border-[var(--color-border-card)] bg-[var(--color-surface-raised)] p-4 lg:hidden">
              <span className="font-medium">Guide sections</span>
              <ArrowDownToLine aria-hidden="true" className="size-4 opacity-50" />
            </Button>
          </DialogTrigger>
          <DialogContent className="fixed inset-x-0 bottom-0 top-auto translate-y-0 rounded-b-none rounded-t-[20px] p-6 max-w-none w-full border-x-0 border-b-0 animate-[mm-footer-in_260ms_ease-out]">
            <DialogTitle>Guide sections</DialogTitle>
            <Toc chapter={chapter} active={active} className="mt-4" />
          </DialogContent>
        </Dialog>
        <div className="hidden rounded-[14px] border border-[var(--color-border-card)] bg-[var(--color-surface-raised)] p-4 lg:block">
          <Toc chapter={chapter} active={active} />
        </div>
      </aside>

      <article className="grid gap-8">
        <div className="grid gap-5">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">{chapter.eyebrow}</p>
          <h1 className="text-[40px] font-normal leading-[1.15] tracking-[0px]">{chapter.title}</h1>
          <p className="max-w-[72ch] text-[16px] leading-7 text-[var(--color-ink-muted)]">{chapter.intro}</p>
          <Link href="/docs" className={buttonClassName({ variant: "dark" })}>
            <ArrowDownToLine aria-hidden="true" className="size-4" />
            {chapter.downloadLabel}
          </Link>
          <ChapterArt tone={chapter.slug === "start" ? "green" : chapter.slug === "build" ? "blue" : chapter.slug === "sell" ? "pink" : "gold"} className="h-[280px]" />
        </div>

        {chapter.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-[120px] rounded-[16px] border border-[var(--color-border-card)] bg-[var(--color-surface-raised)] p-5">
            <h2 className="text-[28px] font-normal leading-[1.15] tracking-[0px]">{section.title}</h2>
            <p className="mt-4 text-[15px] leading-7 text-[var(--color-ink-muted)]">{section.body}</p>
            {section.callout ? <FeatureCallout className="mt-5" label="Guide note" title={section.title} description={section.callout} /> : null}
          </section>
        ))}
      </article>
    </div>
  );
}

function Toc({ chapter, active, className }: { chapter: HowToChapter; active: string; className?: string }) {
  const activeIndex = Math.max(
    0,
    chapter.sections.findIndex((section) => section.id === active)
  );
  const progress = chapter.sections.length > 0 ? ((activeIndex + 1) / chapter.sections.length) * 100 : 0;

  return (
    <nav className={className} aria-label={`${chapter.title} table of contents`}>
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-[var(--color-surface-darker)]">
        <div className="h-full bg-[var(--brand-500)] transition-[width]" style={{ width: `${progress}%` }} />
      </div>
      <div className="grid gap-2">
        {chapter.sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={`rounded-[8px] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)] ${
              active === section.id ? "bg-[var(--foreground)] text-white" : "text-[var(--color-ink-muted)] hover:bg-[var(--background)]"
            }`}
          >
            {section.title}
          </a>
        ))}
      </div>
    </nav>
  );
}
