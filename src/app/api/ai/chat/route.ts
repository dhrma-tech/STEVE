import { NextRequest, NextResponse } from "next/server";
import { ollamaChat, OLLAMA_OFFLINE_MESSAGE } from "@/lib/ai/ollama";

export async function POST(request: NextRequest) {
  try {
    const { messages, systemPrompt } = (await request.json()) as {
      messages: Array<{ role: string; content: string }>;
      systemPrompt?: string;
    };

    if (!messages?.length) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const userMsg = messages.at(-1)?.content ?? "";
    const system = systemPrompt ?? "You are a helpful AI assistant helping founders build and run their company.";

    const content = await ollamaChat({ system, user: userMsg });
    return NextResponse.json({ content, usage: { input_tokens: 0, output_tokens: 0 } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "AI request failed";
    const isOffline = msg.includes("fetch") || msg.includes("ECONNREFUSED") || msg.includes("connect") || msg.includes("timeout");
    return NextResponse.json(
      { error: isOffline ? OLLAMA_OFFLINE_MESSAGE : msg },
      { status: isOffline ? 503 : 500 }
    );
  }
}
