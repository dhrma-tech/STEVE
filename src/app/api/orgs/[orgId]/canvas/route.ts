import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getCanvasData } from "@/lib/canvas/data";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const canvas = await getCanvasData(orgId);
    return dataResponse(canvas);
  } catch (error) {
    return routeError(error);
  }
}
