import { NextResponse } from "next/server";

function redirectToTerms(request: Request) {
  return NextResponse.redirect(new URL("/terms", request.url), 307);
}

export function GET(request: Request) {
  return redirectToTerms(request);
}

export function HEAD(request: Request) {
  return redirectToTerms(request);
}

