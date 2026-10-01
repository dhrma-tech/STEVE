"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import type { RunHealth } from "@/lib/observability/run-metrics";
import { RunDetailPanel } from "./run-detail";
import { api, cents, duration, KIND_LABEL, panelClass, RUN_STATUS } from "./ui";

const WINDOWS = [1, 7, 30] as const;
const POLL_MS = 15000;

const pct = (value: number | null) => (value == null ? "—" : `${Math.round(value * 100)}%`);
const ms = (value: number | null) => (value == null ? "—" : duration(value));
const tokens = (value: number) => (value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1000 ? `${Math.round(value / 1000)}k` : String(value));

function Metric({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "warning" }) {
  return (
    <div className={`${panelClass} gap-1`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">{label}</p>
      <p className={`text-xl font-medium ${tone === "warning" ? "text-[var(--alert)]" : ""}`}>{value}</p>
      {detail ? <p className="text-xs text-[var(--foreground-50)]">{detail}</p> : null}
    </div>
  );
}

/** Run health: how reliable, fast and expensive the agents are, and a table of recent runs to drill into. */
export function HealthView({ orgId, onChanged }: { orgId: string; onChanged: () => void }) {
  const [days, setDays] = React.useState<(typeof WINDOWS)[number]>(7);
  const [health, setHealth] = React.useState<RunHealth | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      try {
        const data = await api<RunHealth>(`/api/orgs/${orgId}/mission/health?days=${days}`);
        if (!cancelled) {
          setHealth(data);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Run health could not load.");
      }
      if (!cancelled) timer = setTimeout(() => void load(), POLL_MS);
    }
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orgId, days]);

  const h = health;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--foreground-50)]">
          {h ? `${h.runs.total} runs (${h.runs.roots} started by people or plans) in the last ${h.windowDays === 1 ? "day" : `${h.windowDays} days`}` : "Loading…"}
        </p>
        <div role="group" aria-label="Time window" className="flex gap-1 rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-5)] p-1">
          {WINDOWS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={days === value}
              onClick={() => setDays(value)}
              className={`rounded-[6px] px-2.5 py-1 font-mono text-[11px] ${days === value ? "bg-[var(--foreground-10)] text-[var(--foreground)]" : "text-[var(--foreground-50)] hover:text-[var(--foreground-80)]"}`}
            >
              {value === 1 ? "24h" : `${value}d`}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric
          label="Success rate"
          value={pct(h?.runs.successRate ?? null)}
          detail={h ? `${h.runs.byStatus.completed ?? 0} done · ${h.runs.byStatus.failed ?? 0} failed` : undefined}
          tone={h?.runs.successRate != null && h.runs.successRate < 0.8 ? "warning" : undefined}
        />
        <Metric label="Run time" value={ms(h?.runs.durationMs.p50 ?? null)} detail={h ? `p95 ${ms(h.runs.durationMs.p95)}` : undefined} />
        <Metric
          label="Cost per run"
          value={cents(h?.cost.perRootRunCents ?? null)}
          detail={h ? `${cents(h.cost.totalCents)} total · cache hits ${pct(h.cost.cacheHitRate)}` : undefined}
        />
        <Metric
          label="Approval wait"
          value={ms(h?.approvals.waitMs.p50 ?? null)}
          detail={h ? `p95 ${ms(h.approvals.waitMs.p95)} · ${h.approvals.pending} pending` : undefined}
        />
        <Metric label="Replan rate" value={pct(h?.plans.replanRate ?? null)} detail={h ? `${h.plans.replanned} of ${h.plans.total} plans` : undefined} />
        <Metric
          label="Injections caught"
          value={h ? String(h.safety.injectionsSuspected) : "—"}
          detail="Suspicious instructions in tool output"
          tone={h?.safety.injectionsSuspected ? "warning" : undefined}
        />
        <Metric label="Fallback turns" value={h ? String(h.safety.fallbackTurns) : "—"} detail="Answered by a backup model" />
        <Metric label="Limit stops" value={h ? String(h.safety.limitStops) : "—"} detail="Runs stopped by a budget or step limit" />
      </div>

      {h && h.cost.byModel.length > 0 ? (
        <section className={panelClass}>
          <h2 className="text-sm font-medium">Cost by model</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">
                <tr>
                  <th className="py-1.5 pr-3 font-normal">Model</th>
                  <th className="py-1.5 pr-3 font-normal">Turns</th>
                  <th className="py-1.5 pr-3 font-normal">Input</th>
                  <th className="py-1.5 pr-3 font-normal">Cached</th>
                  <th className="py-1.5 pr-3 font-normal">Output</th>
                  <th className="py-1.5 font-normal">Cost</th>
                </tr>
              </thead>
              <tbody>
                {h.cost.byModel.map((row) => (
                  <tr key={row.modelId} className="border-t border-[var(--border-10)]">
                    <td className="py-1.5 pr-3 font-mono">{row.modelId}</td>
                    <td className="py-1.5 pr-3">{row.turns}</td>
                    <td className="py-1.5 pr-3">{tokens(row.inputTokens)}</td>
                    <td className="py-1.5 pr-3">{tokens(row.cacheReadTokens)}</td>
                    <td className="py-1.5 pr-3">{tokens(row.outputTokens)}</td>
                    <td className="py-1.5">{cents(row.costCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className={`grid gap-4 ${selected ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
        <section className={panelClass}>
          <h2 className="text-sm font-medium">Recent runs</h2>
          {h && h.recent.length === 0 ? <p className="text-sm text-[var(--foreground-50)]">No runs in this window.</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">
                <tr>
                  <th className="py-1.5 pr-3 font-normal">Agent</th>
                  <th className="py-1.5 pr-3 font-normal">Kind</th>
                  <th className="py-1.5 pr-3 font-normal">Status</th>
                  <th className="py-1.5 pr-3 font-normal">Steps</th>
                  <th className="py-1.5 pr-3 font-normal">Time</th>
                  <th className="py-1.5 pr-3 font-normal">Cost</th>
                  <th className="py-1.5 font-normal">Started</th>
                </tr>
              </thead>
              <tbody>
                {(h?.recent ?? []).map((run) => {
                  const status = RUN_STATUS[run.status] ?? { label: run.status, variant: "neutral" as const };
                  return (
                    <tr
                      key={run.runId}
                      className={`cursor-pointer border-t border-[var(--border-10)] ${selected === run.runId ? "bg-[var(--foreground-8)]" : "hover:bg-[var(--foreground-5)]"}`}
                      onClick={() => setSelected(run.runId)}
                      title={run.errorMessage ?? undefined}
                    >
                      <td className="py-1.5 pr-3">
                        <button type="button" className="text-left hover:underline" onClick={() => setSelected(run.runId)}>
                          {run.agentName}
                        </button>
                      </td>
                      <td className="py-1.5 pr-3 text-[var(--foreground-50)]">{KIND_LABEL[run.kind] ?? run.kind}</td>
                      <td className="py-1.5 pr-3"><Badge variant={status.variant}>{status.label}</Badge></td>
                      <td className="py-1.5 pr-3">{run.steps} · {run.toolCalls} tools</td>
                      <td className="py-1.5 pr-3">{ms(run.durationMs)}</td>
                      <td className="py-1.5 pr-3">{cents(run.costCents)}</td>
                      <td className="py-1.5 text-[var(--foreground-50)]">{new Date(run.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        {selected ? <RunDetailPanel key={selected} orgId={orgId} runId={selected} onClose={() => setSelected(null)} onChanged={onChanged} /> : null}
      </div>
    </div>
  );
}
