"use client";

import * as React from "react";
import { Loader2, Paperclip, SendHorizontal, X } from "lucide-react";
import type { ChatCatalog } from "@/components/chat/types";
import { cn } from "@/lib/utils/cn";

type MentionItem = { key: string; label: string; tag: string };

export function ChatComposer({
  catalog,
  disabled,
  onSend
}: {
  catalog: ChatCatalog | null;
  disabled?: boolean;
  onSend: (input: { body: string; mentions: string[]; attachmentNames: string[] }) => Promise<boolean>;
}) {
  const [body, setBody] = React.useState("");
  const [mentions, setMentions] = React.useState<string[]>([]);
  const [attachmentNames, setAttachmentNames] = React.useState<string[]>([]);
  const [sending, setSending] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const allMentions = React.useMemo<MentionItem[]>(() => [
    ...(catalog?.agents ?? []).map((a) => ({ key: a.slug, label: a.name, tag: "agent" })),
    ...(catalog?.departments ?? []).map((d) => ({ key: d.slug, label: d.name, tag: "dept" }))
  ], [catalog]);

  const mentionItems = mentionQuery !== null
    ? allMentions.filter((m) =>
        m.key.includes(mentionQuery) || m.label.toLowerCase().includes(mentionQuery)
      ).slice(0, 6)
    : [];

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setBody(val);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;

    const lastAt = val.lastIndexOf("@");
    if (lastAt !== -1) {
      const after = val.slice(lastAt + 1);
      if (!after.includes(" ") && after.length <= 30) {
        setMentionQuery(after.toLowerCase());
        return;
      }
    }
    setMentionQuery(null);
  }

  function selectMention(item: MentionItem) {
    const lastAt = body.lastIndexOf("@");
    const newBody = body.slice(0, lastAt) + `@${item.key} `;
    setBody(newBody);
    setMentions((prev) => (prev.includes(item.key) ? prev : [...prev, item.key]));
    setMentionQuery(null);
    textareaRef.current?.focus();
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
      }
    }, 0);
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setAttachmentNames((prev) => [...new Set([...prev, ...files.map((f) => f.name)])]);
    e.target.value = "";
  }

  async function submit() {
    if (!body.trim() || sending || disabled) return;
    setSending(true);
    try {
      const ok = await onSend({ body, mentions, attachmentNames });
      if (ok) {
        setBody("");
        setMentions([]);
        setAttachmentNames([]);
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative">
      {/* @ mention popup */}
      {mentionItems.length > 0 ? (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 overflow-hidden rounded-[10px] border border-[var(--border-10)] bg-[var(--background-l0)] shadow-[var(--tt-shadow-elevated-md)]">
          {mentionItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selectMention(item); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--foreground-5)]"
            >
              <span className="w-7 shrink-0 rounded-[4px] border border-[var(--border-10)] px-1 py-px text-center font-mono text-[9px] uppercase tracking-wide text-[var(--foreground-40)]">
                {item.tag}
              </span>
              <span className="text-sm font-medium text-[var(--foreground-80)]">@{item.key.replace(/-default$/, "-agent")}</span>
              <span className="truncate text-xs text-[var(--foreground-40)]">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Attachment chips */}
      {attachmentNames.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachmentNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--border-10)] bg-[var(--foreground-5)] px-2 py-0.5 text-xs text-[var(--foreground-60)]"
            >
              <Paperclip className="size-3" aria-hidden="true" />
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => setAttachmentNames((p) => p.filter((n) => n !== name))}
                className="text-[var(--foreground-40)] hover:text-[var(--foreground-80)]"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {/* Input bar */}
      <div className={cn(
        "flex items-center gap-2 rounded-[12px] border bg-[var(--foreground-5)] px-3 py-2 transition-colors",
        "border-[var(--border-10)] focus-within:border-[var(--focused)]"
      )}>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (mentionItems.length > 0 && e.key === "Escape") {
              setMentionQuery(null);
              return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Ask anything... (@ to mention an agent)"
          disabled={disabled || sending}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm leading-5 text-[var(--foreground-80)] placeholder:text-[var(--foreground-30)] focus:outline-none disabled:opacity-50"
          style={{ minHeight: "24px", maxHeight: "140px" }}
        />

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!body.trim() || disabled || sending}
          className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-[var(--foreground-10)] text-[var(--foreground-60)] transition-all hover:bg-[var(--foreground-15)] hover:text-[var(--foreground-80)] active:scale-90 disabled:pointer-events-none disabled:opacity-30"
        >
          {sending
            ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            : <SendHorizontal className="size-3.5" aria-hidden="true" />}
        </button>
      </div>

      <p className="mt-1.5 px-0.5 text-[10px] text-[var(--foreground-30)]">
        Ctrl+Enter to send · @ to mention
      </p>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
    </div>
  );
}
