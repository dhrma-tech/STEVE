import { dataResponse, errorResponse } from "@/lib/api/responses";
import type { DecideResult } from "./approval-inbox";

/** The API response for an approval decision, the same wording everywhere approvals are answered. */
export function decideResponse(result: DecideResult) {
  switch (result.kind) {
    case "not_found":
      return errorResponse("NOT_FOUND", "Approval not found", 404);
    case "already_resolved":
      return errorResponse("CONFLICT", `This approval was already ${result.status}.`, 409);
    case "stale":
      return errorResponse("CONFLICT", "The run that asked has ended, so there is nothing to approve.", 409);
    case "forbidden":
      return errorResponse("FORBIDDEN", result.message, 403);
    case "invalid":
      return errorResponse("VALIDATION_ERROR", result.message, 422);
    case "ok":
      return dataResponse({ approved: result.approved, scopeApplied: result.scopeApplied });
  }
}
