import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { upgradeBillingPlan } from "@/lib/billing/data";

const upgradeSchema = z.object({
  plan: z.enum(["pro", "team"]),
  confirmed: z.boolean()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = upgradeSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Billing upgrade payload is invalid.", 422, parsed.error.flatten());
    const { orgId } = await context.params;
    const result = await upgradeBillingPlan({ orgId, ...parsed.data });
    if (!result.ok) return errorResponse("VALIDATION_ERROR", result.reason, 422);
    return dataResponse(result.data);
  } catch (error) {
    return routeError(error);
  }
}
