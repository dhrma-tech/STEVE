import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { importOrganizationContext } from "@/lib/settings/data";

const contextImportSchema = z.object({
  source: z.enum(["ChatGPT", "Claude", "Paperclip", "OpenClaw", "Other"]),
  content: z.string().trim().min(1).max(12_000)
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = contextImportSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Context import payload is invalid.", 422, parsed.error.flatten());
    const { orgId } = await context.params;
    return dataResponse(await importOrganizationContext({ orgId, ...parsed.data }), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
