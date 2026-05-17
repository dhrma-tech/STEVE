"use client";

import * as React from "react";
import { MessageSquare } from "lucide-react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { MessageList } from "@/components/chat/message-renderer";
import type { ChatThreadDetail, ChatWorkspacePayload } from "@/components/chat/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
  const [loading, setLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = React.useState(0);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const refresh = React.useCallback(() => setRefreshIndex((i) => i + 1), []);

  // Scroll to bottom whenever messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages, streaming]);

  // Load threads
  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ kind: initialKind });

    queueMicrotask(() => setLoading(true));
    fetch(`/api/orgs/${orgId}/chat/threads?${params.toString()}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<ApiPayload<ChatWorkspacePayload>>)
      .then((payload) => {
        if (!payload.data) throw new Error(payload.error?.message ?? "Chat did not load.");
        setData(payload.data);
        setError(null);
        if (!selectedThreadId && payload.data.threads[0]) {
          setSelectedThreadId(payload.data.threads[0].id);
        } else if (selectedThreadId && !payload.data.threads.some((t) => t.id === selectedThreadId)) {
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
  }, [initialKind, orgId, refreshIndex, selectedThreadId]);

  // Load thread detail
  React.useEffect(() => {
    if (!selectedThreadId) {
      queueMicrotask(() => setThread(null));
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => setDetailLoading(true));
    fetch(`/api/orgs/${orgId}/chat/threads/${selectedThreadId}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<ApiPayload<ChatThreadDetail>>)
      .then((payload) => {
        if (!payload.data) throw new Error();
        setThread(payload.data);
      })
      .catch(() => { if (!controller.signal.aborted) setThread(null); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [orgId, selectedThreadId]);

  async function createThread() {
    setError(null);
    const title = initialKind === "cofounder" ? "Cofounder chat" : "New chat";
    const response = await fetch(`/api/orgs/${orgId}/chat/threads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: initialKind, title })
    });
    const payload = (await response.json()) as ApiPayload<ChatThreadDetail>;
    if (!response.ok || !payload.data) return;
    setSelectedThreadId(payload.data.id);
    setThread(payload.data);
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
          setThread((cur) => (cur ? appendOptimisticAssistantMessage(cur) : cur));
        },
        onAssistantDelta: (delta) => {
          setThread((cur) => (cur ? appendAssistantDelta(cur, delta) : cur));
        },
        onComplete: (finalThread) => {
          setThread(finalThread);
          refresh();
        }
      });
      return succeeded;
    } catch {
      setThread(thread);
      return false;
    } finally {
      setStreaming(false);
    }
  }

  // ── Render ──────────────────────────────────────────────

  if (loading) {
    return <LoadingState rows={4} label="Loading chat" />;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3 py-4 text-center">
        <p className="text-xs text-[var(--foreground-50)]">{error}</p>
        <Button variant="ghost" size="sm" onClick={refresh}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ minHeight: "360px" }}>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        {detailLoading ? (
          <LoadingState rows={4} label="Loading messages" />
        ) : thread?.messages.length ? (
          <>
            <MessageList messages={thread.messages} streaming={streaming} />
            <div ref={messagesEndRef} />
          </>
        ) : (
          <EmptyState
            surface="dark"
            icon={<MessageSquare className="size-4" aria-hidden="true" />}
            title="Start a conversation"
            description="Ask about your roadmap, tasks, departments, or agents."
            action={!thread ? { label: "New chat", onClick: () => void createThread() } : undefined}
          />
        )}
      </div>

      {/* Composer */}
      {thread ? (
        <div className="shrink-0 pt-3">
          <ChatComposer catalog={data?.catalog ?? null} disabled={streaming} onSend={send} />
        </div>
      ) : (
        <div className="shrink-0 pt-3">
          <Button variant="app" size="sm" className="w-full" onClick={() => void createThread()}>
            New conversation
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

type ChatMessage = ChatThreadDetail["messages"][number];
const OPTIMISTIC_USER_ID = "optimistic:user";
const OPTIMISTIC_ASSISTANT_ID = "optimistic:assistant";

function appendOptimisticUserMessage(thread: ChatThreadDetail, body: string): ChatThreadDetail {
  const filtered = thread.messages.filter((m) => !isOptimistic(m));
  const msg: ChatMessage = {
    id: OPTIMISTIC_USER_ID,
    senderType: "user",
    senderUser: null,
    senderAgent: null,
    body: body.trim(),
    metadata: { kind: "user_message", optimistic: true },
    createdAt: new Date().toISOString(),
    editedAt: null
  };
  return { ...thread, messages: [...filtered, msg], messageCount: filtered.length + 1 };
}

function appendOptimisticAssistantMessage(thread: ChatThreadDetail): ChatThreadDetail {
  if (thread.messages.some((m) => m.id === OPTIMISTIC_ASSISTANT_ID)) return thread;
  const msg: ChatMessage = {
    id: OPTIMISTIC_ASSISTANT_ID,
    senderType: "agent",
    senderUser: null,
    senderAgent: null,
    body: "",
    metadata: { kind: "ai_response", optimistic: true, streaming: true },
    createdAt: new Date().toISOString(),
    editedAt: null
  };
  return { ...thread, messages: [...thread.messages, msg], messageCount: thread.messageCount + 1 };
}

function appendAssistantDelta(thread: ChatThreadDetail, delta: string): ChatThreadDetail {
  return {
    ...thread,
    messages: thread.messages.map((m) =>
      m.id === OPTIMISTIC_ASSISTANT_ID ? { ...m, body: m.body + delta } : m
    )
  };
}

function isOptimistic(m: ChatMessage) {
  return m.id === OPTIMISTIC_USER_ID || m.id === OPTIMISTIC_ASSISTANT_ID;
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

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const parsed = parseSseEvent(raw);
      if (!parsed) continue;

      if (parsed.event === "thinking" || parsed.event === "token") {
        if (!assistantStarted) { assistantStarted = true; onAssistantStart(); }
      }
      if (parsed.event === "token") {
        const delta = typeof parsed.data?.delta === "string" ? parsed.data.delta : "";
        if (delta) onAssistantDelta(delta);
      } else if (parsed.event === "complete") {
        const d = parsed.data as { thread?: ChatThreadDetail } | undefined;
        if (d?.thread) { completed = true; onComplete(d.thread); }
      } else if (parsed.event === "error") {
        throw new Error(typeof parsed.data?.message === "string" ? parsed.data.message : "Stream failed.");
      }
    }
  }

  if (!completed) throw new Error("Stream ended before completion.");
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
  try { return { event, data: JSON.parse(dataLine) as Record<string, unknown> }; }
  catch { return null; }
}
