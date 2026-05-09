import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin, requireOrgMember } from "@/lib/auth/session";
import { getCompanyOnboardingState } from "@/lib/onboarding/company";
import { prisma } from "@/lib/db/client";
import { routeError } from "@/lib/api/route-errors";

const patchOrgSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().min(10).max(2000).optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { membership, organization } = await requireOrgMember(orgId);
    const state = await getCompanyOnboardingState(orgId);
    const billing = await prisma.billingAccount.findUnique({ where: { organizationId: orgId } });

    return dataResponse({
      organization,
      membershipRole: membership.role,
      onboarding: state,
      billing
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgAdmin(orgId);
    const body = await request.json().catch(() => null);
    const parsed = patchOrgSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Organization update is invalid.", 400, parsed.error.flatten());
    }

    const organization = await prisma.organization.update({
      where: { id: orgId },
      data: parsed.data
    });

    return dataResponse({ organization });
  } catch (error) {
    return routeError(error);
  }
}

