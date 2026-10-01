"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Pause, Play, RotateCcw, Square, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RunDetail } from "@/lib/mission/data";
import { api, cents, duration, KIND_LABEL, panelClass, RISK, RUN_STATUS } from "./ui";

type TimelineItem =
  | { kind: "text"; seq: number; text: string }
  | { kind: "event"; seq: number; type: string; at: string; data: Record<string, unknown> };

/** Consecutive text deltas read as one paragraph; everything else is one row. */
function toTimeline(events: RunDetail["events"]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const event of events) {
    if (event.type === "text_delta") {
      const last = items.at(-1);
      const delta = String(event.data.delta ?? "");
      if (last?.kind === "text") last.text += delta;
      else items.push({ kind: "text", seq: event.seq, text: delta });
      continue;
    }
    items.push({ kind: "event", seq: event.seq, type: event.type, at: event.at, data: event.data });
  }
  return items;
}

const json = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

function EventRow({ item }: { item: Extract<TimelineItem, { kind: "event" }> }) {
  const d = item.data;
  const time = new Date(item.at).toLocaleTimeString();
  const row = (label: string, body: React.ReactNode, variant: "neutral" | "warning" | "danger" | "success" | "running" | "brand" = "neutral") => (
    <li className="grid gap-1 border-l border-[var(--border-10)] pl-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant={variant}>{label}</Badge>
        <span className="text-[var(--foreground-50)]">{time}</span>
      </div>
      {body}
    </li>
  );
  const pre = (value: unknown) => (
    <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-[8px] bg-[var(--foreground-5)] p-2 font-mono text-[11px] leading-4 text-[var(--foreground-80)]">
      {typeof value === "string" ? value.slice(0, 4000) : json(value)}
    </pre>
  );

  switch (item.type) {
    case "tool_call":
      return row(`Calls ${String(d.tool)}`, pre(d.input));
    case "tool_result":
      return row(`${String(d.tool)} ${d.success ? "returned" : "failed"}`, pre(d.output), d.success ? "neutral" : "danger");
    case "approval_required":
      return row("Asked for approval", <p className="text-xs text-[var(--foreground-80)]">{String(d.summary ?? d.tool)} · {RISK[String(d.risk)]?.label ?? String(d.risk ?? "")}</p>, "warning");
    case "delegate_start":
      return row(`${d.kind === "consult" ? "Asked" : "Delegated to"} ${String(d.childAgentSlug)}`, <p className="text-xs text-[var(--foreground-80)]">{String(d.objective ?? "")}</p>, "running");
    case "delegate_done":
      return row(`${String(d.childAgentSlug)} handed back (${String(d.status ?? "done")})`, <p className="text-xs text-[var(--foreground-80)]">{String(d.summary ?? "")}</p>, d.status === "done" ? "success" : "warning");
    case "question_asked":
      return row("Asked the founder", <p className="text-xs text-[var(--foreground-80)]">{String(d.question)}</p>, "warning");
    case "question_answered":
      return row("Founder answered", <p className="text-xs text-[var(--foreground-80)]">{String(d.answer ?? `(${String(d.status)})`)}</p>, "success");
    case "limit_reached":
      return row("Limit reached", <p className="text-xs text-[var(--destructive)]">{String(d.message)}</p>, "danger");
    case "done":
      return row("Finished", null, "success");
    case "error":
      return row("Error", <p className="text-xs text-[var(--destructive)]">{String(d.message)}</p>, "danger");
    default:
      return row(item.type, pre(d));
  }
}

