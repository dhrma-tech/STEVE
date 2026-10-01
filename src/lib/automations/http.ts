import { errorResponse, dataResponse } from "@/lib/api/responses";
import { ApiAuthError } from "./api-keys";
import { reportError } from "@/lib/observability/log";
import { RateLimitError } from "@/lib/security/rate-limit";

/** Turn a public API result or error into a response ({ data } or { error: { code, message } }, like the app API). */
export function apiResponse(result: { ok: true; status: number; data: unknown } | { ok: false; status: number; code: "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT"; message: string }) {
  return result.ok ? dataResponse(result.data, { status: result.status }) : errorResponse(result.code, result.message, result.status);
}

export async function apiError(error: unknown) {
  if (error instanceof RateLimitError) {
    const response = errorResponse("RATE_LIMITED", error.message, 429);
    response.headers.set("Retry-After", String(error.retryAfterSeconds));
    return response;
  }
  if (error instanceof ApiAuthError) return errorResponse(error.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", error.message, error.status);
  await reportError(error, { route: "api/v1" });
  return errorResponse("INTERNAL", "Something went wrong.", 500);
}
