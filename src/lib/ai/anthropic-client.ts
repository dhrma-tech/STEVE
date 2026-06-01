import Anthropic from "@anthropic-ai/sdk";

/** Call Anthropic Messages API. Returns the model's reply text, or empty string on failure. */
export async function anthropicChat({
  system,
  user,
  modelId,
  apiKey,
}: {
  system: string;
  user: string;
  modelId: string;
  apiKey: string;
}): Promise<string> {
  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: modelId,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    });

    const block = message.content[0];
    if (block?.type === "text") return block.text.trim();
    return "";
  } catch (err) {
    console.error("[anthropic-client] error:", err);
    return "";
  }
}
