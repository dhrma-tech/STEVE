"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

type Message = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT =
  "You are an AI startup advisor inside a company-building platform called Cofounder. " +
  "When the founder describes their idea, ask ONE clarifying question at a time about: " +
  "target market, problem being solved, competition, monetization model, or founding team. " +
  "Keep responses concise and actionable. After gathering context, give concrete next steps.";

export function AdvisorChat({ orgName }: { orgName: string }) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, systemPrompt: SYSTEM_PROMPT })
      });
      const payload = (await response.json()) as { content?: string; error?: string };
      if (payload.content) {
        setMessages([...next, { role: "assistant", content: payload.content }]);
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <section className="grid gap-2 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Ask Cofounder</h3>
        <span className="rounded-full bg-[var(--focused)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white">AI</span>
      </div>
      <div className="flex max-h-[240px] min-h-[80px] flex-col gap-2 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-[var(--foreground-50)]">Describe your idea for {orgName} and I&apos;ll help you refine it.</p>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[85%] rounded-[8px] px-2.5 py-1.5 text-xs leading-5"
                style={{
                  background: message.role === "user" ? "var(--primary)" : "var(--foreground-8)",
                  color: message.role === "user" ? "var(--primary-foreground)" : "var(--foreground-80)"
                }}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
        {loading ? (
          <div className="flex justify-start">
            <div className="rounded-[8px] bg-[var(--foreground-8)] px-2.5 py-1.5 text-xs text-[var(--foreground-50)]">...</div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your startup idea..."
          disabled={loading}
          rows={2}
          className="flex-1 resize-none rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-5)] px-2.5 py-2 text-xs text-[var(--foreground-80)] placeholder:text-[var(--foreground-50)] focus:outline-none focus:ring-1 focus:ring-[var(--focused)] disabled:opacity-50"
        />
        <Button
          variant="app"
          size="sm"
          className="self-end"
          onClick={() => void handleSend()}
          disabled={loading || !input.trim()}
        >
          <Send aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
    </section>
  );
}
