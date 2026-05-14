import { errorResponse, type ApiErrorCode } from "@/lib/api/responses";
import { AuthError, ForbiddenError } from "@/lib/auth/session";
import { isAppError } from "@/lib/utils/error";

const KNOWN_API_ERROR_CODES = new Set<ApiErrorCode>([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "INTERNAL",
]);

function normalizeCode(code: string | undefined): ApiErrorCode {
  if (code && (KNOWN_API_ERROR_CODES as Set<string>).has(code)) {
    return code as ApiErrorCode;
  }
  return "INTERNAL";
}

export function routeError(error: unknown) {
  if (error instanceof AuthError) {
    return errorResponse("UNAUTHENTICATED", error.message, 401);
  }
  if (error instanceof ForbiddenError) {
    return errorResponse("FORBIDDEN", error.message, 403);
  }
  if (isAppError(error)) {
    return errorResponse(normalizeCode(error.code), error.message, error.statusCode, error.details);
  }

  // Handle Prisma errors
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string" && error.code.startsWith("P")) {
     return errorResponse("INTERNAL", "A database error occurred.", 500);
  }

  console.error("[Route Error]:", error);

  const message = error instanceof Error ? error.message : "An unexpected error occurred.";
  return errorResponse("INTERNAL", message, 500);
}
