import type { Metadata } from "next";
import { legalShellSections } from "@/data/marketing-content";
import { Card } from "@/components/ui/card";
import { MarketingContainer } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Terms - Cofounder",
  description: "Canonical terms content shell for the Cofounder.co-style product."
};

export default function TermsPage() {
  return (
    <main className="bg-[var(--background)] pb-24 pt-[130px] text-[var(--foreground)]">
      <MarketingContainer className="max-w-[820px]">
        <Card className="grid gap-5 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">Terms</p>
          <h1 className="text-[40px] font-normal leading-[1.15] tracking-[0px]">Canonical terms content shell</h1>
          <p className="text-[15px] leading-7 text-[var(--color-ink-muted)]">
            [ASSUMPTION: exact terms copy was not provided in the source notes. `/terms` is canonical and `/terms-of-service` redirects here.]
          </p>
          <div className="grid gap-3">
            {legalShellSections.map((section) => (
              <section key={section} className="rounded-[10px] border border-[var(--color-border-card)] bg-[var(--background)] p-4">
                <h2 className="text-lg font-medium tracking-[0px]">{section}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
                  The final legal language needs human review. This route intentionally limits itself to product-surface headings from the notes.
                </p>
              </section>
            ))}
          </div>
        </Card>
      </MarketingContainer>
    </main>
  );
}

