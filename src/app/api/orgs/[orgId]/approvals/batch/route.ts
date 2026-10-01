import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgWriter } from "@/lib/auth/session";
import { batchApprove } from "@/lib/agents/policy/approval-inbox";

const batchSchema = z.object({ approvalIds: z.array(z.string().min(1)).min(1).max(50) });

type RouteContext = { params: Promise<{ orgId: string }> };

/** Approve several low-risk calls at once. Calls that contact people, spend money or delete are skipped. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user, membership } = await requireOrgWriter(orgId);
    const parsed = batchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "approvalIds are required", 422, parsed.error.flatten());
    return dataResponse(await batchApprove({ orgId, approvalIds: parsed.data.approvalIds, userId: user.id, role: membership.role }));
  } catch (error) {
    return routeError(error);
  }
}
