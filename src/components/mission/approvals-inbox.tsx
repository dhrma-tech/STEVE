"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCheck, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { PendingApproval } from "@/lib/agents/policy/approval-inbox";
import { api, cents, panelClass, RISK } from "./ui";

type Question = { id: string; sessionId: string | null; agent: { name: string } | null; question: string; context: string | null; options: string[] };
type InboxData = { approvals: PendingApproval[]; questions: Question[]; role: string };

const POLL_MS = 5000;

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return !!element && (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable);
}

export function ApprovalsInbox({ orgId, onChanged }: { orgId: string; onChanged: () => void }) {
  const [data, setData] = React.useState<InboxData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState(0);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);
  const refresh = React.useCallback(() => {
    setVersion((v) => v + 1);
    onChanged();
  }, [onChanged]);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      try {
        const next = await api<InboxData>(`/api/orgs/${orgId}/approvals`);
        if (cancelled) return;
        setData(next);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Approvals could not load.");
      }
      if (!cancelled) timer = setTimeout(() => void load(), POLL_MS);
    }
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orgId, version]);

  const approvals = React.useMemo(() => data?.approvals ?? [], [data]);
  const readOnly = data?.role === "viewer";
  const isManager = data?.role === "owner" || data?.role === "admin";
  const current = approvals[Math.min(selected, Math.max(0, approvals.length - 1))];

  const decide = React.useCallback(
    async (approval: PendingApproval, action: "approve" | "deny", scope: "once" | "run" | "always" = "once", editedInput?: Record<string, unknown>) => {
      setBusy(approval.id);
      setError(null);
      setNotice(null);
      try {
        await api(`/api/orgs/${orgId}/approvals/${approval.id}/decide`, {
          method: "POST",
          body: JSON.stringify({ action, scope, editedInput: editedInput ?? null })
        });
        setEditing(null);
        setNotice(`${action === "approve" ? "Approved" : "Denied"}: ${approval.summary}`);
        refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "That did not work.");
      } finally {
        setBusy(null);
      }
    },
    [orgId, refresh]
  );

  function startEdit(approval: PendingApproval) {
    setEditing(approval.id);
    setDraft(JSON.stringify(approval.payload, null, 2));
  }

  function approveEdited(approval: PendingApproval) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setError("The edited arguments are not valid JSON.");
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setError("The edited arguments must be a JSON object.");
      return;
    }
    void decide(approval, "approve", "once", parsed as Record<string, unknown>);
  }

  // Keyboard: j/k to move, a approve once, r approve for this run, e edit, d deny.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (readOnly || isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey || !current) return;
      const key = event.key.toLowerCase();
      if (key === "j") setSelected((index) => Math.min(index + 1, approvals.length - 1));
      else if (key === "k") setSelected((index) => Math.max(index - 1, 0));
      else if (key === "a") void decide(current, "approve");
      else if (key === "r" && !current.alwaysAsk) void decide(current, "approve", "run");
      else if (key === "d") void decide(current, "deny");
      else if (key === "e") startEdit(current);
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [approvals.length, current, decide, readOnly]);

  const batchable = approvals.filter((approval) => approval.batchable);

  async function approveAllLowRisk() {
    setBusy("batch");
    setError(null);
    try {
      const result = await api<{ approved: string[]; skipped: Array<{ id: string; reason: string }> }>(`/api/orgs/${orgId}/approvals/batch`, {
        method: "POST",
        body: JSON.stringify({ approvalIds: batchable.map((approval) => approval.id) })
      });
      setNotice(`Approved ${result.approved.length}${result.skipped.length ? `, skipped ${result.skipped.length}` : ""}.`);
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Batch approval failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <p className="text-sm text-[var(--foreground-50)]">{error ?? "Loading approvals…"}</p>;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--foreground-50)]">
          {readOnly ? "Your role is read-only: you can see what waits, not decide it." : "Keys: j/k move · a approve · r approve for this run · e edit · d deny"}
        </p>
        {batchable.length > 1 && !readOnly ? (
          <Button variant="ghost" size="sm" loading={busy === "batch"} onClick={() => void approveAllLowRisk()}>
            <CheckCheck aria-hidden="true" className="size-3.5" />
            Approve all low-risk ({batchable.length})
          </Button>
        ) : null}
      </div>
      {notice ? <p className="text-xs text-[var(--foreground-60)]">{notice}</p> : null}
      {error ? <p className="text-xs text-[var(--destructive)]">{error}</p> : null}

      {approvals.length === 0 && data.questions.length === 0 ? (
        <EmptyState surface="dark" title="Nothing waiting for you" description="When an agent needs a decision, it shows up here (and by email when email is set up)." />
      ) : null}

      {approvals.map((approval, index) => {
        const risk = RISK[approval.risk] ?? { label: approval.risk, variant: "neutral" as const };
        const isSelected = current?.id === approval.id;
        return (
          <article
            key={approval.id}
            className={`${panelClass} ${isSelected ? "ring-2 ring-[var(--focused)]" : ""}`}
            onClick={() => setSelected(index)}
            aria-busy={busy === approval.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-5">{approval.summary}</p>
                <p className="mt-1 text-xs text-[var(--foreground-50)]">
                  {approval.agent ? `${approval.agent.name} · ${approval.agent.department}` : "Agent"}
                  {approval.taskTitle ? ` · ${approval.taskTitle}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant={risk.variant}>{risk.label}</Badge>
                {approval.alwaysAsk ? <Badge variant="neutral">Always asks</Badge> : null}
              </div>
            </div>
            <p className="text-xs text-[var(--foreground-50)]">
              Run spent {cents(approval.spentCents)}
              {approval.budgetCents ? ` of ${cents(approval.budgetCents)}` : ""}
              {approval.expiresAt ? ` · expires ${new Date(approval.expiresAt).toLocaleString()}` : ""}
            </p>

            {editing === approval.id ? (
              <textarea
                aria-label="Edit the arguments"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={Math.min(14, draft.split("\n").length + 1)}
                className="w-full rounded-[8px] border-[0.8px] border-[var(--input)] bg-[var(--foreground-5)] p-2 font-mono text-[11px] leading-4 text-[var(--foreground-80)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
              />
            ) : (
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-[8px] bg-[var(--foreground-5)] p-2 font-mono text-[11px] leading-4 text-[var(--foreground-80)]">
                {JSON.stringify(approval.payload, null, 2)}
              </pre>
            )}

            <div className="flex flex-wrap gap-2">
              {editing === approval.id ? (
                <>
                  <Button variant="app" size="sm" disabled={readOnly} loading={busy === approval.id} onClick={() => approveEdited(approval)}>
                    Approve edited call
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                    Cancel edit
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="app" size="sm" disabled={readOnly} loading={busy === approval.id} onClick={() => void decide(approval, "approve")}>
                    Approve once
                  </Button>
                  {!approval.alwaysAsk ? (
                    <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => void decide(approval, "approve", "run")}>
                      Approve for this run
                    </Button>
                  ) : null}
                  {!approval.alwaysAsk && isManager ? (
                    <Button variant="ghost" size="sm" onClick={() => void decide(approval, "approve", "always")}>
                      Always for this agent
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => startEdit(approval)}>
                    Edit & approve
                  </Button>
                  <Button variant="danger" size="sm" disabled={readOnly} onClick={() => void decide(approval, "deny")}>
                    Deny
                  </Button>
                </>
              )}
              <Link
                href={`/org/${orgId}/canvas?session=${approval.rootSessionId}`}
                className="inline-flex h-[30px] items-center gap-1.5 rounded-[8px] px-2 text-[13px] text-[var(--foreground-50)] hover:bg-[var(--foreground-8)]"
              >
                <ExternalLink aria-hidden="true" className="size-3.5" />
                Session
              </Link>
            </div>
          </article>
        );
      })}

      {data.questions.map((question) => (
        <QuestionCard key={question.id} orgId={orgId} question={question} readOnly={readOnly} onAnswered={refresh} />
      ))}
    </div>
  );
}

function QuestionCard({ orgId, question, readOnly, onAnswered }: { orgId: string; question: Question; readOnly: boolean; onAnswered: () => void }) {
  const [answer, setAnswer] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function send(text: string) {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orgs/${orgId}/agent-questions/${question.id}/answer`, { method: "POST", body: JSON.stringify({ answer: text.trim() }) });
      onAnswered();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The answer could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={panelClass}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-5">{question.question}</p>
        <Badge variant="warning">Question</Badge>
      </div>
      <p className="text-xs text-[var(--foreground-50)]">{question.agent?.name ?? "An agent"} is waiting for your answer.</p>
      {question.context ? <p className="text-xs leading-5 text-[var(--foreground-60)]">{question.context}</p> : null}
      {question.options.length ? (
        <div className="flex flex-wrap gap-2">
          {question.options.map((option) => (
            <Button key={option} variant="ghost" size="sm" disabled={readOnly || busy} onClick={() => void send(option)}>
              {option}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <textarea
          aria-label="Your answer"
          rows={1}
          value={answer}
          disabled={readOnly}
          onChange={(event) => setAnswer(event.target.value)}
          className="min-h-9 flex-1 resize-none rounded-[8px] border-[0.8px] border-[var(--input)] bg-[var(--foreground-5)] p-2 text-sm text-[var(--foreground-80)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
        />
        <Button variant="app" size="sm" disabled={readOnly || !answer.trim()} loading={busy} onClick={() => void send(answer)}>
          Answer
        </Button>
      </div>
      {error ? <p className="text-xs text-[var(--destructive)]">{error}</p> : null}
    </article>
  );
}
