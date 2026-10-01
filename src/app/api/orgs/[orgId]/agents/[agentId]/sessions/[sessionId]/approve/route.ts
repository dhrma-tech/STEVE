import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgWriter } from "@/lib/auth/session";
import { resolveApproval } from "@/lib/agents/policy/approvals";

const approveSchema = z.object({
  action: z.enum(["approve", "deny"]),
  approvalId: z.string().trim().min(1),
  /** once: this call only. run: also later calls of this tool in this run. always: also future runs of this agent (admin only). */
  scope: z.enum(["once", "run", "always"]).default("once"),
  note: z.string().trim().max(500).optional()
});

type RouteContext = { params: Promise<{ orgId: string; agentId: string; sessionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId, sessionId } = await context.params;
    const { user, membership } = await requireOrgWriter(orgId);

    const parsed = approveSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "action and approvalId are required", 422, parsed.error.flatten());
    }

    const result = await resolveApproval({
      orgId,
      sessionId,
      approvalId: parsed.data.approvalId,
      userId: user.id,
      isAdmin: ["owner", "admin"].includes(membership.role),
      decision: parsed.data.action,
      scope: parsed.data.scope,
      note: parsed.data.note
    });

    switch (result.kind) {
      case "not_found":
        return errorResponse("NOT_FOUND", "Approval not found", 404);
      case "already_resolved":
        return errorResponse("CONFLICT", `This approval was already ${result.status}.`, 409);
      case "stale":
        return errorResponse("CONFLICT", "This run is no longer active, so there is nothing to approve. Start the task again.", 409);
      case "forbidden":
        return errorResponse("FORBIDDEN", result.message, 403);
      case "ok":
        return dataResponse({ approved: result.approved, scopeApplied: result.scopeApplied });
    }
  } catch (error) {
    return routeError(error);
  }
}
