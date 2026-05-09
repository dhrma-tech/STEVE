import { errorResponse } from "@/lib/api/responses";
import { AuthError, ForbiddenError } from "@/lib/auth/session";

export function routeError(error: unknown) {
  if (error instanceof AuthError) {
    return errorResponse("UNAUTHENTICATED", error.message, 401);
  }
  if (error instanceof ForbiddenError) {
    return errorResponse("FORBIDDEN", error.message, 403);
  }
  throw error;
}
