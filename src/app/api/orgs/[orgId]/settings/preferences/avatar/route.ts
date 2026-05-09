import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { updateAvatarSettings } from "@/lib/settings/data";

const avatarSchema = z.object({
  name: z.string().trim().min(1).max(180),
  mimeType: z.literal("image/webp"),
  sizeBytes: z.number().int().min(1).max(5 * 1024 * 1024),
  dataUrl: z.string().max(7_000_000).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = avatarSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Avatar must be a WebP image under 5MB.", 422, parsed.error.flatten());
    }
    const { orgId } = await context.params;
    const result = await updateAvatarSettings({ orgId, ...parsed.data });
    if (!result.ok) return errorResponse("VALIDATION_ERROR", result.reason, 422);
    return dataResponse(result.data);
  } catch (error) {
    return routeError(error);
  }
}
