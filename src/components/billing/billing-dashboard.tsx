"use client";

import * as React from "react";
import { CheckCircle2, CreditCard, Loader2, Sparkles, TrendingUp, Zap } from "lucide-react";
import type { BillingData } from "@/lib/billing/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils/cn";

type ApiPayload<T> = { data?: T; error?: { message: string } };

export function BillingDashboard({ orgId, initialData }: { orgId: string; initialData: BillingData }) {
  const [data, setData] = React.useState(initialData);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ text: string; ok: boolean } | null>(null);

  const usedPercent = data.usage.includedUsageCents
    ? Math.min(100, Math.round((data.usage.usedCents / data.usage.includedUsageCents) * 100))
    : 0;

  async function upgrade(plan: "pro" | "team") {
    setBusy(plan);
    setMessage(null);
    const response = await fetch(`/api/orgs/${orgId}/billing/upgrade`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan, confirmed: true })
    });
    const payload = (await response.json()) as ApiPayload<BillingData>;
    setBusy(null);
    if (payload.data) {
      setData(payload.data);
      setMessage({ text: `Successfully upgraded to ${plan} plan.`, ok: true });
    } else {
      setMessage({ text: payload.error?.message ?? "Upgrade failed. Please try again.", ok: false });
    }
  }

  return (
    <div className="grid gap-8">

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--foreground-40)]">Account</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.5px] text-[var(--foreground)]">Plan & billing</h1>
          <p className="mt-1.5 text-sm leading-6 text-[var(--foreground-50)]">{data.stripe.message}</p>
        </div>
        <Badge variant={data.account.status === "active" ? "success" : "warning"} className="capitalize">
          {data.account.plan}
        </Badge>
      </div>

      {/* Toast */}
      {message ? (
        <div className={cn(
          "flex items-center gap-2 rounded-[10px] border px-4 py-3 text-sm",
          message.ok
            ? "border-[var(--tt-color-text-green-contrast)] bg-[var(--foreground-3)] text-[var(--foreground-70)]"
            : "border-[var(--destructive)] bg-[var(--foreground-3)] text-[var(--destructive)]"
        )}>
          {message.ok
            ? <CheckCircle2 className="size-4 shrink-0 text-[var(--tt-color-text-green-contrast)]" />
            : <Zap className="size-4 shrink-0" />}
          {message.text}
        </div>
      ) : null}

      {/* Usage overview */}
      <section className="rounded-[16px] border border-[var(--border-10)] bg-[var(--background-l0)] p-6">
        <div className="mb-5 flex items-center gap-2">
          <TrendingUp className="size-4 text-[var(--foreground-50)]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[var(--foreground-80)]">Usage this period</h2>
        </div>

        {/* Metrics */}
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          <MetricCard label="Base" value={formatCents(data.account.baseMonthlyCents)} />
          <MetricCard label="Included" value={formatCents(data.account.includedUsageCents)} />
          <MetricCard label="Used" value={formatCents(data.usage.usedCents)} highlight={usedPercent > 80} />
          <MetricCard label="Overage" value={formatCents(data.usage.overageCents)} highlight={data.usage.overageCents > 0} />
        </div>

        {/* Usage bar */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-xs text-[var(--foreground-50)]">
            <span>Included usage consumed</span>
            <span className={cn("font-semibold tabular-nums", usedPercent > 80 ? "text-[var(--alert)]" : "text-[var(--foreground-70)]")}>
              {usedPercent}%
            </span>
          </div>
          <Progress value={usedPercent} />
        </div>

        {/* Usage categories */}
        {data.usage.categories.length > 0 ? (
          <div className="mt-5 divide-y divide-[var(--border-10)] rounded-[10px] border border-[var(--border-10)]">
            {data.usage.categories.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm text-[var(--foreground-60)]">{cat.label}</span>
                <span className="font-mono text-xs text-[var(--foreground-80)]">
                  {cat.quantity.toLocaleString()} {cat.unit} · {formatCents(cat.costCents)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* Plans */}
      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--foreground-40)]">Plans</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {data.plans.map((plan) => {
            const isCurrent = data.account.plan === plan.plan;
            const isBusy = busy === plan.plan;
            return (
              <div
                key={plan.plan}
                className={cn(
                  "flex flex-col gap-4 rounded-[16px] border p-5 transition-shadow",
                  isCurrent
                    ? "border-[var(--primary)] bg-[var(--background-l0)] shadow-[0_0_0_1px_var(--primary)]"
                    : "border-[var(--border-10)] bg-[var(--background-l0)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-[var(--foreground)]">{plan.label}</p>
                    <p className="mt-0.5 text-xs text-[var(--foreground-40)]">{formatCents(plan.includedUsageCents)} included</p>
                  </div>
                  {isCurrent ? <Badge variant="success">Current</Badge> : null}
                </div>

                <p className="flex-1 text-sm leading-6 text-[var(--foreground-50)]">{plan.description}</p>

                <div>
                  <span className="text-3xl font-semibold tabular-nums text-[var(--foreground)]">
                    {formatCents(plan.baseMonthlyCents)}
                  </span>
                  <span className="ml-1 text-sm text-[var(--foreground-40)]">/mo</span>
                </div>

                {plan.plan === "trial" ? (
                  <Button variant="ghost" disabled className="w-full">Trial plan</Button>
                ) : (
                  <Button
                    variant={isCurrent ? "ghost" : "app"}
                    disabled={isCurrent || busy !== null}
                    className="w-full"
                    onClick={() => upgrade(plan.plan as "pro" | "team")}
                  >
                    {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {isCurrent ? "Current plan" : "Upgrade"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Dashboard link */}
      {data.dashboardLink ? (
        <div className="flex items-center gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--background-l0)] px-4 py-3">
          <CreditCard className="size-4 shrink-0 text-[var(--foreground-40)]" aria-hidden="true" />
          <span className="text-sm text-[var(--foreground-50)]">Billing portal:</span>
          <a
            href={data.dashboardLink}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-sm text-[var(--tt-color-text-blue)] underline-offset-2 hover:underline"
          >
            {data.dashboardLink}
          </a>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-[12px] border border-[var(--border-10)] bg-[var(--background)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--foreground-40)]">{label}</p>
      <p className={cn("mt-1.5 text-xl font-semibold tabular-nums", highlight ? "text-[var(--alert)]" : "text-[var(--foreground)]")}>
        {value}
      </p>
    </div>
  );
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
