import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PersonalOnboardingWizard } from "@/components/onboarding/personal-onboarding-wizard";
import { destinationForSession, getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export const metadata: Metadata = {
  title: "Set up your company",
  description: "Tell Cofounder about yourself and your company."
};

export default async function QuestionsPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login");
  }

  // Already onboarded — send to canvas
  if (session.user.onboardingStatus === "complete") {
    redirect(destinationForSession(session));
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      onboardingStatus: true,
      preferredName: true,
      name: true,
      technicalExperience: true,
      primaryRole: true,
      companyStage: true
    }
  });

  return (
    <PersonalOnboardingWizard
      initialProfile={{
        onboardingStatus: user.onboardingStatus,
        preferredName: user.preferredName ?? user.name ?? "",
        technicalExperience: user.technicalExperience,
        primaryRole: user.primaryRole,
        companyStage: user.companyStage
      }}
    />
  );
}
