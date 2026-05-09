import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { AuthError, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const profileSchema = z.object({
  preferredName: z.string().trim().min(1).max(80),
  technicalExperience: z.enum(["writes_code", "manages_engineers", "not_technical"]),
  primaryRole: z.enum(["Product", "Engineering", "Design", "Marketing", "Sales", "Operations", "Founder / Executive", "Other"]),
  companyStage: z.enum(["Pre-idea", "Idea", "Pre-MVP", "MVP", "Customers", "Revenue", "Public"])
});

const profileProgressSchema = profileSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one onboarding field is required."
});

export async function GET() {
  try {
    const sessionUser = await requireUser();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });

    return dataResponse({
      status: user.onboardingStatus,
      preferredName: user.preferredName ?? user.name ?? "",
      technicalExperience: user.technicalExperience,
      primaryRole: user.primaryRole,
      companyStage: user.companyStage
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse("UNAUTHENTICATED", error.message, 401);
    }
    throw error;
  }
}

export async function PUT(request: Request) {
  try {
    const sessionUser = await requireUser();
    const body = await request.json().catch(() => null);
    const parsed = profileSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Personal onboarding input is invalid.", 400, parsed.error.flatten());
    }

    const updated = await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        preferredName: parsed.data.preferredName,
        name: parsed.data.preferredName,
        technicalExperience: parsed.data.technicalExperience,
        primaryRole: parsed.data.primaryRole,
        companyStage: parsed.data.companyStage,
        onboardingStatus: "complete"
      }
    });

    await prisma.userPreference.upsert({
      where: { userId: updated.id },
      update: { preferredName: updated.preferredName },
      create: {
        userId: updated.id,
        preferredName: updated.preferredName,
        timezone: "Asia/Calcutta",
        aiModel: "claude-sonnet-sandbox"
      }
    });

    return dataResponse({ status: updated.onboardingStatus });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse("UNAUTHENTICATED", error.message, 401);
    }
    throw error;
  }
}

export async function PATCH(request: Request) {
  try {
    const sessionUser = await requireUser();
    const body = await request.json().catch(() => null);
    const parsed = profileProgressSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Personal onboarding progress is invalid.", 400, parsed.error.flatten());
    }

    const updated = await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        ...parsed.data,
        ...(parsed.data.preferredName ? { name: parsed.data.preferredName } : {}),
        onboardingStatus: "in_progress"
      }
    });

    if (parsed.data.preferredName) {
      await prisma.userPreference.upsert({
        where: { userId: updated.id },
        update: { preferredName: updated.preferredName },
        create: {
          userId: updated.id,
          preferredName: updated.preferredName,
          timezone: "Asia/Calcutta",
          aiModel: "claude-sonnet-sandbox"
        }
      });
    }

    return dataResponse({
      status: updated.onboardingStatus,
      preferredName: updated.preferredName,
      technicalExperience: updated.technicalExperience,
      primaryRole: updated.primaryRole,
      companyStage: updated.companyStage
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse("UNAUTHENTICATED", error.message, 401);
    }
    throw error;
  }
}
