import type { Metadata } from "next";
import { ResourcesGrid } from "@/components/marketing/resources-grid";
import { MarketingContainer } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Resources - Cofounder",
  description: "Launch notes, company updates, engineering articles, and observed Cofounder resource posts."
};

export default function ResourcesPage() {
  return (
    <main className="bg-[var(--background)] pb-24 pt-[130px] text-[var(--foreground)]">
      <MarketingContainer className="grid gap-10">
        <header className="grid max-w-[720px] gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">Resources</p>
          <h1 className="text-[40px] font-normal leading-[1.15] tracking-[0px]">Company-building notes from the operating system.</h1>
          <p className="text-[16px] leading-7 text-[var(--color-ink-muted)]">
            The observed resource list is represented as a featured launch post plus the public blog grid.
          </p>
        </header>
        <ResourcesGrid />
      </MarketingContainer>
    </main>
  );
}

