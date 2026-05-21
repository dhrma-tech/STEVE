import Link from "next/link";
import { footerLinks } from "@/data/marketing-content";
import { MarketingContainer } from "@/components/ui/container";

export function MarketingFooter() {
  return (
    <footer className="bg-[var(--background)] py-16 text-[var(--foreground)]">
      <MarketingContainer>
        <div className="flex flex-col gap-5 py-6 text-sm text-[var(--foreground-60)] md:flex-row md:items-center md:justify-between">
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
