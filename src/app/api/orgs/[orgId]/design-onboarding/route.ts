import { dataResponse, errorResponse } from "@/lib/api/responses";
import { AuthError, ForbiddenError, requireOrgMember } from "@/lib/auth/session";
import { getDesignOnboardingState } from "@/lib/onboarding/company";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgMember(orgId);
    return dataResponse(await getDesignOnboardingState(orgId));
  } catch (error) {
    if (error instanceof AuthError) return errorResponse("UNAUTHENTICATED", error.message, 401);
    if (error instanceof ForbiddenError) return errorResponse("FORBIDDEN", error.message, 403);
    throw error;
  }
}

