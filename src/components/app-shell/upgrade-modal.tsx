"use client";

import * as React from "react";
import { CreditCard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import type { OrgShellData } from "@/lib/orgs/shell";

export function UpgradeModal({
  shell,
  open,
  onOpenChange
}: {
  shell: OrgShellData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [plan, setPlan] = React.useState(shell.billing?.plan ?? "trial");
  const [status, setStatus] = React.useState(shell.billing?.status ?? "trialing");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function upgrade(nextPlan: "pro" | "team") {
    setBusy(nextPlan);
    setMessage(null);
    const response = await fetch(`/api/orgs/${shell.organization.id}/billing/upgrade`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: nextPlan, confirmed: true })
    });
    const payload = await response.json() as { data?: { account: { plan: string; status: string } }; error?: { message: string } };
    setBusy(null);
    if (payload.data) {
      setPlan(payload.data.account.plan);
      setStatus(payload.data.account.status);
      setMessage(`Upgraded to ${payload.data.account.plan}.`);
    } else {
      setMessage(payload.error?.message ?? "Upgrade failed.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade {shell.organization.name}</DialogTitle>
          <DialogDescription>
            Current plan: {plan} / {status}. Billing is tracked in sandbox until Stripe credentials are supplied.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-3 rounded-[10px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.05)] p-4">
            <Sparkles aria-hidden="true" className="size-5 text-[var(--brand-300)]" />
            <div>
              <h3 className="font-medium">Cofounder Pro</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--app-text-50)]">$20/month plus usage with higher included execution room.</p>
            </div>
            <Button variant="app" disabled={busy !== null || plan === "pro"} onClick={() => upgrade("pro")}>
              <Sparkles aria-hidden="true" className="size-4" />
              Upgrade Pro
            </Button>
          </div>
          <div className="grid gap-3 rounded-[10px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.05)] p-4">
            <CreditCard aria-hidden="true" className="size-5 text-[var(--app-primary-light)]" />
            <div>
              <h3 className="font-medium">Team Plan</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--app-text-50)]">$50/month for collaborators, approvals, and shared operating cadence.</p>
            </div>
            <Button variant="ghost" disabled={busy !== null || plan === "team"} onClick={() => upgrade("team")}>
              Team sandbox
            </Button>
          </div>
        </div>
        {message ? <p className="text-sm text-[var(--app-primary-light)]">{message}</p> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Keep current plan
          </Button>
          <Button variant="app" onClick={() => {
            window.location.href = `/org/${shell.organization.id}/settings/billing`;
          }}>
            Review billing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
