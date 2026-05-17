import { NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";

export async function GET() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          status: "down",
          message: "Ollama server not responding",
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    const data = (await response.json()) as { models?: Array<{ name: string }> };

    return NextResponse.json({
      status: "up",
      models: data.models?.map((m) => m.name) ?? [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot connect to Ollama";
    return NextResponse.json(
      {
        status: "down",
        message: "Cannot connect to Ollama",
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
