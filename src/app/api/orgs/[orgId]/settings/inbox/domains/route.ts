import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { createInboxDomain } from "@/lib/settings/data";

const domainSchema = z.object({ domain: z.string().trim().min(3).max(180) });

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = domainSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Domain payload is invalid.", 422, parsed.error.flatten());
    const { orgId } = await context.params;
    return dataResponse(await createInboxDomain({ orgId, ...parsed.data }), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
