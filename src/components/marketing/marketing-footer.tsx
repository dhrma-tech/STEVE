import Link from "next/link";
import { footerLinks } from "@/data/marketing-content";
import { buttonClassName } from "@/components/ui/button";
import { MarketingContainer } from "@/components/ui/container";
import { FooterPixelCard } from "@/components/marketing/pixel-art";

export function MarketingFooter() {
  return (
    <footer className="bg-[var(--background)] py-16 text-[var(--foreground)]">
      <MarketingContainer className="grid gap-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div className="grid gap-5">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">Run the company map</p>
            <h2 className="max-w-[12ch] text-[40px] font-normal leading-[1.12] tracking-[0px] text-[var(--color-ink)]">
              Build with every department awake.
            </h2>
            <p className="max-w-[55ch] text-[15px] leading-6 text-[var(--color-ink-muted)]">
              Original public shell for the Cofounder.co-style product. No proprietary artwork, wordmark, or licensed assets are copied.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className={buttonClassName({ variant: "dark" })}>
                Run a company
              </Link>
              <Link href="/docs" className={buttonClassName({ variant: "light" })}>
                Read docs
              </Link>
            </div>
          </div>
          <FooterPixelCard />
        </div>

        <div className="flex flex-col gap-5 border-t border-[var(--color-border-card)] pt-6 text-sm text-[var(--color-ink-muted)] md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-4">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-[var(--foreground)]">
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <span>SOC 2 security copy</span>
            <span>Original design implementation</span>
            <span>2026 Cofounder build</span>
          </div>
        </div>
      </MarketingContainer>
    </footer>
  );
}
