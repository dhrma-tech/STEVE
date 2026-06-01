import OpenAI from "openai";

/** Call OpenAI Chat Completions API. Returns the model's reply text, or empty string on failure. */
export async function openaiChat({
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
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: modelId,
      max_tokens: 2048,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    return completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("[openai-client] error:", err);
    return "";
  }
}
