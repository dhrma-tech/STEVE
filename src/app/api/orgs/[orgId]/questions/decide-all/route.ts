import { dataResponse, errorResponse } from "@/lib/api/responses";
import { AuthError, ForbiddenError, requireOrgMember } from "@/lib/auth/session";
import { decideAllCompanyQuestions } from "@/lib/onboarding/company";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user } = await requireOrgMember(orgId);
    const answers = await decideAllCompanyQuestions({ organizationId: orgId, userId: user.id });
    return dataResponse({ answers });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse("UNAUTHENTICATED", error.message, 401);
    if (error instanceof ForbiddenError) return errorResponse("FORBIDDEN", error.message, 403);
    throw error;
  }
}

