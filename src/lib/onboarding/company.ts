import { prisma } from "@/lib/db/client";
import { companyQuestions, designVibes } from "@/lib/onboarding/definitions";
import { ensureBusinessPlanFile, ensureGeneralFolder } from "@/lib/onboarding/activation";

const json = (value: unknown) => JSON.stringify(value);

export async function createCompanyQuestions(organizationId: string) {
  for (const question of companyQuestions) {
    const recommendedOption = question.options.find((option) => option.recommended)?.id ?? question.options[0]?.id;
    await prisma.onboardingAnswer.upsert({
      where: { organizationId_questionKey: { organizationId, questionKey: question.key } },
      update: {
        questionText: question.text,
        recommendedOption
      },
      create: {
        organizationId,
        questionKey: question.key,
        questionText: question.text,
        recommendedOption
      }
    });
  }

  return companyQuestions;
}

export async function getCompanyOnboardingState(organizationId: string) {
  const [organization, answers, departments, agents, integrations, businessPlanFile] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.onboardingAnswer.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } }),
    prisma.department.findMany({ where: { organizationId }, orderBy: { sortOrder: "asc" } }),
    prisma.agent.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } }),
    prisma.integration.findMany({ where: { organizationId }, orderBy: { provider: "asc" } }),
    prisma.file.findFirst({ where: { organizationId, name: "Business Plan.md", archivedAt: null } })
  ]);

  return {
    organization,
    questions: companyQuestions,
    answers,
    departments,
    agents,
    integrations,
    businessPlanFile,
    design: await getDesignOnboardingState(organizationId)
  };
}

export async function decideAllCompanyQuestions({ organizationId, userId }: { organizationId: string; userId: string }) {
  await createCompanyQuestions(organizationId);
  const existing = await prisma.onboardingAnswer.findMany({ where: { organizationId } });
  const answered = new Set(existing.filter((answer) => answer.selectedOption || answer.freeText).map((answer) => answer.questionKey));

  for (const question of companyQuestions) {
    if (answered.has(question.key)) continue;
    const recommendedOption = question.options.find((option) => option.recommended)?.id ?? question.options[0]?.id ?? "decide";
    await prisma.onboardingAnswer.update({
      where: { organizationId_questionKey: { organizationId, questionKey: question.key } },
      data: {
        selectedOption: recommendedOption,
        answeredByUserId: userId,
        aiDecided: true
      }
    });
  }

  return prisma.onboardingAnswer.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } });
}

export async function generateBusinessPlan({ organizationId, userId }: { organizationId: string; userId: string }) {
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const answers = await prisma.onboardingAnswer.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } });
  const answerMap = new Map(answers.map((answer) => [answer.questionKey, answer]));
  const customer = labelForAnswer("customer_segment", answerMap) ?? "early customers";
  const switchingReason = labelForAnswer("switching_reason", answerMap) ?? "faster execution";
  const monetization = labelForAnswer("monetization", answerMap) ?? "subscription";
  const acquisition = labelForAnswer("first_100_customers", answerMap) ?? "founder-led outbound";
  const currentStage = labelForAnswer("current_stage", answerMap) ?? organization.stage ?? "idea";

  const plan = {
    productOrService: `${organization.name} helps ${customer} build and operate their company through AI departments, visible task sessions, managed files, and human approvals.`,
    icp: `${customer} who are at the ${currentStage} stage and will switch because they need ${switchingReason}.`,
    monetization,
    acquisition,
    currentStage,
    sections: {
      "Product/Service": `${organization.description ?? organization.name} is positioned as a company operating workspace with departments and agent tasks.`,
      ICP: `${customer}; trigger: ${switchingReason}; initial acquisition: ${acquisition}.`
    }
  };

  const folder = await ensureGeneralFolder(organizationId);
  const file = await ensureBusinessPlanFile({ organizationId, userId, folderId: folder.id, metadata: plan });

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      businessPlanFileId: file.id,
      stage: normalizeStage(currentStage)
    }
  });

  return {
    file,
    plan,
    actions: [
      { label: "Ran 2 actions", status: "succeeded" },
      { label: "Writing to workspace", status: "succeeded" },
      { label: "Saving workspace files", status: "succeeded" }
    ]
  };
}

export async function getDesignOnboardingState(organizationId: string) {
  const answers = await prisma.onboardingAnswer.findMany({
    where: {
      organizationId,
      questionKey: { in: ["design_vibe", "design_references", "design_brand_kit", "design_feedback"] }
    }
  });
  const byKey = new Map(answers.map((answer) => [answer.questionKey, answer]));
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });

  return {
    status: organization?.designOnboardingStatus ?? "not_started",
    selectedVibe: byKey.get("design_vibe")?.selectedOption ?? null,
    references: parseMetadata(byKey.get("design_references")?.freeText),
    brandKit: parseMetadata(byKey.get("design_brand_kit")?.freeText),
    feedback: byKey.get("design_feedback")?.freeText ?? null,
    vibes: designVibes
  };
}

