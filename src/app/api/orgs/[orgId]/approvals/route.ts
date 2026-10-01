import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { listPendingApprovals } from "@/lib/agents/policy/approval-inbox";
import { listOpenQuestions } from "@/lib/agents/policy/approvals";

type RouteContext = { params: Promise<{ orgId: string }> };

/** The approvals inbox: tool calls waiting for a person, and agents' open questions. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { membership } = await requireOrgMember(orgId);
    const [approvals, questions] = await Promise.all([listPendingApprovals(orgId), listOpenQuestions(orgId)]);
    return dataResponse({ approvals, questions, role: membership.role });
  } catch (error) {
    return routeError(error);
  }
}
