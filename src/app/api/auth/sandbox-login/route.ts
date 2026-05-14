import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { destinationForSession, getSession, setSessionCookie } from "@/lib/auth/session";
import { findOrCreateSandboxUser } from "@/lib/auth/sandbox";
import { isSandboxLoginEnabled } from "@/lib/auth/policy";

const sandboxLoginSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(80),
  email: z.email().max(180)
});

export async function POST(request: Request) {
  if (!isSandboxLoginEnabled()) {
    return errorResponse("NOT_FOUND", "Not found.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = sandboxLoginSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", "Sandbox login input is invalid.", 400, parsed.error.flatten());
  }

  const user = await findOrCreateSandboxUser(parsed.data);
  await setSessionCookie(user.id);
  const session = await getSession();

  return dataResponse({
    ...session,
    nextRoute: destinationForSession(session)
  });
}

