import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgAdmin } from "@/lib/auth/session";
import { isOAuthProvider, OAUTH_NONCE_COOKIE, oauthAvailable, startOAuth } from "@/lib/integrations/oauth";

type RouteContext = { params: Promise<{ orgId: string; provider: string }> };

/** Start connecting an integration with the provider's own sign-in (owners and admins). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId, provider } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    if (!isOAuthProvider(provider) || !oauthAvailable(provider)) {
      return errorResponse("NOT_FOUND", "Sign-in for this integration is not set up on this server.", 404);
    }
    const { url, nonce } = startOAuth({ orgId, userId: user.id, provider });
    const response = NextResponse.redirect(url);
    response.cookies.set(OAUTH_NONCE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/oauth",
      maxAge: 600
    });
    return response;
  } catch (error) {
    return routeError(error);
  }
}
