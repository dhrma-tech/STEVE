import { NextResponse } from "next/server";
import { receiveInbound } from "@/lib/automations/triggers";
import { reportError } from "@/lib/observability/log";

type RouteContext = { params: Promise<{ token: string }> };

/**
 * Inbound endpoint for event triggers (Stripe, Sentry, GitHub, support, email, any webhook). The token in the URL
 * identifies the trigger; the provider signature is checked when the trigger has a signing secret.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const rawBody = await request.text();
    if (rawBody.length > 512_000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
    const result = await receiveInbound({ token, headers: request.headers, rawBody });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    await reportError(error, { route: "hooks" });
    return NextResponse.json({ error: "Could not process the event." }, { status: 500 });
  }
}
