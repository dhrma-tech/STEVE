"use client";

import * as React from "react";
import { Check, CheckCircle2, Copy, Loader2, Paperclip, SendHorizonal, Sparkles, TerminalSquare, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import type { AgentSessionDetail } from "@/components/agents/types";
import { cn } from "@/lib/utils/cn";

type ApiPayload<T> = { data?: T; error?: { message: string } };

const ACTION_LABELS: Record<string, string> = {
  "session.start":    "Starting session",
  "context.load":     "Reading context",
  "workspace.write":  "Doing the work",
  "verification.run": "Checking output",
  "review.prepare":   "Wrapping up",
  // Engineering
  "code.plan":        "Planning implementation",
  "code.write":       "Writing implementation",
  "tests.verify":     "Verifying quality",
  // Marketing
  "content.draft":    "Drafting content",
  "content.review":   "Reviewing output",
  // Design
  "design.plan":      "Planning design",
  "design.execute":   "Executing design",
  // Sales
  "outreach.draft":   "Drafting outreach"
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
  const terminalEndRef = React.useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = React.useState<string[]>([]);
  const [copied, setCopied] = React.useState(false);
  // Track which step IDs have been seen as completed to animate only transitions
  const completedStepIds = React.useRef<Set<string>>(new Set());
  const initializedSessionId = React.useRef<string | null>(null);
  // Pre-populate on first load so already-completed steps don't animate
  if (session && session.id !== initializedSessionId.current) {
    initializedSessionId.current = session.id;
    session.actions.forEach((a) => {
      if (a.status === "completed") completedStepIds.current.add(a.id);
    });
  }

  async function handleCopy() {
    const text = session?.scratchpad ?? output;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — silent fail
    }
  }

  // Fix 11 — elapsed timer and completion banner
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [showCompletionBanner, setShowCompletionBanner] = React.useState(false);
  // Fix 13 — section tab state
  const [activeSection, setActiveSection] = React.useState(0);

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

  React.useEffect(() => { return loadSession(); }, [loadSession]);

  React.useEffect(() => {
    if (session?.status !== "running") { isPolling.current = false; return; }
    isPolling.current = true;
    const id = setInterval(() => loadSession({ silent: true }), 3000);
    return () => { clearInterval(id); isPolling.current = false; };
  }, [loadSession, session?.status]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages?.length]);

  React.useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.scratchpad]);

  // Elapsed counter — increments every second while running
  React.useEffect(() => {
    if (session?.status !== "running") { setElapsedSeconds(0); return; }
    const startTime = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const id = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [session?.status, session?.startedAt]);

  // Completion banner — shows briefly when session finishes
  React.useEffect(() => {
    if (session?.status !== "completed") return;
    setShowCompletionBanner(true);
    const id = setTimeout(() => setShowCompletionBanner(false), 2500);
    return () => clearTimeout(id);
  }, [session?.status]);

  // Reset to first tab when session changes
  React.useEffect(() => { setActiveSection(0); }, [session?.id]);

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

  const output = React.useMemo(() => {
    if (!session?.scratchpad) return "";
    const lines = session.scratchpad.split("\n");
    const bodyStart = lines.findIndex((l) => l.startsWith("---"));
    return bodyStart >= 0 ? lines.slice(bodyStart + 1).join("\n").trim() : session.scratchpad;
  }, [session?.scratchpad]);

  const agentSlug = (session?.agent?.name ?? "agent").toLowerCase().replace(/\s+/g, "-");

  // Fix 11 — current running action label
  const currentAction = session?.actions?.find((a) => a.status === "running");
  const currentActionLabel = currentAction
    ? (ACTION_LABELS[currentAction.actionType] ?? currentAction.label)
    : "Initializing…";

  // Fix 13 — section parser
  const sections = React.useMemo(() => parseOutputSections(output), [output]);
  const hasSections = sections.length > 1;
  const terminalDisplayContent = hasSections ? (sections[activeSection]?.content ?? "") : output;

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
          <>
          {/* Fix 11 — running agent banner */}
          {isRunning && !showCompletionBanner && (
            <div
              className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-10)] px-4 py-2.5 text-sm"
              style={{
                background: "linear-gradient(90deg,rgba(59,130,246,0.05),rgba(59,130,246,0.12),rgba(59,130,246,0.05))",
                backgroundSize: "200% 100%",
                animation: "gradient-sweep 3s ease infinite",
                borderLeft: "3px solid var(--primary)",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[var(--primary)] animate-[pulse-dot_1.5s_ease-in-out_infinite]" />
                <span className="font-medium text-[var(--foreground-80)]">
                  {session.agent?.name ?? "Agent"} is running
                </span>
                <span className="text-[var(--foreground-30)]" aria-hidden="true">·</span>
                <span className="text-[var(--foreground-50)]">{currentActionLabel}</span>
              </div>
              <span className="font-mono text-xs tabular-nums text-[var(--foreground-40)]">
                {formatElapsed(elapsedSeconds)}
              </span>
            </div>
          )}
          {showCompletionBanner && (
            <div
              className="flex shrink-0 items-center gap-2 border-b border-green-400/20 px-4 py-2.5 text-sm animate-[fade-in_150ms_ease-out_both]"
              style={{ borderLeft: "3px solid rgb(74,222,128)" }}
            >
              <span className="size-2 rounded-full bg-green-400" />
              <span className="font-medium text-green-400">Session complete</span>
              <span className="text-[var(--foreground-30)]" aria-hidden="true">·</span>
              <span className="text-[var(--foreground-50)]">{formatElapsed(elapsedSeconds)}</span>
            </div>
          )}
          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">

            {/* LEFT — terminal output */}
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

              {/* Terminal chrome — macOS-style dot bar */}
              <div
                className="flex shrink-0 items-center justify-between gap-1.5 border-b px-3 py-2"
                style={{ background: "var(--terminal-chrome)", borderColor: "var(--terminal-border)" }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#ff5f56]" />
                  <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
                  <span className="size-2.5 rounded-full bg-[#27c93f]" />
                  <span
                    className="ml-3 font-mono text-[10px] select-none"
                    style={{ color: "var(--terminal-text-muted)" }}
                  >
                    {agentSlug}@cofounder ~ %
                  </span>
                </div>
                {output ? (
                  <button
                    type="button"
                    title={copied ? "Copied!" : "Copy all output"}
                    onClick={() => void handleCopy()}
                    className="grid size-6 place-items-center rounded-[5px] transition-colors hover:bg-[var(--foreground-8)]"
                    style={{ color: "var(--terminal-text-muted)" }}
                  >
                    {copied
                      ? <Check className="size-3.5 text-green-400" />
                      : <Copy className="size-3.5" />}
                  </button>
                ) : null}
              </div>

              {/* Fix 13 — section tabs (only when output has 2+ ## sections) */}
              {hasSections && (
                <div
                  className="flex shrink-0 items-center overflow-x-auto border-b border-[var(--border-10)]"
                  style={{ background: "var(--terminal-chrome)" }}
                  role="tablist"
                >
                  {sections.map((section, idx) => (
                    <div
                      key={idx}
                      role="tab"
                      aria-selected={activeSection === idx}
                      tabIndex={0}
                      onClick={() => setActiveSection(idx)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveSection(idx); }}
                      className={cn(
                        "group flex cursor-pointer items-center gap-1 whitespace-nowrap border-b-2 px-3 py-1.5 text-[11px] transition-colors duration-100",
                        activeSection === idx
                          ? "border-[var(--primary)] font-medium text-[var(--foreground-80)]"
                          : "border-transparent text-[var(--foreground-40)] hover:text-[var(--foreground-60)]"
                      )}
                      style={{ color: activeSection === idx ? undefined : "var(--terminal-text-muted)" }}
                    >
                      <span className="max-w-[120px] truncate">{section.title}</span>
                      <span
                        role="button"
                        aria-label={`Copy ${section.title}`}
                        title={`Copy ${section.title}`}
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(section.content).catch(() => {}); }}
                        className="ml-0.5 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ color: "var(--terminal-text-muted)" }}
                      >
                        <Copy className="size-3" />
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Terminal body */}
              <div
                className="flex-1 overflow-y-auto px-5 py-4"
                style={{ background: "var(--terminal-bg)", fontFamily: "var(--font-mono, monospace)" }}
              >
                {isRunning && !output ? (
                  <TerminalRunning session={session} agentSlug={agentSlug} />
                ) : output ? (
                  <div key={`section-${activeSection}`} className={hasSections ? "animate-[tab-content-fade_150ms_ease-out_both]" : undefined}>
                    <TerminalOutput text={terminalDisplayContent} agentSlug={agentSlug} isRunning={isRunning} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <TerminalSquare
                      className="size-8 opacity-30"
                      style={{ color: "var(--terminal-text-muted)" }}
                    />
                    <div>
                      <p className="font-mono text-xs font-medium" style={{ color: "var(--terminal-text-muted)" }}>
                        No output yet
                      </p>
                      <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--terminal-text-muted)", opacity: 0.6 }}>
                        Run the agent to see its work here.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="mt-1 rounded-[8px] border border-[var(--border-10)] px-3 py-1.5 font-mono text-[11px] transition-colors hover:bg-[var(--foreground-8)]"
                      style={{ color: "var(--terminal-text-muted)" }}
                    >
                      Close &amp; Run Agent →
                    </button>
                  </div>
                )}
                <div ref={terminalEndRef} />
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
                    {session.actions.map((action) => {
                      const isNewlyDone = action.status === "completed" && !completedStepIds.current.has(action.id);
                      if (isNewlyDone) completedStepIds.current.add(action.id);
                      return (
                      <div key={action.id} className="flex items-center gap-2.5">
                        {action.status === "completed" ? (
                          <CheckCircle2
                            className={cn(
                              "size-3.5 shrink-0 text-[var(--tt-color-text-green-contrast)]",
                              isNewlyDone ? "animate-[check-pop_200ms_ease-out_both]" : ""
                            )}
                            aria-hidden="true"
                          />
                        ) : action.status === "running" ? (
                          <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--primary)]" aria-hidden="true" />
                        ) : (
                          <span className="size-3.5 shrink-0 rounded-full border border-[var(--border-10)]" />
                        )}
                        <span className={cn(
                          "font-mono text-[11px]",
                          action.status === "completed" ? "text-[var(--foreground-50)]" :
                          action.status === "running"   ? "font-medium text-[var(--foreground-80)]" :
                                                          "text-[var(--foreground-30)]"
                        )}>
                          {ACTION_LABELS[action.actionType] ?? action.label}
                        </span>
                      </div>
                      );
                    })}
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
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface OutputSection { title: string; content: string; }

