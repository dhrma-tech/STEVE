"use client";

import * as React from "react";
import { CreditCard, Sparkles, TrendingUp } from "lucide-react";
import type { BillingData } from "@/lib/billing/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type ApiPayload<T> = { data?: T; error?: { message: string } };

export function BillingDashboard({ orgId, initialData }: { orgId: string; initialData: BillingData }) {
  const [data, setData] = React.useState(initialData);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const usedPercent = data.usage.includedUsageCents ? Math.min(100, Math.round((data.usage.usedCents / data.usage.includedUsageCents) * 100)) : 0;

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
      setMessage(`Upgraded to ${plan}.`);
    } else {
      setMessage(payload.error?.message ?? "Billing upgrade failed.");
    }
  }

  return (
    <div className="grid gap-4 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--app-text-50)]">Billing</p>
          <h3 className="mt-1 text-xl font-medium">Plan and usage</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--app-text-50)]">{data.stripe.message}</p>
        </div>
        <Badge variant={data.account.status === "active" ? "success" : "warning"}>{data.account.plan}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Base" value={formatCents(data.account.baseMonthlyCents)} />
        <Metric label="Included" value={formatCents(data.account.includedUsageCents)} />
        <Metric label="Used" value={formatCents(data.usage.usedCents)} />
        <Metric label="Overage" value={formatCents(data.usage.overageCents)} />
      </div>

      <div className="grid gap-2 rounded-[10px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
        <div className="flex items-center justify-between text-sm">
          <span>Usage included</span>
          <span className="text-[var(--app-text-50)]">{usedPercent}%</span>
        </div>
        <Progress value={usedPercent} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {data.plans.map((plan) => (
          <div key={plan.plan} className="grid gap-3 rounded-[10px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-medium">{plan.label}</h4>
              {data.account.plan === plan.plan ? <Badge variant="success">Current</Badge> : null}
            </div>
            <p className="text-sm leading-6 text-[var(--app-text-50)]">{plan.description}</p>
            <p className="text-2xl font-medium">{formatCents(plan.baseMonthlyCents)}<span className="text-sm text-[var(--app-text-50)]">/mo</span></p>
            <p className="text-sm text-[var(--app-text-50)]">{formatCents(plan.includedUsageCents)} included usage</p>
            {plan.plan === "trial" ? (
              <Button variant="ghost" disabled className="text-[var(--app-text)]">Trial</Button>
            ) : (
              <Button variant="app" disabled={busy !== null || data.account.plan === plan.plan} onClick={() => upgrade(plan.plan)}>
                <Sparkles aria-hidden="true" className="size-4" />
                Upgrade
              </Button>
            )}
          </div>
        ))}
      </div>

      <div id="dashboard" className="grid gap-2 rounded-[10px] border border-[var(--app-border)] bg-[rgba(0,0,0,0.12)] p-3">
        <div className="flex items-center gap-2">
          <TrendingUp aria-hidden="true" className="size-4 text-[var(--app-primary-light)]" />
          <h4 className="text-sm font-medium">Usage categories</h4>
        </div>
        {data.usage.categories.map((category) => (
          <div key={category.category} className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] py-2 text-sm last:border-b-0">
            <span className="text-[var(--app-text-50)]">{category.label}</span>
            <span>{category.quantity.toLocaleString()} {category.unit} / {formatCents(category.costCents)}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-[var(--app-text-50)]">
        <CreditCard aria-hidden="true" className="size-4" />
        <span>Dashboard link: {data.dashboardLink}</span>
      </div>
      {message ? <p className="text-sm text-[var(--app-primary-light)]">{message}</p> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--app-text-50)]">{label}</p>
      <p className="mt-1 text-lg font-medium">{value}</p>
    </div>
  );
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
