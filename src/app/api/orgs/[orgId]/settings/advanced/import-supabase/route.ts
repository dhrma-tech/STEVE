import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { importOwnSupabase } from "@/lib/settings/data";

const importSupabaseSchema = z.object({
  projectUrl: z.url().max(300),
  confirmation: z.string().trim()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = importSupabaseSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Supabase import payload is invalid.", 422, parsed.error.flatten());
    const { orgId } = await context.params;
    const result = await importOwnSupabase({ orgId, ...parsed.data });
    if (!result.ok) return errorResponse("VALIDATION_ERROR", result.reason, 422);
    return dataResponse(result.data);
  } catch (error) {
    return routeError(error);
  }
}
