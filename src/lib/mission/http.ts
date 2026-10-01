import { dataResponse, errorResponse } from "@/lib/api/responses";
import type { RunActionResult } from "./data";

export function runActionResponse<T>(result: RunActionResult<T>, notFound = "Run not found") {
  switch (result.kind) {
    case "not_found":
      return errorResponse("NOT_FOUND", notFound, 404);
    case "conflict":
      return errorResponse("CONFLICT", result.message, 409);
    case "ok":
      return dataResponse(result.value ?? { ok: true });
  }
}
