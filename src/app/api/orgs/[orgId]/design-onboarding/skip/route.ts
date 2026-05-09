import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { AuthError, ForbiddenError, requireOrgMember } from "@/lib/auth/session";
import { skipDesignOnboarding } from "@/lib/onboarding/company";

const skipSchema = z.object({
  confirmedRisk: z.literal(true)
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgMember(orgId);
    const body = await request.json().catch(() => null);
    const parsed = skipSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Skipping design setup requires explicit confirmation.", 400, parsed.error.flatten());
    }

    return dataResponse(await skipDesignOnboarding({ organizationId: orgId }));
  } catch (error) {
    if (error instanceof AuthError) return errorResponse("UNAUTHENTICATED", error.message, 401);
    if (error instanceof ForbiddenError) return errorResponse("FORBIDDEN", error.message, 403);
    throw error;
  }
}