function parseOutputSections(text: string): OutputSection[] {
  if (!text?.trim()) return [];
  const lines = text.split("\n");
  const sections: OutputSection[] = [];
  let current: { title: string; lines: string[] } | null = null;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) sections.push({ title: current.title, content: current.lines.join("\n").trim() });
      current = { title: line.replace(/^##\s+/, "").trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push({ title: current.title, content: current.lines.join("\n").trim() });
  return sections;
}

function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Terminal running state ────────────────────────────────────────────────────

function TerminalRunning({ session, agentSlug }: { session: AgentSessionDetail; agentSlug: string }) {
  const visibleActions = session.actions.filter(
    (a) => a.status === "completed" || a.status === "running"
  );

  return (
    <div className="font-mono text-[13px] leading-[1.7]">
      {/* Invocation line */}
      <div className="mb-3 flex flex-wrap gap-1">
        <span style={{ color: "var(--terminal-green)" }}>$&nbsp;</span>
        <span style={{ color: "var(--terminal-text-bright)" }}>
          {agentSlug}
        </span>
        <span style={{ color: "var(--terminal-text-muted)" }}>
          &nbsp;--task &quot;{session.task.title}&quot;
        </span>
      </div>

      {/* Completed + running steps */}
      {visibleActions.map((action) => (
        <div key={action.id} className="flex items-center gap-2">
          <span
            className={action.status === "running" ? "animate-pulse" : ""}
            style={{ color: action.status === "completed" ? "var(--terminal-green)" : "var(--terminal-amber)" }}
          >
            {action.status === "completed" ? "✓" : "›"}
          </span>
          <span style={{ color: "var(--terminal-text)" }}>
            {ACTION_LABELS[action.actionType] ?? action.label}
          </span>
          {action.status === "running" && (
            <span
              className="inline-block animate-pulse"
              style={{ width: 7, height: 13, background: "var(--terminal-amber)" }}
            />
          )}
        </div>
      ))}

      {/* Fallback when no actions yet */}
      {visibleActions.length === 0 && (
        <div className="flex items-center gap-2">
          <span className="animate-pulse" style={{ color: "var(--terminal-amber)" }}>›</span>
          <span style={{ color: "var(--terminal-text)" }}>Initializing session…</span>
          <span
            className="inline-block animate-pulse"
            style={{ width: 7, height: 13, background: "var(--terminal-amber)" }}
          />
        </div>
      )}
    </div>
  );
}

// ── Terminal output renderer ──────────────────────────────────────────────────

function TerminalOutput({ text, agentSlug, isRunning }: { text: string; agentSlug: string; isRunning: boolean }) {
  const lines = text.split("\n");

  return (
    <div className="font-mono text-[13px] leading-[1.7]">
      {/* Invocation line */}
      <div className="mb-3 flex flex-wrap gap-1">
        <span style={{ color: "var(--terminal-green)" }}>$&nbsp;</span>
        <span style={{ color: "var(--terminal-text-bright)" }}>{agentSlug}</span>
        <span style={{ color: "var(--terminal-text-muted)" }}>&nbsp;--output</span>
      </div>

      {lines.map((line, i) => {
        // ## Section header
        if (line.startsWith("## ")) {
          return (
            <div key={i} className="mt-4 mb-1">
              <span
                className="text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--terminal-green)" }}
              >
                // {line.slice(3)}
              </span>
            </div>
          );
        }

        // # Top-level heading
        if (line.startsWith("# ")) {
          return (
            <div key={i} className="mb-2">
              <span className="text-sm font-bold" style={{ color: "var(--terminal-text-bright)" }}>
                {line.slice(2)}
              </span>
            </div>
          );
        }

        // Bullet list
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="mt-px shrink-0" style={{ color: "var(--terminal-green)" }}>→</span>
              <span style={{ color: "var(--terminal-text)" }}>{renderInline(line.slice(2))}</span>
            </div>
          );
        }

        // Numbered list
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.*)/);
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="shrink-0 min-w-[1.5rem]" style={{ color: "var(--terminal-text-muted)" }}>
                {String(match?.[1]).padStart(2, "0")}.
              </span>
              <span style={{ color: "var(--terminal-text)" }}>{renderInline(match?.[2] ?? "")}</span>
            </div>
          );
        }

        // Blank line or horizontal rule
        if (line.trim() === "" || line.trim() === "---") {
          return <div key={i} className="h-2" />;
        }

        // Standalone bold line **...**
        if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
          return (
            <div key={i} className="flex gap-2">
              <span className="shrink-0 select-none" style={{ color: "var(--terminal-text-muted)" }}>›</span>
              <span className="font-semibold" style={{ color: "var(--terminal-text-bright)" }}>
                {line.trim().slice(2, -2)}
              </span>
            </div>
          );
        }

        // Default line
        return (
          <div key={i} className="flex gap-2">
            <span className="shrink-0 select-none" style={{ color: "var(--terminal-text-muted)" }}>›</span>
            <span style={{ color: "var(--terminal-text)" }}>{renderInline(line)}</span>
          </div>
        );
      })}

      {/* Blinking cursor */}
      <div className="mt-2 flex items-center gap-1.5">
        <span style={{ color: isRunning ? "var(--terminal-amber)" : "var(--terminal-green)" }}>$&nbsp;</span>
        <span
          className="inline-block animate-pulse"
          style={{ width: 7, height: 14, background: isRunning ? "var(--terminal-amber)" : "var(--terminal-green)" }}
        />
      </div>
    </div>
  );
}

// ── Inline markdown (bold) ────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4
          ? <strong key={i} style={{ color: "var(--terminal-text-bright)", fontWeight: 600 }}>{part.slice(2, -2)}</strong>
          : <React.Fragment key={i}>{part}</React.Fragment>
      )}
    </>
  );
}

// ── Chat message ──────────────────────────────────────────────────────────────

function ChatMessage({ message }: { message: AgentSessionDetail["messages"][number] }) {
  const isUser = message.senderType === "user";
  const isSystem = message.senderType === "system";
  if (isSystem) {
    return <p className="text-center text-[10px] text-[var(--foreground-30)]">{message.body}</p>;
  }
  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div className={cn(
        "max-w-[90%] rounded-[10px] px-3 py-2 text-xs leading-5",
        isUser
          ? "rounded-tr-[3px] bg-[var(--foreground-10)] text-[var(--foreground-80)]"
          : "rounded-tl-[3px] bg-[var(--foreground-5)] text-[var(--foreground-70)]"
      )}>
        {message.body}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMs(value: number) {
  const s = Math.max(1, Math.round(value / 1000));
  return s < 60 ? `${s}s` : `${Math.round(s / 60)}m`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  }).format(new Date(value));
}
