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
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">Run the company map</p>
            <h2 className="max-w-[12ch] text-[40px] font-normal leading-[1.12] tracking-[0px] text-[var(--foreground)]">
              Build with every department awake.
            </h2>
            <p className="max-w-[55ch] text-[15px] leading-6 text-[var(--foreground-60)]">
              Activate departments, ship the roadmap, and keep humans in the loop on the work that matters. Your company, run by agents you direct.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-[#fdf8f0] px-5 py-2 text-sm font-semibold text-[#1a1917] transition-all duration-300 hover:scale-[1.03] hover:bg-white"
              >
                Run a company
              </Link>
              <Link href="/docs" className={buttonClassName({ variant: "light" })}>
                Read docs
              </Link>
            </div>
          </div>
          <FooterPixelCard />
        </div>

        <div className="flex flex-col gap-5 border-t border-[var(--border-10)] pt-6 text-sm text-[var(--foreground-60)] md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-4">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-[var(--foreground)]">
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <span>SOC 2 compliant security</span>
            <span>Original design system</span>
            <span>© 2026 Cofounder</span>
          </div>
        </div>
      </MarketingContainer>
    </footer>
  );
}
