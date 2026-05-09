import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { switchOwnRepo } from "@/lib/settings/data";

const switchRepoSchema = z.object({
  repoUrl: z.url().max(300),
  confirmation: z.string().trim()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = switchRepoSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Repo switch payload is invalid.", 422, parsed.error.flatten());
    const { orgId } = await context.params;
    const result = await switchOwnRepo({ orgId, ...parsed.data });
    if (!result.ok) return errorResponse("VALIDATION_ERROR", result.reason, 422);
    return dataResponse(result.data);
  } catch (error) {
    return routeError(error);
  }
}
