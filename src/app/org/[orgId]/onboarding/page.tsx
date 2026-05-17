import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompanyOnboardingWorkspace } from "@/components/onboarding/company-onboarding-workspace";
import { getSession, requireOrgMember } from "@/lib/auth/session";
import { getCompanyOnboardingState } from "@/lib/onboarding/company";

export const metadata: Metadata = {
  title: "Company onboarding",
  description: "Describe your company, generate a business plan, and activate your eight departments."
};

type PageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function OrgOnboardingPage({ params }: PageProps) {
  const session = await getSession();
  if (!session.user) {
    redirect("/login");
  }

  const { orgId } = await params;
  await requireOrgMember(orgId);
  const state = await getCompanyOnboardingState(orgId);

  if (!state.organization) {
    redirect("/questions");
  }

  return (
    <CompanyOnboardingWorkspace
      userName={session.user.preferredName ?? "there"}
      initialState={{
        organization: {
          id: state.organization.id,
          name: state.organization.name,
          description: state.organization.description,
          status: state.organization.status,
          designOnboardingStatus: state.organization.designOnboardingStatus,
          businessPlanFileId: state.organization.businessPlanFileId
        },
        answers: state.answers.map((answer) => ({
          questionKey: answer.questionKey,
          questionText: answer.questionText,
          selectedOption: answer.selectedOption,
          freeText: answer.freeText,
          recommendedOption: answer.recommendedOption,
          aiDecided: answer.aiDecided
        })),
        departments: state.departments.map((department) => ({
          id: department.id,
          slug: department.slug,
          name: department.name,
          availability: department.availability
        })),
        agents: state.agents.map((agent) => ({ id: agent.id, name: agent.name })),
        integrations: state.integrations.map((integration) => ({ id: integration.id, provider: integration.provider, status: integration.status })),
        businessPlanFile: state.businessPlanFile
          ? {
              id: state.businessPlanFile.id,
              name: state.businessPlanFile.name,
              metadataJson: state.businessPlanFile.metadataJson
            }
          : null,
        design: {
          status: state.design.status,
          selectedVibe: state.design.selectedVibe,
          references: state.design.references,
          brandKit: state.design.brandKit,
          feedback: state.design.feedback
        }
      }}
    />
  );
}

