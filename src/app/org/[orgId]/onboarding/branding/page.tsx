import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, requireOrgMember } from "@/lib/auth/session";
import { getCompanyOnboardingState } from "@/lib/onboarding/company";
import { BrandingWorkspace } from "@/components/onboarding/branding-workspace";

export const metadata: Metadata = {
  title: "Brand your company",
  description: "Set your company name, theme, colors, fonts, and brand personality."
};

type PageProps = { params: Promise<{ orgId: string }> };

export default async function BrandingPage({ params }: PageProps) {
  const session = await getSession();
  if (!session.user) redirect("/login");

  const { orgId } = await params;
  await requireOrgMember(orgId);
  const state = await getCompanyOnboardingState(orgId);

  if (!state.organization) redirect("/questions");

  return <BrandingWorkspace orgId={orgId} orgName={state.organization.name} />;
}
