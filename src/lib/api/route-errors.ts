import { errorResponse } from "@/lib/api/responses";
import { AuthError, ForbiddenError } from "@/lib/auth/session";
import { AppError, isAppError } from "@/lib/utils/error";

export function routeError(error: unknown) {
  if (error instanceof AuthError) {
    return errorResponse("UNAUTHENTICATED", error.message, 401);
  }
  if (error instanceof ForbiddenError) {
    return errorResponse("FORBIDDEN", error.message, 403);
  }
  if (isAppError(error)) {
     return errorResponse((error.code as any) ?? "INTERNAL", error.message, error.statusCode, error.details);
  }

  // Handle Prisma errors
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string" && error.code.startsWith("P")) {
     return errorResponse("INTERNAL", "A database error occurred.", 500);
  }

  console.error("[Route Error]:", error);

  const message = error instanceof Error ? error.message : "An unexpected error occurred.";
  return errorResponse("INTERNAL", message, 500);
}
