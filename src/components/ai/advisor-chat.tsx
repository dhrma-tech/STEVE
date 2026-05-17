"use client";

import * as React from "react";
import { ArrowUp, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";

type Message = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT =
  "You are an AI agent builder inside a company-building platform called Cofounder. " +
  "The founder has already defined their idea and set up their company. " +
  "Help them create, configure, and launch AI agents for specific tasks: " +
  "engineering, marketing, sales, design, support, finance, operations, or research. " +
  "Ask ONE focused question at a time. Be direct and actionable. " +
  "Suggest concrete agent names, goals, and workflows.";

const CHIPS = ["Engineering", "Marketing", "Sales", "Support", "Design"];

export function AdvisorChat({ orgName }: { orgName: string }) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(text?: string) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || loading) return;

    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "28px";
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, systemPrompt: SYSTEM_PROMPT })
      });
      const payload = (await response.json()) as { content?: string; error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "Request failed.");
        setMessages(next);
        return;
      }
      if (payload.content) {
        setMessages([...next, { role: "assistant", content: payload.content }]);
      }
    } catch {
      toast.error("Couldn't reach the agent.");
      setMessages(next);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  }

  return (
    <section className="overflow-hidden rounded-[14px] border border-[var(--border-10)] bg-[var(--foreground-3)]">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-10)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded-[5px] bg-[var(--foreground-10)]">
            <Zap className="size-3 text-[var(--foreground-60)]" />
          </span>
          <p className="text-xs font-semibold tracking-wide text-[var(--foreground-70)]">
            BUILD AN AGENT
          </p>
        </div>
        <p className="font-mono text-[10px] text-[var(--foreground-30)]">{orgName}</p>
      </div>

      {/* Messages / empty state */}
      <div className="flex max-h-[190px] min-h-[68px] flex-col gap-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="grid gap-3">
            <p className="text-xs leading-5 text-[var(--foreground-50)]">
              Your company is set up. Create an agent to automate your first workflow.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void handleSend(`Create a ${chip} agent`)}
                  className="rounded-[6px] border border-[var(--border-10)] bg-[var(--foreground-5)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground-50)] transition-all duration-150 hover:border-[var(--foreground-20)] hover:text-[var(--foreground-80)] active:scale-95"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[86%] rounded-[10px] px-3 py-2 text-xs leading-5",
                msg.role === "user"
                  ? "rounded-tr-[3px] bg-[var(--foreground-10)] text-[var(--foreground-80)]"
                  : "rounded-tl-[3px] border border-[var(--border-10)] bg-[var(--background-l0)] text-[var(--foreground-70)]"
              )}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        {loading ? (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--foreground-30)]">
            <Loader2 className="size-3 animate-spin" />
            Working…
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 border-t border-[var(--border-10)] px-3 py-2.5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder="Describe the agent you need…"
          disabled={loading}
          rows={1}
          className="flex-1 resize-none bg-transparent text-xs text-[var(--foreground-80)] placeholder:text-[var(--foreground-30)] focus:outline-none disabled:opacity-50"
          style={{ minHeight: "28px", maxHeight: "100px" }}
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={loading || !input.trim()}
          className="mb-0.5 grid size-6 shrink-0 place-items-center rounded-[6px] bg-[var(--foreground-10)] text-[var(--foreground-60)] transition-all duration-150 hover:bg-[var(--foreground-15)] hover:text-[var(--foreground-80)] active:scale-90 disabled:opacity-30"
        >
          <ArrowUp className="size-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </section>
  );
}
