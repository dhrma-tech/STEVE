import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { departmentNotFoundResponse, updateDepartmentContext } from "@/lib/departments/data";

const contextSchema = z.object({
  contextJson: z.record(z.string(), z.unknown())
});

type RouteContext = { params: Promise<{ orgId: string; departmentId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const parsed = contextSchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid department context payload", 422, parsed.error.flatten());
    }

    const { orgId, departmentId } = await context.params;
    const department = await updateDepartmentContext({
      orgId,
      departmentId,
      contextJson: parsed.data.contextJson
    });

    return department ? dataResponse(department) : departmentNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}
