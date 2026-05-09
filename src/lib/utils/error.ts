/**
 * Standardized API Error Utility
 * Helps map technical errors (Prisma, Auth, Fetch) to user-facing messages.
 */

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Maps common errors to AppError
 */
export function mapError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (error instanceof Error) {
    // Handle Prisma specific errors if needed (e.g. P2002)
    if ((error as any).code?.startsWith("P")) {
       return new AppError("A database error occurred.", 500, "DATABASE_ERROR");
    }

    if (error.message.includes("not authenticated") || error.message.includes("require")) {
      return new AppError(error.message, 401, "AUTH_ERROR");
    }

    return new AppError(error.message, 500, "INTERNAL_ERROR");
  }

  return new AppError("An unexpected error occurred.", 500, "UNKNOWN_ERROR");
}

/**
 * Standard API Error Response structure
 */
export type ApiErrorResponse = {
  error: {
    message: string;
    code?: string;
    details?: any;
  };
};

export function createErrorResponse(error: unknown) {
  const mapped = mapError(error);
  return Response.json(
    {
      error: {
        message: mapped.message,
        code: mapped.code,
        details: mapped.details,
      },
    } satisfies ApiErrorResponse,
    { status: mapped.statusCode }
  );
}
