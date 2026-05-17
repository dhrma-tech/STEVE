import { type NextRequest, NextResponse } from "next/server";

/**
 * Marketing / auth routes that are ALWAYS light — the preference cookie
 * cannot override these (they are public pages with a fixed light design).
 */
const ALWAYS_LIGHT = [
  "/",
  "/login",
  "/onboarding",
  "/questions",
  "/pricing",
  "/resources",
  "/how-to",
  "/privacy-policy",
  "/terms",
  "/terms-of-service",
  "/docs",
  "/referrals",
];

function isAlwaysLight(pathname: string): boolean {
  if (pathname === "/") return true;
  return ALWAYS_LIGHT.some(
    (prefix) => prefix !== "/" && (pathname === prefix || pathname.startsWith(prefix + "/"))
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  if (isAlwaysLight(pathname)) {
    // Marketing / auth — always light, ignore preference
    response.headers.set("x-theme", "light");
    return response;
  }

  // App shell routes (/org/*, /settings, etc.)
  // Respect the user's stored preference; default to light if none set.
  const preference = request.cookies.get("theme-preference")?.value;
  const theme = preference === "dark" ? "dark" : "light";
  response.headers.set("x-theme", theme);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)",
  ],
};
