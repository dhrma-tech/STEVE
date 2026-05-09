import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { assignAgentInbox } from "@/lib/settings/data";

const addressSchema = z.object({
  agentId: z.string().trim().min(1),
  address: z.email().max(180)
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = addressSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Agent inbox payload is invalid.", 422, parsed.error.flatten());
    const { orgId } = await context.params;
    const data = await assignAgentInbox({ orgId, ...parsed.data });
    if (!data) return errorResponse("NOT_FOUND", "Agent not found.", 404);
    return dataResponse(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
