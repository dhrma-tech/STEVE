import { randomBytes } from "node:crypto";
import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { AuthError, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const createOrgSchema = z.object({
  name: z.string().trim().min(2).max(80)
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const parsed = createOrgSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Organization name is invalid.", 400, parsed.error.flatten());
    }

    const slug = await uniqueSlug(parsed.data.name);
    const organization = await prisma.organization.create({
      data: {
        name: parsed.data.name,
        slug,
        status: "onboarding",
        stage: "idea",
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
      data: {
        lastOrgSlug: organization.slug,
        onboardingStatus: "complete"
      }
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

    return dataResponse({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status
      }
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse("UNAUTHENTICATED", error.message, 401);
    }
    throw error;
  }
}

async function uniqueSlug(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "company";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = randomBytes(3).toString("hex");
    const slug = `${base}-${suffix}`;
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (!existing) {
      return slug;
    }
  }

  return `${base}-${Date.now().toString(36)}`;
}

