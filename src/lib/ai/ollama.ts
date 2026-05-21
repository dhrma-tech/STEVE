/**
 * Shared Ollama client for all AI features.
 * Model: mistral:latest — running natively on Windows via `ollama serve` in PowerShell.
 * Default port: 11434 (Ollama default). Set OLLAMA_URL in .env.local to override.
 */

export const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
export const OLLAMA_MODEL = "mistral:latest";
export const OLLAMA_TIMEOUT_MS = 600000;

export const OLLAMA_OFFLINE_MESSAGE =
  "AI is offline. Make sure Ollama is running: open PowerShell and run `ollama serve`, then retry.";

/**
 * Call Ollama chat completion. Returns the model's reply text, or empty string on failure.
 * Throws only when the caller needs to handle the error explicitly.
 */
export async function ollamaChat({
  system,
  user,
  timeoutMs = OLLAMA_TIMEOUT_MS
}: {
  system: string;
  user: string;
  timeoutMs?: number;
}): Promise<string> {
  const res = await Promise.race([
    fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Ollama timeout")), timeoutMs)
    )
  ]) as Response;

  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content?.trim() ?? "";
}

/** Silent version — returns empty string instead of throwing. */
export async function ollamaChatSafe(opts: {
  system: string;
  user: string;
  timeoutMs?: number;
}): Promise<string> {
  try {
    return await ollamaChat(opts);
  } catch {
    return "";
  }
}
