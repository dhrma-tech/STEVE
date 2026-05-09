import type { Metadata } from "next";
import { docsSections } from "@/data/marketing-content";
import { Card } from "@/components/ui/card";
import { MarketingContainer } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Docs - Cofounder",
  description: "Internal documentation landing page for the Cofounder.co-style product."
};

export default function DocsPage() {
  return (
    <main className="bg-[var(--background)] pb-24 pt-[130px] text-[var(--foreground)]">
      <MarketingContainer className="grid gap-10">
        <header className="grid max-w-[760px] gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">Docs</p>
          <h1 className="text-[40px] font-normal leading-[1.15] tracking-[0px]">Documentation landing page.</h1>
          <p className="text-[16px] leading-7 text-[var(--color-ink-muted)]">
            [ASSUMPTION: the notes conflict between internal `/docs` and external docs. This route provides internal sections that can later link out.]
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {docsSections.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.title} className="grid gap-4 p-4">
                <Icon aria-hidden="true" className="size-5 text-[var(--hero-blue)]" />
                <h2 className="text-xl font-medium tracking-[0px]">{section.title}</h2>
                <ul className="grid gap-2 text-sm leading-6 text-[var(--color-ink-muted)]">
                  {section.links.map((link) => (
                    <li key={link}>{link}</li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </MarketingContainer>
    </main>
  );
}

