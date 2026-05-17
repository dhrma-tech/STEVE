import { randomBytes } from "node:crypto";
import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { routeError } from "@/lib/api/route-errors";

const submitSchema = z.object({
  preferredName: z.string().trim().min(1).max(80),
  technicalExperience: z.enum(["writes_code", "manages_engineers", "not_technical"]),
  primaryRole: z.enum(["Product", "Engineering", "Design", "Marketing", "Sales", "Operations", "Founder / Executive", "Other"]),
  companyStage: z.enum(["Pre-idea", "Idea", "Pre-MVP", "MVP", "Customers", "Revenue", "Public"]),
  companyName: z.string().trim().min(2).max(80)
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const parsed = submitSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid onboarding submission.", 400, parsed.error.flatten());
    }

    const { preferredName, technicalExperience, primaryRole, companyStage, companyName } = parsed.data;

    // Save personal profile + mark user onboarding complete
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        preferredName,
        name: preferredName,
        technicalExperience,
        primaryRole,
        companyStage,
        onboardingStatus: "complete"
      }
    });

    await prisma.userPreference.upsert({
      where: { userId: updatedUser.id },
      update: { preferredName: updatedUser.preferredName },
      create: {
        userId: updatedUser.id,
        preferredName: updatedUser.preferredName,
        timezone: "Asia/Calcutta",
        aiModel: "claude-sonnet-sandbox"
      }
    });

    // Create org in onboarding state — user will complete org onboarding next
    const slug = await uniqueSlug(companyName);
    const organization = await prisma.organization.create({
      data: {
        name: companyName,
        slug,
        status: "onboarding",
        designOnboardingStatus: "not_started",
        stage: companyStage.toLowerCase().replace(/[^a-z]/g, "-") as string,
        currentPlan: "trial",
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        memberships: {
          create: {
            userId: user.id,
            role: "owner",
            acceptedAt: new Date()
          }
        }
      }
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastOrgSlug: organization.slug }
    });

    await prisma.notificationPreference.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      update: {},
      create: {
        userId: user.id,
        organizationId: organization.id,
        desktopAlerts: false
      }
    });

    return dataResponse({ orgId: organization.id });
  } catch (error) {
    return routeError(error);
  }
}

async function uniqueSlug(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "company";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = randomBytes(3).toString("hex");
    const slug = `${base}-${suffix}`;
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (!existing) return slug;
  }

  return `${base}-${Date.now().toString(36)}`;
}
