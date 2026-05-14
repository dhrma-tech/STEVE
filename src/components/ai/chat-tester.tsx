"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Usage = {
  input_tokens: number;
  output_tokens: number;
};

export function ChatTester() {
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [lastUsage, setLastUsage] = React.useState<Usage | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: newMessages })
      });

      const payload = (await response.json()) as { content?: string; usage?: Usage; error?: string };

      if (!response.ok || !payload.content) {
        throw new Error(payload.error ?? "Claude did not respond.");
      }

      setMessages([...newMessages, { role: "assistant", content: payload.content }]);
      setLastUsage(payload.usage ?? null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Request failed.";
      console.error("[ChatTester]", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="grid gap-4" style={{ maxWidth: "672px", width: "100%" }}>
      <div
        className="grid content-start gap-3 overflow-y-auto rounded-[12px] border border-[var(--border-10)] p-4"
        style={{ height: "384px" }}
      >
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--foreground-50)]">Send a message to test Claude.</p>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className="max-w-[80%] rounded-[10px] px-3 py-2 text-sm leading-6"
                style={{
                  background: message.role === "user" ? "var(--focused)" : "var(--foreground-8)",
                  color: message.role === "user" ? "#fff" : "var(--foreground-80)"
                }}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
        {loading ? (
          <div className="flex justify-start">
            <div
              className="rounded-[10px] px-3 py-2 text-sm text-[var(--foreground-50)]"
              style={{ background: "var(--foreground-8)" }}
            >
              ...
            </div>
          </div>
        ) : null}
        {error ? (
          <p className="text-xs text-[var(--destructive)]">Error: {error}</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {lastUsage ? (
        <p className="text-xs text-[var(--foreground-50)]">
          Tokens used: input={lastUsage.input_tokens}, output={lastUsage.output_tokens}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Input
          label="Message"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Ask Claude anything..."
          className="flex-1"
        />
        <Button variant="app" onClick={() => void handleSend()} disabled={loading || !input.trim()}>
          {loading ? "..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
