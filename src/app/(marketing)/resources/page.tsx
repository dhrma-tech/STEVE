import type { Metadata } from "next";
import { ResourcesGrid } from "@/components/marketing/resources-grid";
import { MarketingContainer } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Resources",
  description: "Launch announcements, company updates, engineering articles, and field notes from running companies with agents."
};

export default function ResourcesPage() {
  return (
    <main className="bg-[var(--background)] pb-24 pt-[130px] text-[var(--foreground)]">
      <MarketingContainer className="grid gap-10">
        <header className="grid max-w-[720px] gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">Resources</p>
          <h1 className="text-[40px] font-normal leading-[1.15] tracking-[0px]">Notes from operating an entire company.</h1>
          <p className="text-[16px] leading-7 text-[var(--foreground-60)]">
            Launch announcements, engineering deep-dives, and field notes from teams running their company with Cofounder.
          </p>
        </header>
        <ResourcesGrid />
      </MarketingContainer>
    </main>
  );
}

