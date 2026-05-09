import type { Metadata } from "next";
import { legalShellSections } from "@/data/marketing-content";
import { Card } from "@/components/ui/card";
import { MarketingContainer } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Privacy Policy - Cofounder",
  description: "Privacy content shell for the Cofounder.co-style product."
};

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-[var(--background)] pb-24 pt-[130px] text-[var(--foreground)]">
      <MarketingContainer className="max-w-[820px]">
        <LegalShell
          label="Privacy Policy"
          title="Privacy content shell"
          intro="[ASSUMPTION: exact legal copy was not provided in the source notes. This shell covers the product surfaces named in the notes without adding provider-specific legal claims.]"
        />
      </MarketingContainer>
    </main>
  );
}

function LegalShell({ label, title, intro }: { label: string; title: string; intro: string }) {
  return (
    <Card className="grid gap-5 p-6">
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">{label}</p>
      <h1 className="text-[40px] font-normal leading-[1.15] tracking-[0px]">{title}</h1>
      <p className="text-[15px] leading-7 text-[var(--color-ink-muted)]">{intro}</p>
      <div className="grid gap-3">
        {legalShellSections.map((section) => (
          <section key={section} className="rounded-[10px] border border-[var(--color-border-card)] bg-[var(--background)] p-4">
            <h2 className="text-lg font-medium tracking-[0px]">{section}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
              This shell tracks the surface for future reviewed legal copy and keeps the route functional for the public website.
            </p>
          </section>
        ))}
      </div>
    </Card>
  );
}

