"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { companyStageOptions, roleOptions, technicalExperienceOptions } from "@/lib/onboarding/definitions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { SliderField } from "@/components/ui/slider";
import { OptionCard } from "@/components/onboarding/option-card";
import { Stepper } from "@/components/onboarding/stepper";

type InitialProfile = {
  onboardingStatus: string;
  preferredName: string;
  technicalExperience: string | null;
  primaryRole: string | null;
  companyStage: string | null;
};

const steps = ["Name", "Experience", "Role", "Stage", "Company"];

export function PersonalOnboardingWizard({ initialProfile }: { initialProfile: InitialProfile }) {
  const router = useRouter();
  const [step, setStep] = React.useState(firstIncompleteStep(initialProfile));
  const [preferredName, setPreferredName] = React.useState(initialProfile.preferredName);
  const [technicalExperience, setTechnicalExperience] = React.useState(initialProfile.technicalExperience ?? "");
  const [primaryRole, setPrimaryRole] = React.useState(initialProfile.primaryRole ?? "");
  const [companyStageIndex, setCompanyStageIndex] = React.useState(Math.max(0, companyStageOptions.findIndex((option) => option === initialProfile.companyStage)));
  const [companyName, setCompanyName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const companyStage = companyStageOptions[companyStageIndex] ?? "Idea";
  const canContinue =
    (step === 0 && preferredName.trim().length > 0) ||
    (step === 1 && technicalExperience.length > 0) ||
    (step === 2 && primaryRole.length > 0) ||
    step === 3 ||
    (step === 4 && companyName.trim().length >= 2);

  async function completeProfile() {
    const response = await fetch("/api/onboarding/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preferredName, technicalExperience, primaryRole, companyStage })
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message: string } };
      throw new Error(payload.error?.message ?? "Unable to save onboarding profile.");
    }
  }

  async function saveProgress(payload: Partial<Omit<InitialProfile, "onboardingStatus">>) {
    const response = await fetch("/api/onboarding/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: { message: string } };
      throw new Error(body.error?.message ?? "Unable to save onboarding progress.");
    }
  }

  async function createCompany() {
    const response = await fetch("/api/orgs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: companyName })
    });
    const payload = (await response.json()) as { data?: { organization: { id: string } }; error?: { message: string } };

    if (!response.ok || !payload.data) {
      throw new Error(payload.error?.message ?? "Unable to create company.");
    }

    return payload.data.organization.id;
  }

  async function next() {
    setError(null);

    if (!canContinue) {
      setError("Finish this step before continuing.");
      return;
    }

    setLoading(true);
    try {
      if (step < 4) {
        await saveProgress(progressPayloadForStep(step, { preferredName, technicalExperience, primaryRole, companyStage }));
        setStep(step + 1);
        setLoading(false);
        return;
      }

      await completeProfile();
      const orgId = await createCompany();
      router.push(`/org/${orgId}/onboarding`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Onboarding failed.");
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto grid w-full max-w-[860px] gap-6 p-5">
      <Stepper steps={steps} current={step} />
      <div className="grid gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">Personal onboarding</p>
        <h1 className="text-[36px] font-normal leading-[1.12] tracking-[0px]">{steps[step]}</h1>
      </div>

      {step === 0 ? (
        <Input label="What should Cofounder call you?" value={preferredName} onChange={(event) => setPreferredName(event.target.value)} />
      ) : null}

      {step === 1 ? (
        <div className="grid gap-3 md:grid-cols-3">
          {technicalExperienceOptions.map((option) => (
            <OptionCard key={option.value} selected={technicalExperience === option.value} title={option.label} onClick={() => setTechnicalExperience(option.value)} />
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {roleOptions.map((option) => (
            <OptionCard key={option} selected={primaryRole === option} title={option} onClick={() => setPrimaryRole(option)} />
          ))}
        </div>
      ) : null}

      {step === 3 ? (
        <SliderField label="Company stage" min={0} max={companyStageOptions.length - 1} step={1} value={[companyStageIndex]} onValueChange={(value) => setCompanyStageIndex(value[0] ?? 0)} valueLabel={companyStage} />
      ) : null}

      {step === 4 ? (
        <Input label="Company name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} description="This creates your organization workspace before company onboarding." />
      ) : null}

      {error ? <ErrorState surface="light" title="Check this step" description={error} /> : null}

      <div className="flex justify-between gap-3">
        <Button variant="ghost" disabled={step === 0 || loading} onClick={() => setStep(step - 1)}>
          Back
        </Button>
        <Button variant="dark" disabled={loading} onClick={next}>
          {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {step === 4 ? "Create company" : "Continue"}
        </Button>
      </div>
    </Card>
  );
}

function firstIncompleteStep(profile: InitialProfile) {
  if (profile.onboardingStatus === "not_started") return 0;
  if (!profile.preferredName) return 0;
  if (!profile.technicalExperience) return 1;
  if (!profile.primaryRole) return 2;
  if (!profile.companyStage) return 3;
  return 4;
}

function progressPayloadForStep(
  step: number,
  values: {
    preferredName: string;
    technicalExperience: string;
    primaryRole: string;
    companyStage: string;
  }
) {
  if (step === 0) return { preferredName: values.preferredName };
  if (step === 1) return { technicalExperience: values.technicalExperience };
  if (step === 2) return { primaryRole: values.primaryRole };
  return { companyStage: values.companyStage };
}
