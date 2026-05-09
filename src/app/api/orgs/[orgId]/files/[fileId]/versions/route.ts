import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { addFileVersion } from "@/lib/files/data";

const addVersionSchema = z.object({
  name: z.string().trim().min(1).max(180).nullable().optional(),
  mimeType: z.string().trim().max(180).nullable().optional(),
  sizeBytes: z.number().int().min(0).nullable().optional(),
  content: z.string().max(1_000_000).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string; fileId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = addVersionSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Version payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, fileId } = await context.params;
    const file = await addFileVersion({ orgId, fileId, ...parsed.data });
    if (!file) {
      return errorResponse("NOT_FOUND", "File not found.", 404);
    }

    return dataResponse(file, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
