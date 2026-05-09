import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { departmentNotFoundResponse, getDepartmentDetail } from "@/lib/departments/data";

type RouteContext = { params: Promise<{ orgId: string; departmentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId, departmentId } = await context.params;
    const department = await getDepartmentDetail(orgId, departmentId);
    return department ? dataResponse(department) : departmentNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}
