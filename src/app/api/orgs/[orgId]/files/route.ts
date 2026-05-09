import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { createFile, getFileLibraryData } from "@/lib/files/data";

const createFileSchema = z.object({
  name: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().max(180).nullable().optional(),
  sizeBytes: z.number().int().min(0).nullable().optional(),
  folderId: z.string().trim().min(1).nullable().optional(),
  departmentId: z.string().trim().min(1).nullable().optional(),
  taskId: z.string().trim().min(1).nullable().optional(),
  visibility: z.enum(["private", "organization", "department", "task", "shared"]).nullable().optional(),
  content: z.string().max(1_000_000).nullable().optional(),
  source: z.string().trim().max(80).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { searchParams } = new URL(request.url);
    return dataResponse(await getFileLibraryData(orgId, {
      q: searchParams.get("q"),
      folderId: searchParams.get("folderId"),
      departmentId: searchParams.get("departmentId"),
      taskId: searchParams.get("taskId"),
      includeArchived: searchParams.get("includeArchived") === "1"
    }));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = createFileSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "File payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId } = await context.params;
    const file = await createFile({ orgId, ...parsed.data });
    return dataResponse(file, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
