"use client";

import { MessageSquarePlus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { ChatThreadSummary } from "@/components/chat/types";
import { cn } from "@/lib/utils/cn";

export function ChatThreadList({
  threads,
  selectedThreadId,
  query,
  onQueryChange,
  onSelect,
  onNewThread
}: {
  threads: ChatThreadSummary[];
  selectedThreadId: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (threadId: string) => void;
  onNewThread: () => void;
}) {
  return (
    <section className="grid gap-3 rounded-[12px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Threads</h3>
        <Button variant="app" size="sm" onClick={onNewThread}>
          <MessageSquarePlus aria-hidden="true" className="size-4" />
          New
        </Button>
      </div>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--app-text-50)]" />
        <Input surface="dark" label="Search threads" className="pl-9" value={query} onChange={(event) => onQueryChange(event.target.value)} />
      </div>
      {threads.length ? (
        <div className="grid max-h-[320px] gap-2 overflow-y-auto">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              className={cn(
                "grid gap-2 rounded-[10px] border p-3 text-left outline-none transition-colors hover:bg-[rgba(255,255,255,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]",
                selectedThreadId === thread.id ? "border-[var(--app-primary-light)] bg-[rgba(255,255,255,0.08)]" : "border-[var(--app-border)] bg-[rgba(0,0,0,0.12)]"
              )}
              onClick={() => onSelect(thread.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{thread.title}</span>
                <Badge variant={thread.kind === "cofounder" ? "brand" : thread.kind === "task" ? "running" : "neutral"}>{thread.kind}</Badge>
              </div>
              <p className="line-clamp-2 text-xs leading-5 text-[var(--app-text-50)]">
                {thread.latestMessage?.body ?? thread.task?.title ?? thread.agent?.name ?? "No messages yet"}
              </p>
              <p className="text-[11px] text-[var(--app-text-50)]">{thread.messageCount} messages / {formatDateTime(thread.updatedAt)}</p>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState surface="dark" title="No threads" description="Start a new Cofounder conversation to create the first thread." />
      )}
    </section>
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
