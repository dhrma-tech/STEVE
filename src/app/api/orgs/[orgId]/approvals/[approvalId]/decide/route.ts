import { z } from "zod";
import { errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgWriter } from "@/lib/auth/session";
import { decideApproval } from "@/lib/agents/policy/approval-inbox";
import { decideResponse } from "@/lib/agents/policy/decide-response";

const decideSchema = z.object({
  action: z.enum(["approve", "deny"]),
  /** once: this call. run: also later calls of this tool in this run. always: this agent, from now on (admins). */
  scope: z.enum(["once", "run", "always"]).default("once"),
  /** Edit & approve: the arguments to run instead of the agent's. */
  editedInput: z.record(z.string(), z.unknown()).nullable().optional(),
  note: z.string().trim().max(500).optional()
});

type RouteContext = { params: Promise<{ orgId: string; approvalId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId, approvalId } = await context.params;
    const { user, membership } = await requireOrgWriter(orgId);
    const parsed = decideSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "action is required", 422, parsed.error.flatten());
    return decideResponse(
      await decideApproval({ orgId, approvalId, userId: user.id, role: membership.role, ...parsed.data, editedInput: parsed.data.editedInput ?? null })
    );
  } catch (error) {
    return routeError(error);
  }
}
