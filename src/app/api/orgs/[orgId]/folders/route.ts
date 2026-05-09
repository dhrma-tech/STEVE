import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { createFolder, getFileLibraryData } from "@/lib/files/data";

const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(180),
  parentFolderId: z.string().trim().min(1).nullable().optional(),
  departmentId: z.string().trim().min(1).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { searchParams } = new URL(request.url);
    const data = await getFileLibraryData(orgId, {
      q: searchParams.get("q"),
      folderId: searchParams.get("folderId"),
      departmentId: searchParams.get("departmentId")
    });

    return dataResponse({ folders: data.folders, stats: data.stats, generalFolderId: data.generalFolderId });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = createFolderSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Folder payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId } = await context.params;
    const folder = await createFolder({ orgId, ...parsed.data });
    return dataResponse(folder, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
