import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { AuthError, ForbiddenError, requireOrgMember } from "@/lib/auth/session";
import { approveBrandKit } from "@/lib/onboarding/company";

const approveSchema = z.object({
  approved: z.boolean(),
  feedback: z.string().trim().max(1000).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user } = await requireOrgMember(orgId);
    const body = await request.json().catch(() => null);
    const parsed = approveSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Brand kit approval input is invalid.", 400, parsed.error.flatten());
    }

    return dataResponse(await approveBrandKit({ organizationId: orgId, userId: user.id, ...parsed.data }));
  } catch (error) {
    if (error instanceof AuthError) return errorResponse("UNAUTHENTICATED", error.message, 401);
    if (error instanceof ForbiddenError) return errorResponse("FORBIDDEN", error.message, 403);
    throw error;
  }
}

