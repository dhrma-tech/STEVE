import { NextResponse } from "next/server";

const COLAB_URL = process.env.COLAB_API_URL || "http://localhost:5000";

export async function GET() {
  try {
    const response = await fetch(`${COLAB_URL}/api/health`, {
      method: "GET",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          status: "down",
          message: "Colab server not responding",
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    const data = (await response.json()) as Record<string, unknown>;

    return NextResponse.json({
      status: "up",
      colab: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot connect to Colab server";
    return NextResponse.json(
      {
        status: "down",
        message,
        error: "Cannot connect to Colab server",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
