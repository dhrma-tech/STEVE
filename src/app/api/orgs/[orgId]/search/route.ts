import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { groupedSearch, parseSearchTypes } from "@/lib/search/grouped-search";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgMember(orgId);
    const url = new URL(request.url);
    const groups = await groupedSearch({
      orgId,
      q: url.searchParams.get("q") ?? "",
      types: parseSearchTypes(url.searchParams.get("types"))
    });

    return dataResponse({ groups });
  } catch (error) {
    return routeError(error);
  }
}
