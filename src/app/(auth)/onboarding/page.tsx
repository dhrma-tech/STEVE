import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PersonalOnboardingWizard } from "@/components/onboarding/personal-onboarding-wizard";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export const metadata: Metadata = {
  title: "Onboarding - Cofounder",
  description: "Personal onboarding before creating a company workspace."
};

export default async function OnboardingPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });

  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 py-12 text-[var(--foreground)]">
      <PersonalOnboardingWizard
        initialProfile={{
          onboardingStatus: user.onboardingStatus,
          preferredName: user.preferredName ?? user.name ?? "",
          technicalExperience: user.technicalExperience,
          primaryRole: user.primaryRole,
          companyStage: user.companyStage
        }}
      />
    </main>
  );
}
