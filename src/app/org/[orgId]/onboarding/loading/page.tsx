import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, requireOrgMember } from "@/lib/auth/session";
import { getCompanyOnboardingState } from "@/lib/onboarding/company";
import { LoadingWorkspace } from "@/components/onboarding/loading-workspace";

export const metadata: Metadata = { title: "Setting up your canvas…" };

type PageProps = { params: Promise<{ orgId: string }> };

export default async function LoadingPage({ params }: PageProps) {
  const session = await getSession();
  if (!session.user) redirect("/login");

  const { orgId } = await params;
  await requireOrgMember(orgId);
  const state = await getCompanyOnboardingState(orgId);

  if (!state.organization) redirect("/questions");

  return <LoadingWorkspace orgId={orgId} orgName={state.organization.name} />;
}
