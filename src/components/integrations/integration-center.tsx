"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, PlugZap, RefreshCw, Unplug } from "lucide-react";
import type { IntegrationDetailData, IntegrationsData } from "@/lib/integrations/data";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";

type ApiPayload<T> = { data?: T; error?: { message: string } };

export function IntegrationCenter({ orgId, initialData }: { orgId: string; initialData: IntegrationsData }) {
  const [data, setData] = React.useState(initialData);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function refresh() {
    const response = await fetch(`/api/orgs/${orgId}/integrations`);
    const payload = (await response.json()) as ApiPayload<IntegrationsData>;
    if (payload.data) setData(payload.data);
  }

  async function action(provider: string, kind: "connect" | "check" | "disconnect") {
    setBusy(`${provider}:${kind}`);
    setMessage(null);
    const response = await fetch(`/api/orgs/${orgId}/integrations/${provider}/${kind}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: kind === "connect" ? JSON.stringify({ config: { sandboxConnected: true } }) : undefined
    });
    const payload = (await response.json()) as ApiPayload<IntegrationDetailData>;
    setBusy(null);
    if (payload.data) {
      setMessage(`${payload.data.label} ${kind} complete.`);
      await refresh();
    } else {
      setMessage(payload.error?.message ?? `${provider} ${kind} failed.`);
    }
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--app-text-50)]">Integrations</p>
            <h1 className="mt-1 text-2xl font-medium">Provider center</h1>
            <p className="mt-2 max-w-[78ch] text-sm leading-6 text-[var(--app-text-50)]">Managed provider records for repo, hosting, database, payments, publishing, domains, inboxes, analytics, monitoring, and support.</p>
          </div>
          <Button variant="ghost" className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" onClick={refresh}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <Metric label="Total" value={data.counts.total} />
          <Metric label="Connected" value={data.counts.connected} />
          <Metric label="Sandbox" value={data.counts.sandbox} />
          <Metric label="Needs setup" value={data.counts.needsSetup} />
        </div>
        {message ? <p className="text-sm text-[var(--app-primary-light)]">{message}</p> : null}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        {data.providers.map((provider) => {
          const integration = provider.integration;
          const isBusy = busy?.startsWith(provider.provider);
          return (
            <article key={provider.provider} className="grid gap-3 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium">{provider.label}</h2>
                    <Badge variant={statusVariant(integration?.status ?? "missing")}>{integration?.status ?? "missing"}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--app-text-50)]">{provider.description}</p>
                </div>
                <Badge variant="neutral">{provider.category}</Badge>
              </div>
              <div className="grid gap-1 text-sm text-[var(--app-text-50)]">
                <span>Mode: {integration?.mode ?? "none"}</span>
                <span>Secrets: {integration?.secretsCount ?? 0}</span>
                <span>Events: {integration?.eventsCount ?? 0}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="app" size="sm" disabled={isBusy} onClick={() => action(provider.provider, "connect")}>
                  <PlugZap aria-hidden="true" className="size-4" />
                  Connect
                </Button>
                <Button variant="ghost" size="sm" className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" disabled={isBusy} onClick={() => action(provider.provider, "check")}>
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                  Check
                </Button>
                <Button variant="danger" size="sm" disabled={isBusy} onClick={() => action(provider.provider, "disconnect")}>
                  <Unplug aria-hidden="true" className="size-4" />
                  Disconnect
                </Button>
                {provider.provider === "postiz" ? (
                  <Link href={`/org/${orgId}/integrations/postiz`} className={buttonClassName({ variant: "ghost", size: "sm", className: "text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" })}>
                    Postiz channels
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--app-text-50)]">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

function statusVariant(status: string): BadgeVariant {
  if (status === "connected") return "success";
  if (status === "sandbox") return "warning";
  if (status === "needs_setup" || status === "disconnected") return "neutral";
  if (status === "error") return "danger";
  return "neutral";
}