/** One run: what it did step by step (with a replay scrubber), its approvals and children, and manager actions. */
export function RunDetailPanel({ orgId, runId, onClose, onChanged }: { orgId: string; runId: string; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = React.useState<RunDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [position, setPosition] = React.useState<number | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [comment, setComment] = React.useState("");
  const [retryMessage, setRetryMessage] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api<RunDetail>(`/api/orgs/${orgId}/runs/${runId}`);
        if (!cancelled) setDetail(data);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "The run could not load.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orgId, runId, version]);

  const timeline = React.useMemo(() => (detail ? toTimeline(detail.events) : []), [detail]);
  const shown = position === null ? timeline.length : Math.min(position, timeline.length);
  // Replay advances one step every half second and stops by itself at the end.
  const isPlaying = playing && shown < timeline.length;

  React.useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => setPosition((current) => (current ?? 0) + 1), 500);
    return () => clearInterval(timer);
  }, [isPlaying]);

  async function act(label: string, url: string, body?: unknown, done?: (data: unknown) => void) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const data = await api<unknown>(url, { method: "POST", body: JSON.stringify(body ?? {}) });
      done?.(data);
      setVersion((v) => v + 1);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  if (!detail) {
    return (
      <section className={panelClass}>
        {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : <p className="text-sm text-[var(--foreground-50)]">Loading run…</p>}
      </section>
    );
  }

  const { run } = detail;
  const status = RUN_STATUS[run.status] ?? { label: run.status, variant: "neutral" as const };

  return (
    <section className={panelClass} aria-label="Run detail">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">
            {KIND_LABEL[run.kind] ?? run.kind} · {detail.agent?.name ?? "Agent"}
          </p>
          <h3 className="mt-1 text-sm font-medium leading-5">{detail.task?.title ?? run.request.split("\n")[0]}</h3>
          <p className="mt-1 text-xs text-[var(--foreground-50)]">
            {cents(run.costCents)} · {duration(run.elapsedMs)} · {run.turns} turn{run.turns === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={status.variant}>{status.label}</Badge>
          <button
            type="button"
            aria-label="Close run detail"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-[7px] text-[var(--foreground-50)] hover:bg-[var(--foreground-8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      {run.error ? <p className="text-xs text-[var(--destructive)]">{run.error}</p> : null}
      {run.handoff ? <p className="text-sm leading-6 text-[var(--foreground-80)]">{run.handoff.summary}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/org/${orgId}/canvas?session=${run.sessionId}`}
          className="inline-flex h-[30px] items-center gap-1.5 rounded-[8px] border-[0.8px] border-[var(--border-10)] px-3 text-[13px] text-[var(--foreground-60)] hover:bg-[var(--foreground-8)]"
        >
          <ExternalLink aria-hidden="true" className="size-3.5" />
          Open session
        </Link>
        {detail.canCancel ? (
          <Button variant="danger" size="sm" loading={busy === "cancel"} onClick={() => void act("cancel", `/api/orgs/${orgId}/runs/${run.id}/cancel`)}>
            <Square aria-hidden="true" className="size-3.5" />
            Cancel run
          </Button>
        ) : null}
        {detail.canRetry && retryMessage === null ? (
          <Button variant="ghost" size="sm" onClick={() => setRetryMessage(run.request)}>
            <RotateCcw aria-hidden="true" className="size-3.5" />
            Retry
          </Button>
        ) : null}
      </div>

      {retryMessage !== null ? (
        <div className="grid gap-2">
          <label className="text-xs text-[var(--foreground-50)]" htmlFor={`retry-${run.id}`}>
            Run it again with this instruction (change it to fork the run):
          </label>
          <textarea
            id={`retry-${run.id}`}
            value={retryMessage}
            onChange={(event) => setRetryMessage(event.target.value)}
            rows={3}
            className="rounded-[8px] border-[0.8px] border-[var(--input)] bg-[var(--foreground-5)] p-2 text-sm text-[var(--foreground-80)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
          />
          <div className="flex gap-2">
            <Button
              variant="app"
              size="sm"
              loading={busy === "retry"}
              onClick={() =>
                void act("retry", `/api/orgs/${orgId}/runs/${run.id}/retry`, { message: retryMessage }, () => {
                  setRetryMessage(null);
                  setNotice("Started again. It shows at the top of the live list.");
                })
              }
            >
              Start again
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRetryMessage(null)}>
              Never mind
            </Button>
          </div>
        </div>
      ) : null}

      {timeline.length ? (
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-medium">Timeline</h4>
            <button
              type="button"
              aria-label={isPlaying ? "Pause replay" : "Replay"}
              onClick={() => {
                if (isPlaying) setPlaying(false);
                else {
                  setPosition(shown >= timeline.length ? 0 : shown);
                  setPlaying(true);
                }
              }}
              className="grid size-7 place-items-center rounded-[7px] text-[var(--foreground-60)] hover:bg-[var(--foreground-8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
            >
              {isPlaying ? <Pause aria-hidden="true" className="size-3.5" /> : <Play aria-hidden="true" className="size-3.5" />}
            </button>
            <input
              type="range"
              min={0}
              max={timeline.length}
              value={shown}
              aria-label="Replay position"
              onChange={(event) => {
                setPlaying(false);
                const value = Number(event.target.value);
                setPosition(value >= timeline.length ? null : value);
              }}
              className="flex-1 accent-[var(--primary)]"
            />
            <span className="w-14 text-right text-[11px] text-[var(--foreground-50)]">
              {shown}/{timeline.length}
            </span>
          </div>
          <ol className="grid max-h-[420px] gap-3 overflow-y-auto pr-1">
            {timeline.slice(0, shown).map((item) =>
              item.kind === "text" ? (
                <li key={`t-${item.seq}`} className="whitespace-pre-wrap border-l border-[var(--border-10)] pl-3 text-xs leading-5 text-[var(--foreground-80)]">
                  {item.text}
                </li>
              ) : (
                <EventRow key={item.seq} item={item} />
              )
            )}
          </ol>
        </div>
      ) : (
        <p className="text-xs text-[var(--foreground-50)]">No events yet.</p>
      )}

      {detail.children.length ? (
        <div className="grid gap-1">
          <h4 className="text-xs font-medium">Teammates</h4>
          {detail.children.map((child) => (
            <p key={child.runId} className="text-xs text-[var(--foreground-60)]">
              {child.agentName} · {KIND_LABEL[child.kind] ?? child.kind} · {RUN_STATUS[child.status]?.label ?? child.status} · {cents(child.costCents)}
            </p>
          ))}
        </div>
      ) : null}

      {detail.approvals.length ? (
        <div className="grid gap-1">
          <h4 className="text-xs font-medium">Approvals</h4>
          {detail.approvals.map((approval) => (
            <p key={approval.id} className="text-xs text-[var(--foreground-60)]">
              {approval.summary} · {approval.status}
              {approval.decisionScope && approval.decisionScope !== "once" ? ` (${approval.decisionScope})` : ""}
              {approval.edited ? " · edited" : ""}
            </p>
          ))}
        </div>
      ) : null}

      {detail.task ? (
        <div className="grid gap-2">
          <label htmlFor={`comment-${run.id}`} className="text-xs font-medium">
            Comment (goes to the task chat)
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id={`comment-${run.id}`}
              rows={1}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="min-h-9 flex-1 resize-none rounded-[8px] border-[0.8px] border-[var(--input)] bg-[var(--foreground-5)] p-2 text-sm text-[var(--foreground-80)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={!comment.trim()}
              loading={busy === "comment"}
              onClick={() =>
                void act("comment", `/api/orgs/${orgId}/runs/${run.id}/comments`, { body: comment.trim() }, () => {
                  setComment("");
                  setNotice("Comment added to the task chat.");
                })
              }
            >
              Post
            </Button>
          </div>
        </div>
      ) : null}

      {notice ? <p className="text-xs text-[var(--foreground-60)]">{notice}</p> : null}
      {error ? <p className="text-xs text-[var(--destructive)]">{error}</p> : null}
    </section>
  );
}
