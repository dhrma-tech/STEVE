import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { addPostizChannel } from "@/lib/integrations/data";

const channelSchema = z.object({
  channelType: z.string().trim().min(1).max(40),
  displayName: z.string().trim().min(1).max(80)
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = channelSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Postiz channel payload is invalid.", 422, parsed.error.flatten());
    const { orgId } = await context.params;
    return dataResponse(await addPostizChannel({ orgId, ...parsed.data }), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
