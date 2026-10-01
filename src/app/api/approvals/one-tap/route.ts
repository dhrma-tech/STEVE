import { z } from "zod";
import { errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { redeemOneTap } from "@/lib/agents/policy/approval-inbox";
import { decideResponse } from "@/lib/agents/policy/decide-response";

const schema = z.object({ token: z.string().min(10).max(2000) });

/**
 * Carry out a one-tap approve or deny from an email. The signed token is the authorization (no session needed); it
 * names the approval, the decision and the person, expires, and works once. Only POST acts, from the confirmation
 * page, so a link scanner that opens the link changes nothing.
 */
export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "A token is required.", 422);
    return decideResponse(await redeemOneTap(parsed.data.token));
  } catch (error) {
    return routeError(error);
  }
}
