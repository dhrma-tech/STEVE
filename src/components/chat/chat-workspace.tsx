"use client";

import * as React from "react";
import { Archive, Bot, MessageSquare, RefreshCw } from "lucide-react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { MessageList } from "@/components/chat/message-renderer";
import { ChatThreadList } from "@/components/chat/chat-thread-list";
import type { ChatThreadDetail, ChatWorkspacePayload } from "@/components/chat/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

type ApiPayload<T> = { data?: T; error?: { message: string } };

export function ChatWorkspace({
  orgId,
  initialKind = "cofounder",
  compact = false
}: {
  orgId: string;
  initialKind?: "cofounder" | "task" | "department";
  compact?: boolean;
}) {
  const [data, setData] = React.useState<ChatWorkspacePayload | null>(null);
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<ChatThreadDetail | null>(null);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = React.useState(0);

  const refresh = React.useCallback(() => setRefreshIndex((index) => index + 1), []);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ kind: initialKind });
    if (query.trim()) params.set("q", query.trim());

    queueMicrotask(() => setLoading(true));
    fetch(`/api/orgs/${orgId}/chat/threads?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json() as Promise<ApiPayload<ChatWorkspacePayload>>)
      .then((payload) => {
        if (!payload.data) throw new Error(payload.error?.message ?? "Chat did not load.");
        setData(payload.data);
        setError(null);
        if (!selectedThreadId && payload.data.threads[0]) {
          setSelectedThreadId(payload.data.threads[0].id);
        } else if (selectedThreadId && !payload.data.threads.some((item) => item.id === selectedThreadId)) {
          setSelectedThreadId(payload.data.threads[0]?.id ?? null);
        }
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(caught instanceof Error ? caught.message : "Chat did not load.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [initialKind, orgId, query, refreshIndex, selectedThreadId]);

  React.useEffect(() => {
    if (!selectedThreadId) {
      queueMicrotask(() => setThread(null));
      return;
    }

    const controller = new AbortController();
    queueMicrotask(() => setDetailLoading(true));
    fetch(`/api/orgs/${orgId}/chat/threads/${selectedThreadId}`, { signal: controller.signal })
      .then((response) => response.json() as Promise<ApiPayload<ChatThreadDetail>>)
      .then((payload) => {
        if (!payload.data) throw new Error(payload.error?.message ?? "Thread did not load.");
        setThread(payload.data);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setThread(null);
          setError(caught instanceof Error ? caught.message : "Thread did not load.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });

    return () => controller.abort();
  }, [orgId, selectedThreadId]);

  async function createThread() {
    setError(null);
    const title = initialKind === "cofounder" ? "Cofounder chat" : "New chat thread";
    const response = await fetch(`/api/orgs/${orgId}/chat/threads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: initialKind, title })
    });
    const payload = (await response.json()) as ApiPayload<ChatThreadDetail>;
    if (!response.ok || !payload.data) {
      setError(payload.error?.message ?? "Thread could not be created.");
      return;
    }
    setSelectedThreadId(payload.data.id);
    setThread(payload.data);
    refresh();
  }

  async function archiveThread() {
    if (!thread) return;
    const response = await fetch(`/api/orgs/${orgId}/chat/threads/${thread.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: true })
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as ApiPayload<unknown>;
      setError(payload.error?.message ?? "Thread could not be archived.");
      return;
    }
    setThread(null);
    setSelectedThreadId(null);
    refresh();
  }

  async function send(input: { body: string; mentions: string[]; attachmentNames: string[] }) {
    if (!thread) return false;
    setStreaming(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}/chat/threads/${thread.id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      });
      const payload = (await response.json()) as ApiPayload<ChatThreadDetail>;
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Message could not be sent.");
      setThread(payload.data);
      refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Message could not be sent.");
      return false;
    } finally {
      setStreaming(false);
    }
  }

  const selectedSummary = data?.threads.find((item) => item.id === selectedThreadId) ?? null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 place-items-center rounded-[9px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.06)] text-[var(--app-primary-light)]">
            <Bot aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--app-text-50)]">Chat</p>
            <h2 className="text-lg font-medium tracking-[0px]">Cofounder chat</h2>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" onClick={refresh}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Refresh
        </Button>
      </div>

      {error ? <ErrorState title="Chat issue" description={error} retry={{ onClick: refresh }} /> : null}
      {loading ? <LoadingState rows={5} label="Loading chat" /> : null}

      {!loading && data ? (
        <div className={`grid gap-4 ${compact ? "" : "2xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]"}`}>
          <ChatThreadList
            threads={data.threads}
            selectedThreadId={selectedThreadId}
            query={query}
            onQueryChange={setQuery}
            onSelect={setSelectedThreadId}
            onNewThread={createThread}
          />

          <section className="grid gap-3 rounded-[12px] border border-[var(--app-border)] bg-[rgba(0,0,0,0.12)] p-3">
            {detailLoading ? <LoadingState rows={8} label="Loading thread" /> : null}
            {!detailLoading && thread ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-medium">{thread.title}</h3>
                      <Badge variant={thread.kind === "cofounder" ? "brand" : "neutral"}>{thread.kind}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[var(--app-text-50)]">
                      {thread.messageCount} messages{selectedSummary?.task ? ` / ${selectedSummary.task.title}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" onClick={archiveThread}>
                    <Archive aria-hidden="true" className="size-4" />
                    Archive
                  </Button>
                </div>

                {thread.messages.length ? (
                  <div className="max-h-[520px] overflow-y-auto pr-1">
                    <MessageList messages={thread.messages} streaming={streaming} />
                  </div>
                ) : (
                  <EmptyState surface="dark" icon={<MessageSquare aria-hidden="true" className="size-4" />} title="No messages yet" description="Send the first message to bring Cofounder into the workspace context." />
                )}

                <ChatComposer catalog={data.catalog} disabled={streaming} onSend={send} />
              </>
            ) : null}

            {!detailLoading && !thread ? (
              <EmptyState
                surface="dark"
                icon={<MessageSquare aria-hidden="true" className="size-4" />}
                title="No thread selected"
                description="Start a thread to ask Cofounder about roadmap, departments, tasks, files, or agents."
                action={{ label: "New conversation", onClick: createThread }}
              />
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
