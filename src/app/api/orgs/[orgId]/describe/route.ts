import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { AuthError, ForbiddenError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { createCompanyQuestions } from "@/lib/onboarding/company";

const describeSchema = z.object({
  description: z.string().trim().min(20).max(2500)
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgMember(orgId);
    const body = await request.json().catch(() => null);
    const parsed = describeSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Company description is invalid.", 400, parsed.error.flatten());
    }

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        description: parsed.data.description,
        status: "onboarding"
      }
    });

    const questions = await createCompanyQuestions(orgId);

    return dataResponse({
      questions,
      actions: [
        { label: "Read company description", status: "succeeded" },
        { label: "Generated company questions", status: "succeeded" }
      ]
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse("UNAUTHENTICATED", error.message, 401);
    if (error instanceof ForbiddenError) return errorResponse("FORBIDDEN", error.message, 403);
    throw error;
  }
}

