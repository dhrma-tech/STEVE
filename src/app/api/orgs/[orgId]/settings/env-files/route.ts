import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getEnvFilesSettings, uploadEnvFile } from "@/lib/settings/data";

const envFileSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  content: z.string().min(1).max(200_000),
  environment: z.enum(["development", "test", "staging", "production"]).default("staging"),
  pushToVercel: z.boolean().default(true)
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    return dataResponse(await getEnvFilesSettings(orgId));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = envFileSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Env file payload is invalid.", 422, parsed.error.flatten());
    const { orgId } = await context.params;
    return dataResponse(await uploadEnvFile({ orgId, ...parsed.data }), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
