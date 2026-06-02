"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2, ChevronDown, ChevronRight, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ── Public types (consumed by agent-workspace-dialog) ─────────────────────────

export type FeedItem =
  | { kind: "text"; text: string; id: string }
  | { kind: "tool"; name: string; input: unknown; output?: string; success?: boolean; id: string }
  | { kind: "delegation"; agentSlug: string; sessionId: string; output?: string; id: string };

// ── Root feed component ───────────────────────────────────────────────────────

export function ExecutionFeed({ items, agentSlug }: { items: FeedItem[]; agentSlug: string }) {
  return (
    <div className="font-mono text-[13px] leading-[1.7]">
      {/* Invocation line */}
      <div className="mb-3 flex flex-wrap gap-1">
        <span style={{ color: "var(--terminal-green)" }}>$&nbsp;</span>
        <span style={{ color: "var(--terminal-text-bright)" }}>{agentSlug}</span>
        <span style={{ color: "var(--terminal-text-muted)" }}>&nbsp;--stream</span>
      </div>

      {items.map((item) => {
        if (item.kind === "text") return <TextBlock key={item.id} text={item.text} />;
        if (item.kind === "tool") return <ToolCard key={item.id} item={item} />;
        if (item.kind === "delegation") return <DelegationCard key={item.id} item={item} />;
        return null;
      })}

      {/* Blinking cursor */}
      <div className="mt-1 flex items-center gap-1.5">
        <span style={{ color: "var(--terminal-amber)" }}>$&nbsp;</span>
        <span
          className="inline-block animate-pulse"
          style={{ width: 7, height: 14, background: "var(--terminal-amber)" }}
        />
      </div>
    </div>
  );
}

// ── Text delta block ──────────────────────────────────────────────────────────

function TextBlock({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="mb-2">
      {text.split("\n").map((line, i) => (
        <div key={i} className="flex gap-2">
          <span className="shrink-0 select-none" style={{ color: "var(--terminal-text-muted)" }}>›</span>
          <span style={{ color: "var(--terminal-text)" }}>{line || " "}</span>
        </div>
      ))}
    </div>
  );
}

// ── Tool call card ────────────────────────────────────────────────────────────

function ToolCard({ item }: { item: Extract<FeedItem, { kind: "tool" }> }) {
  const [open, setOpen] = React.useState(false);
  const done = item.output !== undefined;

  return (
    <div
      className={cn(
        "mb-2 overflow-hidden rounded-[6px] border",
        done
          ? item.success !== false
            ? "border-[var(--border-10)]"
            : "border-[var(--destructive)]/30"
          : "border-[var(--primary)]/30"
      )}
      style={{ background: "var(--foreground-3)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--foreground-5)]"
      >
        {done ? (
          item.success !== false ? (
            <CheckCircle2 className="size-3.5 shrink-0 text-[var(--tt-color-text-green-contrast)]" />
          ) : (
            <XCircle className="size-3.5 shrink-0 text-[var(--destructive)]" />
          )
        ) : (
          <Loader2 className="size-3.5 shrink-0 animate-spin" style={{ color: "var(--primary)" }} />
        )}
        <span className="flex-1 text-xs font-medium" style={{ color: "var(--terminal-text-bright)" }}>
          {done ? "Used" : "Using"}:{" "}
          <code className="font-mono text-[var(--primary)]">{item.name}</code>
        </span>
        {open ? (
          <ChevronDown className="size-3 shrink-0" style={{ color: "var(--terminal-text-muted)" }} />
        ) : (
          <ChevronRight className="size-3 shrink-0" style={{ color: "var(--terminal-text-muted)" }} />
        )}
      </button>

      {open && (
        <div
          className="border-t px-3 pb-3 pt-2"
          style={{ borderColor: "var(--border-10)", background: "var(--terminal-bg)" }}
        >
          <p className="mb-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--terminal-text-muted)" }}>
            Input
          </p>
          <pre
            className="mb-2 whitespace-pre-wrap break-all text-[11px]"
            style={{ color: "var(--terminal-text)" }}
          >
            {JSON.stringify(item.input, null, 2)}
          </pre>
          {item.output !== undefined && (
            <>
              <p className="mb-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--terminal-text-muted)" }}>
                Output
              </p>
              <pre
                className="whitespace-pre-wrap break-all text-[11px]"
                style={{ color: item.success !== false ? "var(--terminal-text)" : "var(--destructive)" }}
              >
                {item.output.slice(0, 600)}
                {item.output.length > 600 ? "\n…" : ""}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Delegation card ───────────────────────────────────────────────────────────

function DelegationCard({ item }: { item: Extract<FeedItem, { kind: "delegation" }> }) {
  const [open, setOpen] = React.useState(false);
  const done = item.output !== undefined;

  return (
    <div
      className="mb-2 overflow-hidden rounded-[6px] border"
      style={{
        background: "var(--foreground-3)",
        borderColor: done ? "var(--border-10)" : "rgba(139,92,246,0.35)"
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--foreground-5)]"
      >
        {done ? (
          <CheckCircle2 className="size-3.5 shrink-0 text-[var(--tt-color-text-green-contrast)]" />
        ) : (
          <Loader2 className="size-3.5 shrink-0 animate-spin" style={{ color: "rgb(139,92,246)" }} />
        )}
        <ArrowRight className="size-3 shrink-0" style={{ color: "rgb(139,92,246)" }} />
        <span className="flex-1 text-xs font-medium" style={{ color: "var(--terminal-text-bright)" }}>
          {done ? "Delegated to" : "Delegating to"}:{" "}
          <code className="font-mono" style={{ color: "rgb(139,92,246)" }}>{item.agentSlug}</code>
        </span>
        {open ? (
          <ChevronDown className="size-3 shrink-0" style={{ color: "var(--terminal-text-muted)" }} />
        ) : (
          <ChevronRight className="size-3 shrink-0" style={{ color: "var(--terminal-text-muted)" }} />
        )}
      </button>

      {open && item.output && (
        <div
          className="border-t px-3 pb-3 pt-2"
          style={{ borderColor: "var(--border-10)", background: "var(--terminal-bg)" }}
        >
          <p className="mb-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--terminal-text-muted)" }}>
            Output
          </p>
          <pre className="whitespace-pre-wrap break-all text-[11px]" style={{ color: "var(--terminal-text)" }}>
            {item.output.slice(0, 600)}
            {item.output.length > 600 ? "\n…" : ""}
          </pre>
        </div>
      )}
    </div>
  );
}
