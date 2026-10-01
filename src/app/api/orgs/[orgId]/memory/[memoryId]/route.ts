import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgWriter } from "@/lib/auth/session";
import { deleteMemory, MAX_VALUE_LENGTH, updateMemory } from "@/lib/memory/store";

const patchSchema = z
  .object({
    value: z.string().trim().min(1).max(MAX_VALUE_LENGTH).optional(),
    key: z.string().trim().min(1).max(120).optional(),
    scope: z.string().trim().min(1).max(120).optional(),
    /** Accept a proposed memory so agents start using it. */
    approve: z.boolean().optional()
  })
  .refine((body) => Object.keys(body).length > 0, "Nothing to change.");

type RouteContext = { params: Promise<{ orgId: string; memoryId: string }> };

/** Edit a memory (the old value is kept in its history) or approve a proposed one. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { orgId, memoryId } = await context.params;
    const { user } = await requireOrgWriter(orgId);
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "The change is invalid.", 422, parsed.error.flatten());
    const result = await updateMemory({ orgId, id: memoryId, userId: user.id, ...parsed.data });
    if (result.kind === "not_found") return errorResponse("NOT_FOUND", "Memory not found", 404);
    if (result.kind === "invalid") return errorResponse("VALIDATION_ERROR", result.message, 422);
    return dataResponse({ memory: result.memory });
  } catch (error) {
    return routeError(error);
  }
}

/** Forget a memory (or reject a proposed one). */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { orgId, memoryId } = await context.params;
    await requireOrgWriter(orgId);
    if (!(await deleteMemory(orgId, memoryId))) return errorResponse("NOT_FOUND", "Memory not found", 404);
    return dataResponse({ deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