export async function saveDesignVibe({ organizationId, userId, vibe }: { organizationId: string; userId: string; vibe: string }) {
  await prisma.onboardingAnswer.upsert({
    where: { organizationId_questionKey: { organizationId, questionKey: "design_vibe" } },
    update: {
      selectedOption: vibe,
      answeredByUserId: userId,
      aiDecided: false
    },
    create: {
      organizationId,
      questionKey: "design_vibe",
      questionText: "Choose a design vibe",
      selectedOption: vibe,
      answeredByUserId: userId
    }
  });
  await prisma.organization.update({ where: { id: organizationId }, data: { designOnboardingStatus: "in_progress" } });
  return getDesignOnboardingState(organizationId);
}

export async function saveDesignReferences({
  organizationId,
  userId,
  files,
  description
}: {
  organizationId: string;
  userId: string;
  files: Array<{ name: string; type: string; size: number }>;
  description?: string | null;
}) {
  const payload = { files, description: description ?? "" };
  await prisma.onboardingAnswer.upsert({
    where: { organizationId_questionKey: { organizationId, questionKey: "design_references" } },
    update: {
      freeText: json(payload),
      answeredByUserId: userId
    },
    create: {
      organizationId,
      questionKey: "design_references",
      questionText: "Optional visual references",
      freeText: json(payload),
      answeredByUserId: userId
    }
  });

  return getDesignOnboardingState(organizationId);
}

export async function generateBrandKit({ organizationId }: { organizationId: string }) {
  const state = await getDesignOnboardingState(organizationId);
  const vibe = designVibes.find((item) => item.value === state.selectedVibe)?.label ?? "Editorial calm";
  const brandKit = {
    vibe,
    palette: ["#f5f5f2", "#171717", "#6229ff", "#34a853", "#1a6fd1"],
    typography: {
      primary: "Plus Jakarta Sans",
      mono: "IBM Plex Mono fallback for Departure Mono"
    },
    layoutExamples: ["Warm marketing hero", "Dark app shell", "Dense task panel", "Pixel-art chapter cards"],
    progress: ["COMPOSING BOARD", "BALANCING PALETTE", "SETTING TYPE"]
  };

  await prisma.onboardingAnswer.upsert({
    where: { organizationId_questionKey: { organizationId, questionKey: "design_brand_kit" } },
    update: { freeText: json(brandKit), aiDecided: true },
    create: {
      organizationId,
      questionKey: "design_brand_kit",
      questionText: "Generated brand kit",
      freeText: json(brandKit),
      aiDecided: true
    }
  });
  await prisma.organization.update({ where: { id: organizationId }, data: { designOnboardingStatus: "in_progress" } });

  return {
    job: {
      status: "complete",
      chips: brandKit.progress.map((label) => ({ label, status: "succeeded" }))
    },
    brandKit
  };
}

export async function approveBrandKit({
  organizationId,
  userId,
  approved,
  feedback
}: {
  organizationId: string;
  userId: string;
  approved: boolean;
  feedback?: string | null;
}) {
  await prisma.onboardingAnswer.upsert({
    where: { organizationId_questionKey: { organizationId, questionKey: "design_feedback" } },
    update: {
      freeText: feedback ?? null,
      answeredByUserId: userId
    },
    create: {
      organizationId,
      questionKey: "design_feedback",
      questionText: approved ? "Approved brand kit" : "Brand kit iteration feedback",
      freeText: feedback ?? null,
      answeredByUserId: userId
    }
  });

  await prisma.organization.update({
    where: { id: organizationId },
    data: { designOnboardingStatus: approved ? "complete" : "in_progress" }
  });

  return {
    approved,
    nextRoute: approved ? `/org/${organizationId}/canvas` : `/org/${organizationId}/onboarding?design_setup=1&iterate=1`
  };
}

export async function skipDesignOnboarding({ organizationId }: { organizationId: string }) {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { designOnboardingStatus: "skipped" }
  });

  return {
    skipped: true,
    nextRoute: `/org/${organizationId}/canvas`
  };
}

function labelForAnswer(key: string, answerMap: Map<string, { selectedOption: string | null; freeText: string | null }>) {
  const answer = answerMap.get(key);
  if (!answer) return null;
  if (answer.freeText) return answer.freeText;
  const question = companyQuestions.find((item) => item.key === key);
  return question?.options.find((option) => option.id === answer.selectedOption)?.label ?? answer.selectedOption;
}

function normalizeStage(stage: string) {
  return stage.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
}

function parseMetadata(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

