import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getFileDetail } from "@/lib/files/data";

type RouteContext = { params: Promise<{ orgId: string; fileId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId, fileId } = await context.params;
    const file = await getFileDetail(orgId, fileId);
    if (!file) {
      return errorResponse("NOT_FOUND", "File not found.", 404);
    }

    return dataResponse({ fileId: file.id, preview: file.preview, versions: file.versions });
  } catch (error) {
    return routeError(error);
  }
}
