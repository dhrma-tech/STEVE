import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      systemPrompt?: string;
    };
    const { messages, systemPrompt } = body;

    if (!messages?.length) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    const system = systemPrompt ?? "You are a helpful AI assistant.";

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" }
        }
      ],
      messages
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text response from Claude" }, { status: 500 });
    }

    return NextResponse.json({
      content: textBlock.text,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0
      }
    });
  } catch (error) {
    const message = error instanceof Anthropic.APIError
      ? `Claude API error (${error.status}): ${error.message}`
      : error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
