import { MarketingFooter } from "@/components/marketing/marketing-footer";
import type { Metadata } from "next";
import { legalShellSections } from "@/data/marketing-content";
import { Card } from "@/components/ui/card";
import { MarketingContainer } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms under which you use Cofounder — what we provide, what we ask of you, and how your data and infrastructure stay yours."
};

const TERMS_LAST_UPDATED = "May 12, 2026";

const TERMS_COPY: Record<string, string> = {
  "Account, organization, and onboarding data":
    "By creating an account you agree to keep your credentials confidential and to provide accurate information during onboarding. You are responsible for activity carried out under your account.",
  "Company context, files, and generated business plan":
    "Content you create or upload remains yours. You grant Cofounder a limited license to host, process, and display that content solely to operate the service for you and your team.",
  "Managed integration status":
    "Connecting a third-party provider is governed by that provider's terms. We act on your behalf within the scopes you authorize and can be disconnected at any time from Settings → Integrations.",
  "Billing, usage, and plan information":
    "Paid plans renew until cancelled. Usage-based charges are billed in arrears against the metered units shown in your billing dashboard. You can downgrade or cancel from Settings → Billing.",
  "Security, data graduation, and destructive action approvals":
    "We provide tools to export your workspace and to graduate hosted infrastructure (GitHub, Supabase, Vercel) into accounts you own. Destructive actions are gated behind explicit confirmation and an audit log.",
};

export default function TermsPage() {
  return (
    <>
    <main className="bg-[var(--background)] pb-24 pt-[130px] text-[var(--foreground)]">
      <MarketingContainer className="max-w-[820px]">
        <Card className="grid gap-5 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">Terms of Service</p>
          <h1 className="text-[40px] font-normal leading-[1.15] tracking-[0px]">A clear agreement between us.</h1>
          <p className="text-[15px] leading-7 text-[var(--foreground-60)]">
            These terms describe the basics of how Cofounder operates: what you can expect from us, what we ask in return, and the safeguards around your data and the infrastructure we manage on your behalf.
          </p>
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">Last updated: {TERMS_LAST_UPDATED}</p>
          <div className="grid gap-3">
            {legalShellSections.map((section) => (
              <section key={section} className="rounded-[10px] border border-[var(--border-10)] bg-[var(--background)] p-4">
                <h2 className="text-lg font-medium tracking-[0px]">{section}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground-60)]">
                  {TERMS_COPY[section] ?? "Details available on request."}
                </p>
              </section>
            ))}
          </div>
          <p className="text-sm leading-6 text-[var(--foreground-60)]">
            Questions or disputes? Reach support from any workspace settings page before pursuing other remedies.
          </p>
        </Card>
      </MarketingContainer>
    </main>
      <MarketingFooter />
    </>
  );
}

