import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getFileDetail, updateFile } from "@/lib/files/data";

const updateFileSchema = z.object({
  name: z.string().trim().min(1).max(180).nullable().optional(),
  folderId: z.string().trim().min(1).nullable().optional(),
  departmentId: z.string().trim().min(1).nullable().optional(),
  taskId: z.string().trim().min(1).nullable().optional(),
  visibility: z.enum(["private", "organization", "department", "task", "shared"]).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string; fileId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId, fileId } = await context.params;
    const file = await getFileDetail(orgId, fileId);
    if (!file) {
      return errorResponse("NOT_FOUND", "File not found.", 404);
    }

    return dataResponse(file);
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const parsed = updateFileSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "File update payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, fileId } = await context.params;
    const file = await updateFile({ orgId, fileId, ...parsed.data });
    if (!file) {
      return errorResponse("NOT_FOUND", "File not found.", 404);
    }

    return dataResponse(file);
  } catch (error) {
    return routeError(error);
  }
}
