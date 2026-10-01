import { dataResponse, errorResponse } from "@/lib/api/responses";
import type { PlanActionResult } from "./store";
import { getPlan } from "./store";

/** The API response for a plan action: the updated plan on success, the reason otherwise. */
export async function planActionResponse(orgId: string, planId: string, result: PlanActionResult) {
  switch (result.kind) {
    case "not_found":
      return errorResponse("NOT_FOUND", "Plan not found", 404);
    case "conflict":
      return errorResponse("CONFLICT", result.message, 409);
    case "invalid":
      return errorResponse("VALIDATION_ERROR", result.message, 422);
    case "ok":
      return dataResponse({ plan: await getPlan(orgId, planId) });
  }
}
