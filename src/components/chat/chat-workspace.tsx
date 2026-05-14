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

    const optimisticThread = appendOptimisticUserMessage(thread, input.body);
    setThread(optimisticThread);

    try {
      const succeeded = await streamChatResponse({
        orgId,
        threadId: thread.id,
        input,
        onAssistantStart: () => {
          setThread((current) => (current ? appendOptimisticAssistantMessage(current) : current));
        },
        onAssistantDelta: (delta) => {
          setThread((current) => (current ? appendAssistantDelta(current, delta) : current));
        },
        onComplete: (finalThread) => {
          setThread(finalThread);
          refresh();
        }
      });
      return succeeded;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Message could not be sent.");
      setThread(thread);
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
          <span className="grid size-9 place-items-center rounded-[9px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)]">
            <Bot aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">Chat</p>
            <h2 className="text-lg font-medium tracking-[0px]">Cofounder chat</h2>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={refresh}>
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

          <section className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-3">
            {detailLoading ? <LoadingState rows={8} label="Loading thread" /> : null}
            {!detailLoading && thread ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-medium">{thread.title}</h3>
                      <Badge variant={thread.kind === "cofounder" ? "brand" : "neutral"}>{thread.kind}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[var(--foreground-50)]">
                      {thread.messageCount} messages{selectedSummary?.task ? ` / ${selectedSummary.task.title}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={archiveThread}>
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

type ChatMessage = ChatThreadDetail["messages"][number];

const OPTIMISTIC_USER_ID = "optimistic:user";
const OPTIMISTIC_ASSISTANT_ID = "optimistic:assistant";

function appendOptimisticUserMessage(thread: ChatThreadDetail, body: string): ChatThreadDetail {
  const filtered = thread.messages.filter((message) => !isOptimistic(message));
  const optimistic: ChatMessage = {
    id: OPTIMISTIC_USER_ID,
    senderType: "user",
    senderUser: null,
    senderAgent: null,
    body: body.trim(),
    metadata: { kind: "user_message", optimistic: true },
    createdAt: new Date().toISOString(),
    editedAt: null
  };
  return {
    ...thread,
    messages: [...filtered, optimistic],
    messageCount: filtered.length + 1
  };
}

function appendOptimisticAssistantMessage(thread: ChatThreadDetail): ChatThreadDetail {
  if (thread.messages.some((message) => message.id === OPTIMISTIC_ASSISTANT_ID)) return thread;
  const optimistic: ChatMessage = {
    id: OPTIMISTIC_ASSISTANT_ID,
    senderType: "agent",
    senderUser: null,
    senderAgent: null,
    body: "",
    metadata: { kind: "ai_response", optimistic: true, streaming: true },
    createdAt: new Date().toISOString(),
    editedAt: null
  };
  return {
    ...thread,
    messages: [...thread.messages, optimistic],
    messageCount: thread.messageCount + 1
  };
}

function appendAssistantDelta(thread: ChatThreadDetail, delta: string): ChatThreadDetail {
  return {
    ...thread,
    messages: thread.messages.map((message) =>
      message.id === OPTIMISTIC_ASSISTANT_ID ? { ...message, body: message.body + delta } : message
    )
  };
}

function isOptimistic(message: ChatMessage) {
  return message.id === OPTIMISTIC_USER_ID || message.id === OPTIMISTIC_ASSISTANT_ID;
}

type StreamArgs = {
  orgId: string;
  threadId: string;
  input: { body: string; mentions: string[]; attachmentNames: string[] };
  onAssistantStart: () => void;
  onAssistantDelta: (delta: string) => void;
  onComplete: (thread: ChatThreadDetail) => void;
};

async function streamChatResponse({ orgId, threadId, input, onAssistantStart, onAssistantDelta, onComplete }: StreamArgs) {
  const response = await fetch(`/api/orgs/${orgId}/chat/threads/${threadId}/messages/stream`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(input)
  });

  if (!response.ok || !response.body) {
    const fallback = await response.json().catch(() => ({} as { error?: { message?: string } }));
    throw new Error(fallback?.error?.message ?? "Message could not be sent.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantStarted = false;
  let completed = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separator: number;
    while ((separator = buffer.indexOf("\n\n")) >= 0) {
      const rawEvent = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const parsed = parseSseEvent(rawEvent);
      if (!parsed) continue;

      if (parsed.event === "thinking" || parsed.event === "token") {
        if (!assistantStarted) {
          assistantStarted = true;
          onAssistantStart();
        }
      }

      if (parsed.event === "token") {
        const delta = typeof parsed.data?.delta === "string" ? parsed.data.delta : "";
        if (delta) onAssistantDelta(delta);
      } else if (parsed.event === "complete") {
        const data = parsed.data as { thread?: ChatThreadDetail } | undefined;
        if (data?.thread) {
          completed = true;
          onComplete(data.thread);
        }
      } else if (parsed.event === "error") {
        const message = typeof parsed.data?.message === "string" ? parsed.data.message : "Stream failed.";
        throw new Error(message);
      }
    }
  }

  if (!completed) {
    throw new Error("Stream ended before completion.");
  }
  return true;
}

function parseSseEvent(raw: string): { event: string; data: Record<string, unknown> | undefined } | null {
  const lines = raw.split("\n");
  let event = "message";
  let dataLine = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return { event, data: undefined };
  try {
    return { event, data: JSON.parse(dataLine) as Record<string, unknown> };
  } catch {
    return null;
  }
}
