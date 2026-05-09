import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { createChatThread, getChatWorkspaceData } from "@/lib/chat/data";

const createThreadSchema = z.object({
  kind: z.enum(["cofounder", "task", "department"]).default("cofounder"),
  title: z.string().trim().max(180).nullable().optional(),
  taskId: z.string().trim().min(1).nullable().optional(),
  agentId: z.string().trim().min(1).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { searchParams } = new URL(request.url);
    return dataResponse(await getChatWorkspaceData(orgId, {
      kind: searchParams.get("kind"),
      taskId: searchParams.get("taskId"),
      agentId: searchParams.get("agentId"),
      q: searchParams.get("q")
    }));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = createThreadSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Chat thread payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId } = await context.params;
    return dataResponse(await createChatThread({ orgId, ...parsed.data }), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
