import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { createAgent, getAgentWorkspaceData } from "@/lib/agents/data";

const createAgentSchema = z.object({
  departmentId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  model: z.string().trim().max(120).nullable().optional(),
  prompt: z.string().trim().max(4000).nullable().optional(),
  skillKeys: z.array(z.string().trim().min(1)).default([]),
  permissionMode: z.enum(["review_required", "sandbox_only", "trusted"]).default("review_required"),
  inboxAddress: z.string().trim().max(180).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { searchParams } = new URL(request.url);
    return dataResponse(await getAgentWorkspaceData(orgId, {
      departmentId: searchParams.get("departmentId"),
      status: searchParams.get("status"),
      q: searchParams.get("q")
    }));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = createAgentSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Agent payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId } = await context.params;
    const agent = await createAgent({ orgId, ...parsed.data });
    return agent ? dataResponse(agent, { status: 201 }) : errorResponse("NOT_FOUND", "Department not found", 404);
  } catch (error) {
    return routeError(error);
  }
}

