import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { pausedApprovals } from "@/lib/agents/runner";

const approveSchema = z.object({
  action: z.enum(["approve", "deny"]),
  approvalId: z.string().trim().min(1)
});

type RouteContext = { params: Promise<{ orgId: string; agentId: string; sessionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId, sessionId } = await context.params;
    await requireOrgMember(orgId);

    const parsed = approveSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "action and approvalId are required", 422, parsed.error.flatten());
    }

    // Verify the session belongs to this org
    const session = await prisma.taskSession.findFirst({
      where: { id: sessionId, organizationId: orgId }
    });
    if (!session) return errorResponse("NOT_FOUND", "Session not found", 404);

    const { action, approvalId } = parsed.data;
    const pending = pausedApprovals.get(approvalId);

    if (!pending) {
      return errorResponse("NOT_FOUND", "Approval not found or already resolved", 404);
    }

    pausedApprovals.delete(approvalId);

    if (action === "approve") {
      pending.resolve();
    } else {
      pending.reject(new Error("Denied by user"));
    }

    return dataResponse({ approved: action === "approve" });
  } catch (error) {
    return routeError(error);
  }
}
