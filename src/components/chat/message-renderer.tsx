"use client";

import * as React from "react";
import { Code2, Sparkles, TerminalSquare } from "lucide-react";
import type { ChatMessage } from "@/components/chat/types";
import { cn } from "@/lib/utils/cn";

export function MessageList({
  messages,
  streaming = false
}: {
  messages: ChatMessage[];
  streaming?: boolean;
}) {
  return (
    <div className="grid gap-4 py-2">
      {messages.map((message) => (
        <ChatMessageBubble key={message.id} message={message} />
      ))}
      {streaming ? <TypingIndicator /> : null}
    </div>
  );
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const metadata = message.metadata as { kind?: string };
  const isUser = message.senderType === "user";

  if (metadata.kind === "action_log" || metadata.kind === "agent_action_log") {
    return <SystemLine message={message} />;
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-[14px] rounded-tr-[4px] bg-[var(--foreground-10)] px-3.5 py-2.5 text-sm leading-6 text-[var(--foreground-80)]">
          <RichMessage body={message.body} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-50)]">
        <Sparkles className="size-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 rounded-[14px] rounded-tl-[4px] bg-[var(--foreground-5)] px-3.5 py-2.5 text-sm leading-6 text-[var(--foreground-80)]">
        <RichMessage body={message.body} />
      </div>
    </div>
  );
}

const CASUAL_LABELS: Record<string, string> = {
  "Writing to workspace and saving run state.": "Scribbling notes...",
  "Ran 4 actions and prepared this task for review.": "Wrapped up, handing it over.",
  "Ran 1 action.": "Just warming up.",
  "Ran 2 actions.": "Making progress.",
  "Ran 3 actions.": "Almost there.",
};

function casualize(body: string): string {
  if (CASUAL_LABELS[body]) return CASUAL_LABELS[body];
  if (body.toLowerCase().includes("writing")) return "Scribbling notes...";
  if (body.toLowerCase().includes("ran") && body.toLowerCase().includes("action")) return "Wrapped up, handing it over.";
  if (body.toLowerCase().includes("context")) return "Surfing through the context...";
  if (body.toLowerCase().includes("verification")) return "Running a quick sanity check...";
  if (body.toLowerCase().includes("review")) return "Polishing things up...";
  if (body.toLowerCase().includes("started")) return "Engines running...";
  return body;
}

function SystemLine({ message }: { message: ChatMessage }) {
  return (
    <div className="flex items-center gap-2 px-1 text-xs text-[var(--foreground-30)]">
      <TerminalSquare className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{casualize(message.body)}</span>
    </div>
  );
}

function RichMessage({ body }: { body: string }) {
  // Strip thinking tags from display
  const cleaned = body.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
  const parts = cleaned.split(/```/g);

  return (
    <div className="grid gap-2">
      {parts.map((part, index) => {
        const key = `${index}-${part.slice(0, 12)}`;
        if (index % 2 === 1) {
          return (
            <pre key={key} className="overflow-x-auto rounded-[8px] bg-[var(--foreground-inverse-20)] p-3 font-mono text-xs text-[var(--foreground-80)]">
              <span className="mb-1 flex items-center gap-1.5 text-[var(--foreground-40)]">
                <Code2 className="size-3.5" aria-hidden="true" />
                code
              </span>
              {part.trim()}
            </pre>
          );
        }
        return (
          <div key={key} className="grid gap-1">
            {part.split(/\n{2,}/).filter(Boolean).map((para, i) => (
              <p key={i} className="leading-6">{linkify(para.trim())}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function linkify(value: string) {
  const pieces = value.split(/(https?:\/\/[^\s]+)/g);
  return pieces.map((piece, i) =>
    piece.match(/^https?:\/\//) ? (
      <a key={i} className="underline opacity-70 hover:opacity-100" href={piece} target="_blank" rel="noreferrer">
        {piece}
      </a>
    ) : (
      <React.Fragment key={i}>{piece}</React.Fragment>
    )
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-50)]">
        <Sparkles className="size-3.5" aria-hidden="true" />
      </span>
      <div className="flex items-center gap-1 rounded-[14px] rounded-tl-[4px] bg-[var(--foreground-5)] px-3.5 py-3">
        <span className="size-1.5 animate-typing-dot rounded-full bg-[var(--foreground-40)]" />
        <span className="size-1.5 animate-typing-dot rounded-full bg-[var(--foreground-40)] [animation-delay:160ms]" />
        <span className="size-1.5 animate-typing-dot rounded-full bg-[var(--foreground-40)] [animation-delay:320ms]" />
      </div>
    </div>
  );
}
