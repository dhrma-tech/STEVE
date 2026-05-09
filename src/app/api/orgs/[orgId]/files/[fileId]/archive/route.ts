import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { archiveFile } from "@/lib/files/data";

type RouteContext = { params: Promise<{ orgId: string; fileId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId, fileId } = await context.params;
    const file = await archiveFile({ orgId, fileId });
    if (!file) {
      return errorResponse("NOT_FOUND", "File not found.", 404);
    }

    return dataResponse(file);
  } catch (error) {
    return routeError(error);
  }
}
