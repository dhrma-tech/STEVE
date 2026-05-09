import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { AuthError, ForbiddenError, requireOrgMember } from "@/lib/auth/session";
import { designVibes } from "@/lib/onboarding/definitions";
import { saveDesignVibe } from "@/lib/onboarding/company";

const vibeSchema = z.object({
  vibe: z.enum(designVibes.map((item) => item.value) as [string, ...string[]])
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user } = await requireOrgMember(orgId);
    const body = await request.json().catch(() => null);
    const parsed = vibeSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Design vibe is invalid.", 400, parsed.error.flatten());
    }

    return dataResponse(await saveDesignVibe({ organizationId: orgId, userId: user.id, vibe: parsed.data.vibe }));
  } catch (error) {
    if (error instanceof AuthError) return errorResponse("UNAUTHENTICATED", error.message, 401);
    if (error instanceof ForbiddenError) return errorResponse("FORBIDDEN", error.message, 403);
    throw error;
  }
}

