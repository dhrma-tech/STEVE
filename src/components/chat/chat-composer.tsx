"use client";

import * as React from "react";
import { AtSign, Loader2, Paperclip, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { Textarea } from "@/components/ui/textarea";
import type { ChatCatalog } from "@/components/chat/types";

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

  async function submit() {
    if (!body.trim() || sending || disabled) return;
    setSending(true);
    try {
      const ok = await onSend({ body, mentions, attachmentNames });
      if (ok) {
        setBody("");
        setMentions([]);
        setAttachmentNames([]);
      }
    } finally {
      setSending(false);
    }
  }

  function addMention(key: string) {
    setMentions((current) => current.includes(key) ? current : [...current, key]);
    setBody((current) => current.includes(`@${key}`) ? current : `${current}${current.trim() ? " " : ""}@${key} `);
  }

  return (
    <div className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
      <Textarea
        surface="dark"
        label="Message"
        value={body}
        disabled={disabled || sending}
        onChange={(event) => setBody(event.target.value)}
        placeholder="@engineering turn this into the next build step"
        className="min-h-28"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
      />

      <section className="grid gap-2">
        <div className="flex items-center gap-2 text-xs text-[var(--foreground-50)]">
          <AtSign aria-hidden="true" className="size-3.5" />
          Mentions
        </div>
        <div className="flex flex-wrap gap-2">
          {(catalog?.departments ?? []).slice(0, 8).map((department) => (
            <button
              key={department.id}
              type="button"
              className="rounded-[999px] border border-[var(--border-10)] px-2.5 py-1 text-xs text-[var(--foreground-50)] outline-none hover:bg-[var(--foreground-5)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
              style={{ borderColor: mentions.includes(department.slug) ? department.color : undefined, color: mentions.includes(department.slug) ? department.color : undefined }}
              onClick={() => addMention(department.slug)}
            >
              @{department.slug}
            </button>
          ))}
        </div>
      </section>

      <FileUpload
        label="Attach files"
        description={attachmentNames.length ? attachmentNames.join(", ") : "Attach files to this chat thread."}
        maxFiles={4}
        multiple
        disabled={disabled || sending}
        onFilesSelected={(files) => setAttachmentNames(files.map((file) => file.name))}
        className="min-h-28"
      />

      {attachmentNames.length ? (
        <div className="flex flex-wrap gap-2">
          {attachmentNames.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 rounded-[999px] border border-[var(--border-10)] px-2 py-1 text-xs">
              <Paperclip aria-hidden="true" className="size-3" />
              {name}
              <button type="button" aria-label={`Remove ${name}`} onClick={() => setAttachmentNames((current) => current.filter((item) => item !== name))}>
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <Button variant="app" onClick={submit} disabled={!body.trim() || disabled || sending}>
        {sending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <SendHorizontal aria-hidden="true" className="size-4" />}
        Send
      </Button>
    </div>
  );
}
