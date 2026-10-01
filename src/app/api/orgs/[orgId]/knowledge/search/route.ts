import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { searchKnowledge } from "@/lib/knowledge/search";

type RouteContext = { params: Promise<{ orgId: string }> };

/** Full-text search over the company's files, chat, past work and memory. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgMember(orgId);
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    if (q.length < 3) return errorResponse("VALIDATION_ERROR", "Search for at least 3 characters.", 422);
    const limit = Number(url.searchParams.get("limit") ?? 10);
    return dataResponse({ hits: await searchKnowledge({ orgId, query: q, limit: Number.isFinite(limit) ? limit : 10 }) });
  } catch (error) {
    return routeError(error);
  }
}
