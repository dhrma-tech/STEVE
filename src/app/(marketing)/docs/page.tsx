import { MarketingFooter } from "@/components/marketing/marketing-footer";
import type { Metadata } from "next";
import { docsSections } from "@/data/marketing-content";
import { Card } from "@/components/ui/card";
import { MarketingContainer } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Docs",
  description: "Learn how Cofounder runs an entire company with agents — onboarding, departments, the roadmap, tasks, files, and integrations."
};

export default function DocsPage() {
  return (
    <>
    <main className="bg-[var(--background)] pb-24 pt-[130px] text-[var(--foreground)]">
      <MarketingContainer className="grid gap-10">
        <header className="grid max-w-[760px] gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">Docs</p>
          <h1 className="text-[40px] font-normal leading-[1.15] tracking-[0px]">How Cofounder works.</h1>
          <p className="text-[16px] leading-7 text-[var(--foreground-60)]">
            Everything you need to take a company from idea to launch with agents — onboarding, departments, the roadmap, files, and the systems your founder day relies on.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {docsSections.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.title} className="grid gap-4 p-4">
                <Icon aria-hidden="true" className="size-5 text-[var(--tt-color-text-blue)]" />
                <h2 className="text-xl font-medium tracking-[0px]">{section.title}</h2>
                <ul className="grid gap-2 text-sm leading-6 text-[var(--foreground-60)]">
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
      <MarketingFooter />
    </>
  );
}

