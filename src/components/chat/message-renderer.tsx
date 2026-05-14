"use client";

import * as React from "react";
import { Bot, CheckCircle2, Clipboard, Code2, FileText, TerminalSquare, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <div className="grid gap-3">
      {messages.map((message) => (
        <ChatMessageBubble key={message.id} message={message} />
      ))}
      {streaming ? <TypingIndicator /> : null}
    </div>
  );
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const metadata = message.metadata as { kind?: string; attachments?: Array<{ id: string; name: string; visibility: string }>; mentions?: Array<{ key: string; label: string; color?: string | null }> };
  const isUser = message.senderType === "user";
  const senderName = message.senderUser?.name ?? message.senderAgent?.name ?? (message.senderType === "system" ? "System" : "Cofounder");

  if (metadata.kind === "action_log") {
    return <ActionLogMessage message={message} />;
  }

  return (
    <article className={cn("grid gap-2 rounded-[12px] border p-3", isUser ? "border-[var(--primary)] bg-[var(--foreground-8)]" : "border-[var(--border-10)] bg-[var(--foreground-3)]")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)]">
            {isUser ? <UserRound aria-hidden="true" className="size-3.5" /> : <Bot aria-hidden="true" className="size-3.5" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{senderName}</p>
            <p className="text-[11px] text-[var(--foreground-50)]">{formatDateTime(message.createdAt)}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={() => navigator.clipboard?.writeText(message.body)}>
          <Clipboard aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
      <RichMessage body={message.body} />
      {metadata.mentions?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {metadata.mentions.map((mention) => (
            <Badge key={mention.key} variant="neutral" style={mention.color ? { borderColor: mention.color, color: mention.color } : undefined}>
              @{mention.key}
            </Badge>
          ))}
        </div>
      ) : null}
      {metadata.attachments?.length ? (
        <div className="grid gap-2">
          {metadata.attachments.map((file) => (
            <div key={file.id} className="flex items-center justify-between gap-2 rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] px-2 py-1.5 text-xs">
              <span className="inline-flex min-w-0 items-center gap-1">
                <FileText aria-hidden="true" className="size-3.5 text-[var(--foreground-80)]" />
                <span className="truncate">{file.name}</span>
              </span>
              <span className="text-[var(--foreground-50)]">{file.visibility}</span>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function ActionLogMessage({ message }: { message: ChatMessage }) {
  return (
    <article className="rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-inverse-20)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm">
          <TerminalSquare aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
          <span className="truncate">{message.body}</span>
        </span>
        <Badge variant="success">log</Badge>
      </div>
      <p className="mt-1 text-[11px] text-[var(--foreground-50)]">{formatDateTime(message.createdAt)}</p>
    </article>
  );
}

function RichMessage({ body }: { body: string }) {
  const parts = body.split(/```/g);
  return (
    <div className="grid gap-2 text-sm leading-6">
      {parts.map((part, index) => {
        const key = `${index}-${part.slice(0, 14)}`;
        if (index % 2 === 1) {
          return (
            <pre key={key} className="overflow-x-auto rounded-[8px] bg-[var(--foreground-inverse-30)] p-3 font-mono text-xs text-[var(--foreground-80)]">
              <span className="mb-2 flex items-center gap-2 text-[var(--foreground-50)]">
                <Code2 aria-hidden="true" className="size-3.5" />
                code
              </span>
              {part.trim()}
            </pre>
          );
        }
        return renderParagraphs(part, key);
      })}
    </div>
  );
}

function renderParagraphs(value: string, keyPrefix: string) {
  const thinkingPattern = /<thinking>([\s\S]*?)<\/thinking>/g;
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = thinkingPattern.exec(value))) {
    const before = value.slice(lastIndex, match.index);
    if (before.trim()) segments.push(<p key={`${keyPrefix}-p-${lastIndex}`}>{linkify(before)}</p>);
    segments.push(
      <div key={`${keyPrefix}-thinking-${match.index}`} className="rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-2 text-xs leading-5 text-[var(--foreground-50)]">
        <span className="mb-1 inline-flex items-center gap-1 text-[var(--foreground-80)]">
          <CheckCircle2 aria-hidden="true" className="size-3.5" />
          thinking
        </span>
        <p>{match[1]?.trim()}</p>
      </div>
    );
    lastIndex = match.index + match[0].length;
  }

  const rest = value.slice(lastIndex);
  if (rest.trim()) {
    rest.split(/\n{2,}/).forEach((paragraph, index) => {
      if (paragraph.trim()) segments.push(<p key={`${keyPrefix}-rest-${index}`}>{linkify(paragraph)}</p>);
    });
  }

  return <React.Fragment key={keyPrefix}>{segments}</React.Fragment>;
}

function linkify(value: string) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const pieces = value.split(urlPattern);
  return pieces.map((piece, index) =>
    piece.match(/^https?:\/\//) ? (
      <a key={`${piece}-${index}`} className="text-[var(--tt-color-text-blue)] underline" href={piece} target="_blank" rel="noreferrer">{piece}</a>
    ) : (
      <React.Fragment key={`${piece}-${index}`}>{piece}</React.Fragment>
    )
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3 text-sm text-[var(--foreground-50)]">
      <span className="flex gap-1">
        <span className="size-1.5 animate-typing-dot rounded-full bg-[var(--foreground-50)]" />
        <span className="size-1.5 animate-typing-dot rounded-full bg-[var(--foreground-50)] [animation-delay:160ms]" />
        <span className="size-1.5 animate-typing-dot rounded-full bg-[var(--foreground-50)] [animation-delay:320ms]" />
      </span>
      Cofounder is writing
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
