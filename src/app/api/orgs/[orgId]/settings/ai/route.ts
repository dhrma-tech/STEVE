import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getAiSettings, updateAiSettings } from "@/lib/settings/data";

const aiSchema = z.object({
  suggestedTasksEnabled: z.boolean().nullable().optional(),
  queueMessagesEnabled: z.boolean().nullable().optional(),
  reviewBotMode: z.enum(["blockers_only", "every_change", "off"]).nullable().optional(),
  promptPersonalization: z.string().max(2000).nullable().optional(),
  aiModel: z.enum(["claude-sonnet-sandbox", "gpt-5.4-sandbox", "gpt-5.4-mini-sandbox"]).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    return dataResponse(await getAiSettings(orgId));
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const parsed = aiSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "AI settings payload is invalid.", 422, parsed.error.flatten());
    const { orgId } = await context.params;
    return dataResponse(await updateAiSettings({ orgId, ...parsed.data }));
  } catch (error) {
    return routeError(error);
  }
}
