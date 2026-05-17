"use client";

import * as React from "react";
import { CheckCircle2, Circle, Loader2, Paperclip, SendHorizonal, Sparkles, TerminalSquare, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import type { AgentSessionDetail } from "@/components/agents/types";
import { cn } from "@/lib/utils/cn";

type ApiPayload<T> = { data?: T; error?: { message: string } };

const ACTION_LABELS: Record<string, string> = {
  "session.start": "Starting up",
  "context.load": "Reading context",
  "workspace.write": "Doing the work",
  "verification.run": "Checking output",
  "review.prepare": "Wrapping up"
};

export function AgentWorkspaceDialog({
  orgId, sessionId, open, onOpenChange
}: {
  orgId: string; sessionId: string | null; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const [session, setSession] = React.useState<AgentSessionDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const isPolling = React.useRef(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = React.useState<string[]>([]);

  const loadSession = React.useCallback((opts: { silent?: boolean; attempt?: number } = {}) => {
    if (!sessionId || !open) return;
    const { silent = false, attempt = 0 } = opts;
    const controller = new AbortController();

    if (!silent) setLoading(true);

    fetch(`/api/orgs/${orgId}/sessions/${sessionId}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<ApiPayload<AgentSessionDetail>>)
      .then((payload) => {
        if (!payload.data) {
          if (attempt < 3 && !controller.signal.aborted) {
            setTimeout(() => loadSession({ silent, attempt: attempt + 1 }), 800);
            return;
          }
          throw new Error(payload.error?.message ?? "Session did not load.");
        }
        setSession(payload.data);
        setError(null);
      })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Session did not load."); })
      .finally(() => { if (!controller.signal.aborted && !silent) setLoading(false); });

    return () => controller.abort();
  }, [open, orgId, sessionId]);

  // Initial load
  React.useEffect(() => { return loadSession(); }, [loadSession]);

  // Silent poll while running — no loading state so no flicker
  React.useEffect(() => {
    if (session?.status !== "running") { isPolling.current = false; return; }
    isPolling.current = true;
    const id = setInterval(() => loadSession({ silent: true }), 3000);
    return () => { clearInterval(id); isPolling.current = false; };
  }, [loadSession, session?.status]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages?.length]);

  async function sendMessage() {
    if (!session || !message.trim() || sending) return;
    setSending(true);
    try {
      if (attachments.length) {
        await fetch(`/api/orgs/${orgId}/tasks/${session.task.id}/attachments`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ attachmentNames: attachments })
        });
      }
      const r = await fetch(`/api/orgs/${orgId}/tasks/${session.task.id}/comments`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: message })
      });
      if (!r.ok) throw new Error("Message could not be sent.");
      setMessage(""); setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      loadSession({ silent: true });
    } catch { /* silent */ } finally { setSending(false); }
  }

  const isRunning = session?.status === "running";
  const isComplete = session?.status === "completed";

  // Parse scratchpad — split off the working header, show the body
  const output = React.useMemo(() => {
    if (!session?.scratchpad) return "";
    const lines = session.scratchpad.split("\n");
    const bodyStart = lines.findIndex((l) => l.startsWith("---"));
    return bodyStart >= 0 ? lines.slice(bodyStart + 1).join("\n").trim() : session.scratchpad;
  }, [session?.scratchpad]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94dvh] max-w-[1100px] flex-col gap-0 overflow-hidden p-0">

        {/* Header */}
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b border-[var(--border-10)] px-4 py-3 pr-10">
          <DialogTitle className="flex items-center gap-2 text-sm font-medium">
            <TerminalSquare aria-hidden="true" className="size-4 text-[var(--foreground-50)]" />
            Agent Workspace
          </DialogTitle>
          {session ? (
            <div className="flex items-center gap-2">
              <Badge variant={isComplete ? "success" : isRunning ? "running" : "neutral"}>
                {session.status}
              </Badge>
              <span className="font-mono text-[10px] text-[var(--foreground-40)]">{formatMs(session.elapsedMs)}</span>
            </div>
          ) : null}
        </DialogHeader>

        {/* Initial loading */}
        {loading && !session ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <LoadingState rows={5} label="Starting agent…" />
          </div>
        ) : null}

        {!loading && error && !session ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <ErrorState title="Session issue" description={error} retry={{ onClick: () => loadSession({ attempt: 0 }) }} />
          </div>
        ) : null}

        {session ? (
          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">

            {/* LEFT — output */}
            <section className="flex min-h-0 flex-col border-r border-[var(--border-10)]">
              {/* Task bar */}
              <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border-10)] px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--foreground-40)]">
                    {session.agent?.department.name ?? "Agent"}
                  </p>
                  <p className="truncate text-sm font-semibold text-[var(--foreground-80)]">{session.task.title}</p>
                </div>
              </div>

              {/* Output area */}
              <div className="flex-1 overflow-y-auto px-5 py-5">
                {isRunning && !output ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                    <div className="relative">
                      <div className="size-14 rounded-full bg-[var(--foreground-5)] flex items-center justify-center">
                        <Zap className="size-6 text-[var(--foreground-40)]" aria-hidden="true" />
                      </div>
                      <span className="absolute -right-1 -top-1 flex size-4">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-40" />
                        <span className="relative inline-flex size-4 rounded-full bg-[var(--primary)] opacity-80" />
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground-70)]">Agent is working…</p>
                      <p className="mt-1 text-xs text-[var(--foreground-40)]">Results will appear here when ready</p>
                    </div>
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="size-1.5 rounded-full bg-[var(--foreground-20)] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                ) : output ? (
                  <div className="prose prose-sm max-w-none">
                    <OutputRenderer text={output} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-[var(--foreground-40)]">
                    <TerminalSquare className="size-8 opacity-40" />
                    <p className="text-sm">No output yet</p>
                  </div>
                )}
              </div>
            </section>

            {/* RIGHT — steps + chat */}
            <aside className="flex min-h-0 flex-col">
              {/* Agent info */}
              <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--border-10)] px-4 py-2.5">
                <div className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-[var(--foreground-8)]">
                  <Sparkles className="size-4 text-[var(--foreground-60)]" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--foreground-80)]">{session.agent?.name ?? "Agent"}</p>
                  <p className="text-[10px] text-[var(--foreground-40)]">{formatDateTime(session.updatedAt)}</p>
                </div>
              </div>

              {/* Steps */}
              {session.actions.length > 0 ? (
                <div className="shrink-0 border-b border-[var(--border-10)] px-4 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--foreground-40)]">Progress</p>
                  <div className="grid gap-2">
                    {session.actions.map((action) => (
                      <div key={action.id} className="flex items-center gap-2.5">
                        {action.status === "completed" ? (
                          <CheckCircle2 className="size-3.5 shrink-0 text-[var(--tt-color-text-green-contrast)]" aria-hidden="true" />
                        ) : action.status === "running" ? (
                          <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--primary)]" aria-hidden="true" />
                        ) : (
                          <Circle className="size-3.5 shrink-0 text-[var(--foreground-20)]" aria-hidden="true" />
                        )}
                        <span className={cn("text-xs", action.status === "completed" ? "text-[var(--foreground-60)]" : action.status === "running" ? "font-medium text-[var(--foreground-80)]" : "text-[var(--foreground-30)]")}>
                          {ACTION_LABELS[action.actionType] ?? action.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {session.messages.length ? (
                  <div className="grid gap-3">
                    {session.messages.map((item) => <ChatMessage key={item.id} message={item} />)}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[var(--foreground-30)]">
                    <p className="text-xs">Messages will appear here as the agent works</p>
                  </div>
                )}
              </div>

              {/* Chat composer */}
              <div className="shrink-0 border-t border-[var(--border-10)] p-3">
                {attachments.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {attachments.map((name) => (
                      <span key={name} className="inline-flex items-center gap-1 rounded-[5px] border border-[var(--border-10)] px-1.5 py-0.5 text-[10px] text-[var(--foreground-50)]">
                        <Paperclip className="size-2.5" />{name}
                        <button type="button" onClick={() => setAttachments((p) => p.filter((n) => n !== name))} className="hover:text-[var(--foreground-80)]">
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className={cn("flex items-end gap-2 rounded-[10px] border bg-[var(--foreground-5)] px-3 py-2 transition-colors", "border-[var(--border-10)] focus-within:border-[var(--focused)]")}>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="mb-0.5 shrink-0 text-[var(--foreground-30)] transition-colors hover:text-[var(--foreground-60)]">
                    <Paperclip className="size-3.5" aria-hidden="true" />
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 90)}px`;
                    }}
                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void sendMessage(); } }}
                    placeholder="Ask the agent a question…"
                    disabled={sending}
                    rows={1}
                    className="flex-1 resize-none bg-transparent text-xs text-[var(--foreground-80)] placeholder:text-[var(--foreground-30)] focus:outline-none disabled:opacity-50"
                    style={{ minHeight: "22px", maxHeight: "90px" }}
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={!message.trim() || sending}
                    className="mb-0.5 grid size-6 shrink-0 place-items-center rounded-[6px] bg-[var(--foreground-10)] text-[var(--foreground-50)] transition-all hover:bg-[var(--foreground-20)] hover:text-[var(--foreground-80)] disabled:pointer-events-none disabled:opacity-30 active:scale-90"
                  >
                    {sending ? <Loader2 className="size-3 animate-spin" /> : <SendHorizonal className="size-3" />}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-[var(--foreground-30)]">Ctrl+Enter to send</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setAttachments((p) => [...new Set([...p, ...files.map((f) => f.name)])]);
                    e.target.value = "";
                  }}
                />
              </div>
            </aside>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function OutputRenderer({ text }: { text: string }) {
  return (
    <div className="grid gap-2">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("# "))
          return <h2 key={i} className="text-base font-semibold text-[var(--foreground-80)]">{line.slice(2)}</h2>;
        if (line.startsWith("## "))
          return <h3 key={i} className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-50)]">{line.slice(3)}</h3>;
        if (line.startsWith("- ") || line.startsWith("* "))
          return (
            <p key={i} className="flex gap-2 text-sm leading-6 text-[var(--foreground-70)]">
              <span className="mt-2.5 size-1 shrink-0 rounded-full bg-[var(--foreground-30)]" />
              <span>{line.slice(2)}</span>
            </p>
          );
        if (/^\d+\.\s/.test(line))
          return <p key={i} className="text-sm leading-6 text-[var(--foreground-70)] pl-4">{line}</p>;
        if (line.trim() === "---" || line.trim() === "")
          return <div key={i} className="h-1" />;
        if (line.startsWith("**") && line.endsWith("**"))
          return <p key={i} className="text-sm font-semibold text-[var(--foreground-80)]">{line.slice(2, -2)}</p>;
        return <p key={i} className="text-sm leading-6 text-[var(--foreground-70)]">{line}</p>;
      })}
    </div>
  );
}

function ChatMessage({ message }: { message: AgentSessionDetail["messages"][number] }) {
  const isUser = message.senderType === "user";
  const isSystem = message.senderType === "system";
  if (isSystem) {
    return (
      <p className="text-center text-[10px] text-[var(--foreground-30)]">{message.body}</p>
    );
  }
  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div className={cn("max-w-[90%] rounded-[10px] px-3 py-2 text-xs leading-5",
        isUser
          ? "rounded-tr-[3px] bg-[var(--foreground-10)] text-[var(--foreground-80)]"
          : "rounded-tl-[3px] bg-[var(--foreground-5)] text-[var(--foreground-70)]")}>
        {message.body}
      </div>
    </div>
  );
}

function formatMs(value: number) {
  const s = Math.max(1, Math.round(value / 1000));
  return s < 60 ? `${s}s` : `${Math.round(s / 60)}m`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
