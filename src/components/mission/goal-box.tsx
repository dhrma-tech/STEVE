"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * "What outcome do you want?" — the founder states a goal and the Chief of Staff plans it. The plan waits for the
 * founder's review before anything runs.
 */
export function GoalBox({
  orgId,
  onPlanned,
  compact = false
}: {
  orgId: string;
  onPlanned: (result: { planId: string; sessionId: string }) => void;
  compact?: boolean;
}) {
  const [goal, setGoal] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    const text = goal.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}/plans`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goal: text })
      });
      const payload = (await response.json().catch(() => null)) as { data?: { plan: { id: string }; sessionId: string }; error?: { message?: string } } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.error?.message ?? "The goal could not be planned.");
      setGoal("");
      onPlanned({ planId: payload.data.plan.id, sessionId: payload.data.sessionId });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The goal could not be planned.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-2 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3 shadow-[var(--shadow-outset-100)]">
      <label htmlFor={`goal-${orgId}`} className="text-sm font-medium">
        What outcome do you want?
      </label>
      {compact ? null : (
        <p className="text-xs leading-5 text-[var(--foreground-50)]">The Chief of Staff plans it across departments. You review the plan before anything starts.</p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          id={`goal-${orgId}`}
          rows={compact ? 1 : 2}
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Launch our landing page and announce it"
          disabled={busy}
          className="min-h-9 flex-1 resize-none rounded-[8px] border-[0.8px] border-[var(--input)] bg-[var(--foreground-5)] px-3 py-2 text-sm text-[var(--foreground-80)] caret-[var(--caret)] outline-none placeholder:text-[var(--foreground-30)] focus-visible:ring-2 focus-visible:ring-[var(--focused)] disabled:opacity-50"
        />
        <Button variant="app" size="sm" onClick={() => void submit()} loading={busy} disabled={goal.trim().length < 3}>
          <Sparkles aria-hidden="true" className="size-4" />
          Plan it
        </Button>
      </div>
      {error ? <p className="text-xs text-[var(--destructive)]">{error}</p> : null}
    </section>
  );
}
