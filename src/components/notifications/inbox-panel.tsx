"use client";

import * as React from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import type { InboxItem, InboxState } from "@/lib/notifications/inbox";

type InboxPayload = {
  data?: InboxState;
};

export function InboxPanel({
  orgId,
  open,
  onOpenChange,
  onUnreadCountChange
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnreadCountChange: (count: number) => void;
}) {
  const [state, setState] = React.useState<InboxState | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    fetch(`/api/orgs/${orgId}/inbox`)
      .then((response) => response.json() as Promise<InboxPayload>)
      .then((payload) => {
        if (cancelled) return;
        setState(payload.data ?? { items: [], unreadCount: 0, empty: true });
        onUnreadCountChange(payload.data?.unreadCount ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setState({ items: [], unreadCount: 0, empty: true });
        onUnreadCountChange(0);
      });

    return () => {
      cancelled = true;
    };
  }, [open, orgId, onUnreadCountChange]);

  async function markRead(item: InboxItem) {
    const response = await fetch(`/api/orgs/${orgId}/inbox/${encodeURIComponent(item.id)}/read`, {
      method: "POST"
    });
    const payload = (await response.json()) as { data?: { unreadCount: number } };
    setState((current) =>
      current
        ? {
            ...current,
            items: current.items.map((candidate) => (candidate.id === item.id ? { ...candidate, read: true } : candidate)),
            unreadCount: payload.data?.unreadCount ?? current.unreadCount,
            empty: (payload.data?.unreadCount ?? current.unreadCount) === 0
          }
        : current
    );
    onUnreadCountChange(payload.data?.unreadCount ?? 0);
  }

  async function markAll() {
    const response = await fetch(`/api/orgs/${orgId}/inbox/read-all`, { method: "POST" });
    const payload = (await response.json()) as InboxPayload;
    setState(payload.data ?? { items: [], unreadCount: 0, empty: true });
    onUnreadCountChange(0);
  }

  const items = state?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-4 top-4 h-[calc(100dvh-32px)] max-w-[420px] translate-x-0 translate-y-0 content-start overflow-hidden p-0">
        <DialogHeader className="border-b border-[var(--app-border)] p-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <Bell aria-hidden="true" className="size-4 text-[var(--app-primary-light)]" />
            Inbox
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
          <Badge variant={state?.unreadCount ? "warning" : "success"}>{state?.unreadCount ?? 0} unread</Badge>
          <Button variant="ghost" size="sm" onClick={markAll} disabled={!state || state.unreadCount === 0}>
            <CheckCheck aria-hidden="true" className="size-4" />
            Read all
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          {!state ? (
            <div className="flex items-center gap-2 py-8 text-sm text-[var(--app-text-50)]">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Loading inbox
            </div>
          ) : state?.empty ? (
            <EmptyState surface="dark" title="All caught up" description="Unread notifications will appear here when agents, roadmap items, files, or integrations need attention." />
          ) : (
            <div className="grid gap-2">
              {items.map((item) => (
                <article key={item.id} className="grid gap-3 rounded-[10px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium text-[var(--app-text)]">{item.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-[var(--app-text-50)]">{item.description}</p>
                    </div>
                    <Badge variant={item.read ? "neutral" : "warning"}>{item.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <a className="text-xs text-[var(--app-primary-light)] hover:underline" href={item.href}>
                      Open
                    </a>
                    {!item.read ? (
                      <button type="button" className="text-xs text-[var(--app-text-50)] hover:text-[var(--app-text)]" onClick={() => markRead(item)}>
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
