import type { Metadata } from "next";
import { legalShellSections } from "@/data/marketing-content";
import { Card } from "@/components/ui/card";
import { MarketingContainer } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Cofounder collects, uses, and protects the data that flows through your company workspace."
};

const PRIVACY_LAST_UPDATED = "May 12, 2026";

const SECTION_COPY: Record<string, string> = {
  "Account, organization, and onboarding data":
    "We collect the account profile you provide (name, email, role, stage) and any company details you describe during onboarding. This data is used to set up your workspace and personalize agent context. You can delete your account from Settings → Preferences at any time.",
  "Company context, files, and generated business plan":
    "Files you upload and documents your agents generate (business plans, brand kits, drafts) are stored in your workspace library. We do not use your company content to train models. You retain ownership of everything stored in your workspace and can export or graduate at any time.",
  "Managed integration status":
    "When you connect a provider (GitHub, Vercel, Supabase, Stripe, Postiz, etc.), we store integration status and the minimum metadata needed to call those APIs on your behalf. Credentials are stored as encrypted secrets and never returned over the API after being set.",
  "Billing, usage, and plan information":
    "Plan, trial status, and aggregate usage (tokens, compute, storage) are stored on your billing account. Payment details are handled by our payment processor; we do not store full card numbers.",
  "Security, data graduation, and destructive action approvals":
    "Destructive actions (switching to your own Supabase, switching to your own GitHub repo, deleting an organization) require explicit typed confirmation. We log these actions in an audit trail visible to organization owners.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-[var(--background)] pb-24 pt-[130px] text-[var(--foreground)]">
      <MarketingContainer className="max-w-[820px]">
        <Card className="grid gap-5 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">Privacy Policy</p>
          <h1 className="text-[40px] font-normal leading-[1.15] tracking-[0px]">Your data, your company.</h1>
          <p className="text-[15px] leading-7 text-[var(--foreground-60)]">
            Cofounder is a managed company operating system. This policy describes what we collect, how it is used, and the controls you have over the data that flows through your workspace.
          </p>
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">Last updated: {PRIVACY_LAST_UPDATED}</p>
          <div className="grid gap-3">
            {legalShellSections.map((section) => (
              <section key={section} className="rounded-[10px] border border-[var(--border-10)] bg-[var(--background)] p-4">
                <h2 className="text-lg font-medium tracking-[0px]">{section}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground-60)]">
                  {SECTION_COPY[section] ?? "Details available on request."}
                </p>
              </section>
            ))}
          </div>
          <p className="text-sm leading-6 text-[var(--foreground-60)]">
            Questions about this policy? Contact support from any workspace settings page.
          </p>
        </Card>
      </MarketingContainer>
    </main>
  );
}

