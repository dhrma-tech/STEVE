import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { listOpenQuestions } from "@/lib/agents/policy/approvals";

type RouteContext = { params: Promise<{ orgId: string }> };

/** Questions agents are waiting on the founder to answer (ask_user). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgMember(orgId);
    return dataResponse({ questions: await listOpenQuestions(orgId) });
  } catch (error) {
    return routeError(error);
  }
}
