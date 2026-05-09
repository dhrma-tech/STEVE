import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { launchRoadmapItem, roadmapNotFoundResponse } from "@/lib/roadmap/data";

const launchSchema = z.object({
  input: z.string().trim().max(4000).nullable().optional(),
  agentId: z.string().trim().min(1).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string; itemId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = launchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Roadmap launch payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, itemId } = await context.params;
    const result = await launchRoadmapItem({
      orgId,
      itemId,
      input: parsed.data.input,
      agentId: parsed.data.agentId
    });

    if (result.kind === "not_found") {
      return roadmapNotFoundResponse();
    }

    if (result.kind === "blocked") {
      return errorResponse("CONFLICT", "This roadmap item needs earlier steps first.", 409, result);
    }

    if (result.kind === "input_required") {
      return errorResponse("CONFLICT", "This roadmap item needs founder input before launch.", 409, result);
    }

    return dataResponse(result);
  } catch (error) {
    return routeError(error);
  }
}
