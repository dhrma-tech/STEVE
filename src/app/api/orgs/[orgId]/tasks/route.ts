import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { createTask, getTaskWorkspaceData } from "@/lib/tasks/data";

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(8000).nullable().optional(),
  departmentId: z.string().trim().min(1).nullable().optional(),
  agentId: z.string().trim().min(1).nullable().optional(),
  assignedUserId: z.string().trim().min(1).nullable().optional(),
  roadmapItemId: z.string().trim().min(1).nullable().optional(),
  type: z.enum(["agent_task", "user_task", "approval_task"]).default("agent_task"),
  executeMode: z.enum(["queue", "now", "draft"]).default("queue"),
  autoAssign: z.boolean().default(true),
  appTarget: z.string().trim().max(80).nullable().optional(),
  priority: z.number().int().min(0).max(3).nullable().optional(),
  dueAt: z.string().trim().nullable().optional(),
  fileIds: z.array(z.string().trim().min(1)).default([]),
  attachmentNames: z.array(z.string().trim().min(1).max(240)).default([]),
  source: z.string().trim().max(80).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { searchParams } = new URL(request.url);
    return dataResponse(await getTaskWorkspaceData(orgId, {
      status: searchParams.get("status"),
      departmentId: searchParams.get("departmentId"),
      agentId: searchParams.get("agentId"),
      assigneeId: searchParams.get("assigneeId"),
      type: searchParams.get("type"),
      view: searchParams.get("view"),
      q: searchParams.get("q")
    }));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = createTaskSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Task payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId } = await context.params;
    const task = await createTask({ orgId, ...parsed.data });
    return dataResponse(task, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

