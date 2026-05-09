import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { createSecret } from "@/lib/settings/data";

const secretSchema = z.object({
  key: z.string().trim().min(1).max(80),
  value: z.string().min(1).max(40_000),
  environment: z.enum(["development", "test", "staging", "production"]).default("staging"),
  pushToVercel: z.boolean().default(true)
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = secretSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Secret payload is invalid.", 422, parsed.error.flatten());
    const { orgId } = await context.params;
    return dataResponse(await createSecret({ orgId, ...parsed.data }), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
