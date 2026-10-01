import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgWriter } from "@/lib/auth/session";
import { answerQuestion } from "@/lib/agents/policy/approvals";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const answerSchema = z.object({ answer: z.string().trim().min(1).max(4000) });

type RouteContext = { params: Promise<{ orgId: string; approvalId: string }> };

/** Answer an agent's question. The run that asked continues with the answer. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId, approvalId } = await context.params;
    const { user } = await requireOrgWriter(orgId);
    await enforceRateLimit("approval", `user:${user.id}`);
    const parsed = answerSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "answer is required", 422, parsed.error.flatten());

    const result = await answerQuestion({ orgId, approvalId, userId: user.id, answer: parsed.data.answer });
    switch (result.kind) {
      case "not_found":
        return errorResponse("NOT_FOUND", "Question not found", 404);
      case "already_resolved":
        return errorResponse("CONFLICT", `This question was already ${result.status === "approved" ? "answered" : result.status}.`, 409);
      case "stale":
        return errorResponse("CONFLICT", "The agent that asked is no longer running.", 409);
      case "ok":
        return dataResponse({ answered: true });
    }
  } catch (error) {
    return routeError(error);
  }
}
