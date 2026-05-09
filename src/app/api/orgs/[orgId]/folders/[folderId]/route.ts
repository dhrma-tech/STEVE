import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { updateFolder } from "@/lib/files/data";

const updateFolderSchema = z.object({
  name: z.string().trim().min(1).max(180).nullable().optional(),
  parentFolderId: z.string().trim().min(1).nullable().optional(),
  departmentId: z.string().trim().min(1).nullable().optional(),
  archived: z.boolean().optional()
});

type RouteContext = { params: Promise<{ orgId: string; folderId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const parsed = updateFolderSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Folder update payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, folderId } = await context.params;
    const folder = await updateFolder({ orgId, folderId, ...parsed.data });
    if (!folder) {
      return errorResponse("NOT_FOUND", "Folder not found.", 404);
    }

    return dataResponse(folder);
  } catch (error) {
    return routeError(error);
  }
}
