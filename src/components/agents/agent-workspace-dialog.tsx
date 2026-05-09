"use client";

import * as React from "react";
import { Copy, ExternalLink, FileText, Loader2, Maximize2, MessageSquare, MoreHorizontal, Play, RotateCw, Save, TerminalSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FileUpload } from "@/components/ui/file-upload";
import { LoadingState } from "@/components/ui/loading-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { AgentSessionDetail } from "@/components/agents/types";

type ApiPayload<T> = { data?: T; error?: { message: string } };

export function AgentWorkspaceDialog({
  orgId,
  sessionId,
  open,
  onOpenChange
}: {
  orgId: string;
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [session, setSession] = React.useState<AgentSessionDetail | null>(null);
  const [scratchpad, setScratchpad] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [attachmentNames, setAttachmentNames] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const browserFrameRef = React.useRef<HTMLDivElement>(null);

  const loadSession = React.useCallback(() => {
    if (!sessionId || !open) return;
    const controller = new AbortController();
    queueMicrotask(() => setLoading(true));
    fetch(`/api/orgs/${orgId}/sessions/${sessionId}`, { signal: controller.signal })
      .then((response) => response.json() as Promise<ApiPayload<AgentSessionDetail>>)
      .then((payload) => {
        if (!payload.data) throw new Error(payload.error?.message ?? "Agent session did not load.");
        setSession(payload.data);
        setScratchpad(payload.data.scratchpad ?? "");
        setError(null);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Agent session did not load.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, orgId, sessionId]);

  React.useEffect(() => {
    return loadSession();
  }, [loadSession]);

  async function mutate<T>({ key, path, method = "POST", body, selectSession }: { key: string; path: string; method?: "POST" | "PATCH"; body?: unknown; selectSession: (payload: T) => AgentSessionDetail | null | undefined }) {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch(path, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = (await response.json()) as ApiPayload<T>;
      const nextSession = payload.data ? selectSession(payload.data) : null;
      if (!response.ok || !nextSession) throw new Error(payload.error?.message ?? "Session update failed.");
      setSession(nextSession);
      setScratchpad(nextSession.scratchpad ?? "");
      return nextSession;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Session update failed.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function saveScratchpad() {
    if (!session) return;
    await mutate<AgentSessionDetail>({
      key: "scratchpad",
      method: "PATCH",
      path: `/api/orgs/${orgId}/sessions/${session.id}/scratchpad`,
      body: { scratchpad },
      selectSession: (payload) => payload
    });
  }

  async function sendMessage() {
    if (!session || !message.trim()) return;
    setBusy("message");
    setError(null);
    try {
      if (attachmentNames.length) {
        await fetch(`/api/orgs/${orgId}/tasks/${session.task.id}/attachments`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ attachmentNames })
        });
      }
      const response = await fetch(`/api/orgs/${orgId}/tasks/${session.task.id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: message })
      });
      if (!response.ok) throw new Error("Message could not be sent.");
      setMessage("");
      setAttachmentNames([]);
      loadSession();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Message could not be sent.");
    } finally {
      setBusy(null);
    }
  }

  const browserUrl = session?.browserUrl ?? `/org/${orgId}/canvas`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94dvh] max-w-[1180px] overflow-y-auto p-0">
        <DialogHeader className="border-b border-[var(--app-border)] p-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <TerminalSquare aria-hidden="true" className="size-4 text-[var(--app-primary-light)]" />
            Agent Workspace
          </DialogTitle>
          <DialogDescription>
            Monitor the sandbox browser, action log, task chat, scratchpad, and replay for this agent run.
          </DialogDescription>
        </DialogHeader>

        {loading ? <div className="p-5"><LoadingState rows={8} label="Loading agent session" /></div> : null}
        {error ? <div className="p-5"><ErrorState title="Agent session issue" description={error} retry={{ onClick: loadSession }} /></div> : null}

        {!loading && session ? (
          <div className="grid min-h-[680px] gap-0 lg:grid-cols-[minmax(0,1.2fr)_380px]">
            <section className="grid min-h-0 gap-0 border-b border-[var(--app-border)] lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] p-4">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--app-text-50)]">{session.agent?.department.name ?? "Agent"}</p>
                  <h2 className="mt-1 truncate text-xl font-medium">{session.task.title}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={session.status === "running" ? "running" : session.status === "completed" ? "success" : "neutral"}>{session.status}</Badge>
                  <Badge variant="neutral">{formatMs(session.elapsedMs)}</Badge>
                </div>
              </div>

              <Tabs defaultValue="browser" className="grid min-h-0 gap-0">
                <div className="border-b border-[var(--app-border)] p-3">
                  <TabsList>
                    <TabsTrigger value="browser">Agent Browser</TabsTrigger>
                    <TabsTrigger value="scratchpad">Scratchpad</TabsTrigger>
                    <TabsTrigger value="replay">Replay</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="browser" className="m-0 grid gap-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate rounded-[8px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 font-mono text-xs text-[var(--app-text-50)]">
                      {browserUrl}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" onClick={() => navigator.clipboard?.writeText(browserUrl)}>
                        <Copy aria-hidden="true" className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" onClick={() => browserFrameRef.current?.requestFullscreen?.()}>
                        <Maximize2 aria-hidden="true" className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" onClick={() => window.open(browserUrl, "_blank", "noopener,noreferrer")}>
                        <ExternalLink aria-hidden="true" className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div ref={browserFrameRef} className="min-h-[430px] overflow-hidden rounded-[12px] border border-[var(--app-border)] bg-[#111216]">
                    <iframe title="Agent browser" src={browserUrl} className="h-[430px] w-full border-0 bg-white" />
                  </div>
                </TabsContent>

                <TabsContent value="scratchpad" className="m-0 grid gap-3 p-4">
                  <Textarea surface="dark" label="Scratchpad" value={scratchpad} onChange={(event) => setScratchpad(event.target.value)} className="min-h-[420px] font-mono text-sm" />
                  <Button variant="app" onClick={saveScratchpad} disabled={busy === "scratchpad"}>
                    {busy === "scratchpad" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Save aria-hidden="true" className="size-4" />}
                    Save scratchpad
                  </Button>
                </TabsContent>

                <TabsContent value="replay" className="m-0 p-4">
                  {session.status === "completed" ? (
                    <div className="grid gap-3 rounded-[12px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-4">
                      <div className="flex items-center gap-2">
                        <FileText aria-hidden="true" className="size-4 text-[var(--app-primary-light)]" />
                        <h3 className="text-sm font-medium">Replay ready</h3>
                      </div>
                      <p className="text-sm leading-6 text-[var(--app-text-50)]">The sandbox replay is saved with the completed run and action log.</p>
                      <Button variant="app" onClick={() => session.replayUrl && window.open(session.replayUrl, "_blank", "noopener,noreferrer")}>Open replay</Button>
                    </div>
                  ) : (
                    <div className="grid min-h-[360px] place-items-center rounded-[12px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-6 text-center">
                      <div>
                        <Loader2 aria-hidden="true" className="mx-auto size-7 animate-spin text-[var(--app-primary-light)]" />
                        <h3 className="mt-3 text-sm font-medium">Recording session</h3>
                        <p className="mt-2 max-w-[40ch] text-xs leading-5 text-[var(--app-text-50)]">Replay becomes available after the sandbox run finishes.</p>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </section>

            <aside className="grid min-h-0 content-start gap-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--app-text-50)]">Task chat</p>
                  <h3 className="mt-1 truncate text-base font-medium">{session.agent?.name ?? "Agent"}</h3>
                  <p className="mt-1 text-xs text-[var(--app-text-50)]">{session.task.status} / updated {formatDateTime(session.updatedAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" onClick={() => onOpenChange(false)}>
                    Go back
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="px-2 text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" aria-label="Session options">
                        <MoreHorizontal aria-hidden="true" className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Session options</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => navigator.clipboard?.writeText(window.location.href)}>
                        Copy session link
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => navigator.clipboard?.writeText(session.task.id)}>
                        Copy task id
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={!session.replayUrl} onSelect={() => session.replayUrl && navigator.clipboard?.writeText(session.replayUrl)}>
                        Copy replay link
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <ActionLog session={session} onAdvance={(finish) =>
                mutate<AgentSessionDetail>({
                  key: finish ? "finish" : "advance",
                  path: `/api/orgs/${orgId}/sessions/${session.id}/actions`,
                  body: { finish },
                  selectSession: (payload) => payload
                })
              } busy={busy} />

              <div className="grid max-h-[280px] gap-2 overflow-y-auto rounded-[12px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
                {session.messages.length ? (
                  session.messages.map((item) => <ChatMessage key={item.id} message={item} />)
                ) : (
                  <EmptyState surface="dark" icon={<MessageSquare aria-hidden="true" className="size-4" />} title="No task chat yet" description="Messages and agent action notes will appear here." />
                )}
              </div>

              <Textarea surface="dark" label="Message" value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-24" placeholder="@engineering review the latest run" />
              <FileUpload label="Attach files" description={attachmentNames.length ? attachmentNames.join(", ") : "Attach files to this task chat."} maxFiles={4} multiple onFilesSelected={(files) => setAttachmentNames(files.map((file) => file.name))} />
              <Button variant="app" onClick={sendMessage} disabled={!message.trim() || busy === "message"}>
                {busy === "message" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <MessageSquare aria-hidden="true" className="size-4" />}
                Send
              </Button>
            </aside>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ActionLog({ session, onAdvance, busy }: { session: AgentSessionDetail; onAdvance: (finish: boolean) => void; busy: string | null }) {
  return (
    <div className="grid gap-3 rounded-[12px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TerminalSquare aria-hidden="true" className="size-4 text-[var(--app-primary-light)]" />
          <h3 className="text-sm font-medium">Action log</h3>
        </div>
        <Badge variant="neutral">{session.actions.length}</Badge>
      </div>
      <div className="grid gap-2">
        {session.actions.map((action) => (
          <div key={action.id} className="rounded-[8px] border border-[var(--app-border)] bg-[rgba(0,0,0,0.12)] p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm">{action.label}</span>
              <Badge variant={action.status === "running" ? "running" : action.status === "completed" ? "success" : "neutral"}>{action.status}</Badge>
            </div>
            {typeof action.payload.detail === "string" ? <p className="mt-1 text-xs leading-5 text-[var(--app-text-50)]">{action.payload.detail}</p> : null}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="app" size="sm" onClick={() => onAdvance(false)} disabled={session.status !== "running" || busy === "advance"}>
          {busy === "advance" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Play aria-hidden="true" className="size-4" />}
          Run next
        </Button>
        <Button variant="ghost" size="sm" className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" onClick={() => onAdvance(true)} disabled={session.status !== "running" || busy === "finish"}>
          <RotateCw aria-hidden="true" className="size-4" />
          Finish
        </Button>
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: AgentSessionDetail["messages"][number] }) {
  return (
    <div className="rounded-[8px] border border-[var(--app-border)] bg-[rgba(0,0,0,0.12)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--app-text-50)]">
          {message.senderUser?.name ?? message.senderAgent?.name ?? message.senderType} / {formatDateTime(message.createdAt)}
        </p>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" onClick={() => navigator.clipboard?.writeText(message.body)}>
          <Copy aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
      <RichMessage body={message.body} />
    </div>
  );
}

function RichMessage({ body }: { body: string }) {
  const parts = body.split(/```/g);
  return (
    <div className="mt-2 grid gap-2 text-sm leading-6">
      {parts.map((part, index) => {
        const key = `${index}-${part.slice(0, 12)}`;
        if (index % 2 === 1) {
          return <pre key={key} className="overflow-x-auto rounded-[8px] bg-black/35 p-3 font-mono text-xs text-[var(--app-text)]">{part.trim()}</pre>;
        }
        return <p key={key} className={part.includes("<thinking>") ? "rounded-[8px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-2 text-xs text-[var(--app-text-50)]" : ""}>{linkify(part)}</p>;
      })}
    </div>
  );
}

function linkify(value: string) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const pieces = value.split(urlPattern);
  return pieces.map((piece, index) =>
    urlPattern.test(piece) ? (
      <a key={`${piece}-${index}`} className="text-[var(--app-primary-light)] underline" href={piece} target="_blank" rel="noreferrer">{piece}</a>
    ) : (
      <React.Fragment key={`${piece}-${index}`}>{piece}</React.Fragment>
    )
  );
}

function formatMs(value: number) {
  const seconds = Math.max(1, Math.round(value / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
