import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    data: {
      ok: true,
      phase: "final-graduation-audit",
      timestamp: new Date().toISOString()
    }
  });
}

