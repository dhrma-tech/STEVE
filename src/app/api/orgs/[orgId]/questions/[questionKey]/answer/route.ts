import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { AuthError, ForbiddenError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { companyQuestions } from "@/lib/onboarding/definitions";

const answerSchema = z.object({
  selectedOption: z.string().trim().min(1).nullable().optional(),
  freeText: z.string().trim().max(600).nullable().optional(),
  aiDecided: z.boolean().default(false)
});

type RouteContext = { params: Promise<{ orgId: string; questionKey: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId, questionKey } = await context.params;
    const { user } = await requireOrgMember(orgId);
    const question = companyQuestions.find((item) => item.key === questionKey);

    if (!question) {
      return errorResponse("NOT_FOUND", "Question not found.", 404);
    }

    const body = await request.json().catch(() => null);
    const parsed = answerSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Question answer is invalid.", 400, parsed.error.flatten());
    }

    if (!parsed.data.selectedOption && !parsed.data.freeText) {
      return errorResponse("VALIDATION_ERROR", "Select an option or write a free-text answer.", 400);
    }

    const recommendedOption = question.options.find((option) => option.recommended)?.id ?? question.options[0]?.id;
    const answer = await prisma.onboardingAnswer.upsert({
      where: { organizationId_questionKey: { organizationId: orgId, questionKey } },
      update: {
        selectedOption: parsed.data.selectedOption ?? null,
        freeText: parsed.data.freeText ?? null,
        aiDecided: parsed.data.aiDecided,
        answeredByUserId: user.id,
        recommendedOption
      },
      create: {
        organizationId: orgId,
        questionKey,
        questionText: question.text,
        selectedOption: parsed.data.selectedOption ?? null,
        freeText: parsed.data.freeText ?? null,
        aiDecided: parsed.data.aiDecided,
        answeredByUserId: user.id,
        recommendedOption
      }
    });

    const remaining = await prisma.onboardingAnswer.count({
      where: {
        organizationId: orgId,
        questionKey: { in: companyQuestions.map((item) => item.key) },
        selectedOption: null,
        freeText: null
      }
    });

    return dataResponse({ answer, remaining });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse("UNAUTHENTICATED", error.message, 401);
    if (error instanceof ForbiddenError) return errorResponse("FORBIDDEN", error.message, 403);
    throw error;
  }
}

