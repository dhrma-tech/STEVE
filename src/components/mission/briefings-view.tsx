"use client";

import * as React from "react";
import { Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { api, panelClass } from "./ui";

type Briefing = {
  id: string;
  period: string;
  status: string;
  text: string | null;
  periodEnd: string;
  emailedAt: string | null;
  createdAt: string;
  byChiefOfStaff: boolean;
};

export function BriefingsView({ orgId, readOnly }: { orgId: string; readOnly: boolean }) {
  const [briefings, setBriefings] = React.useState<Briefing[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      try {
        const data = await api<{ briefings: Briefing[] }>(`/api/orgs/${orgId}/briefings`);
        if (cancelled) return;
        setBriefings(data.briefings);
        // Follow a briefing that is still being written.
        if (data.briefings.some((b) => b.status === "writing")) timer = setTimeout(() => void load(), 3000);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Briefings could not load.");
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orgId, version]);

  async function writeNow() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orgs/${orgId}/briefings`, { method: "POST", body: "{}" });
      setVersion((v) => v + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The briefing could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--foreground-50)]">A daily briefing arrives each morning when agents have been working (and by email when email is set up).</p>
        {!readOnly ? (
          <Button variant="ghost" size="sm" loading={busy} onClick={() => void writeNow()}>
            <Newspaper aria-hidden="true" className="size-3.5" />
            Brief me now
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-[var(--destructive)]">{error}</p> : null}
      {briefings === null ? <p className="text-sm text-[var(--foreground-50)]">Loading…</p> : null}
      {briefings?.length === 0 ? <EmptyState surface="dark" title="No briefings yet" description="Ask for one now, or wait for tomorrow morning's." /> : null}
      {briefings?.map((briefing) => (
        <article key={briefing.id} className={panelClass}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              {briefing.period === "manual" ? "Briefing" : `${briefing.period[0]!.toUpperCase()}${briefing.period.slice(1)} briefing`} ·{" "}
              {new Date(briefing.createdAt).toLocaleString()}
            </h3>
            <div className="flex gap-1.5">
              {briefing.status === "writing" ? <Badge variant="running">Writing…</Badge> : null}
              {briefing.status === "ready" && !briefing.byChiefOfStaff ? <Badge variant="neutral">From the records</Badge> : null}
              {briefing.emailedAt ? <Badge variant="neutral">Emailed</Badge> : null}
            </div>
          </div>
          {briefing.text ? <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--foreground-80)]">{briefing.text.replace(/\*\*/g, "")}</p> : null}
        </article>
      ))}
    </div>
  );
}
