"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Loader2, PlugZap, RefreshCw, Unplug, Zap } from "lucide-react";
import type { IntegrationDetailData, IntegrationsData } from "@/lib/integrations/data";
import type { BadgeVariant } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type ApiPayload<T> = { data?: T; error?: { message: string } };
type Provider = IntegrationsData["providers"][number];

const CATEGORY_ORDER = ["Source control", "Hosting", "Database", "Payments", "Publishing", "Domains", "Inbox", "Analytics", "Monitoring", "Support", "Integration"];

export function IntegrationCenter({ orgId, initialData }: { orgId: string; initialData: IntegrationsData }) {
  const [data, setData] = React.useState(initialData);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ text: string; ok: boolean } | null>(null);

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
      setMessage({ text: `${payload.data.label} ${kind === "connect" ? "connected" : kind === "disconnect" ? "disconnected" : "verified"} successfully.`, ok: true });
      await refresh();
    } else {
      setMessage({ text: payload.error?.message ?? `${provider} ${kind} failed.`, ok: false });
    }
  }

  // Group providers by category
  const grouped = React.useMemo(() => {
    const map = new Map<string, Provider[]>();
    for (const p of data.providers) {
      const cat = p.category ?? "Integration";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [data.providers]);

  return (
    <div className="grid gap-8">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--foreground-40)]">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.5px] text-[var(--foreground)]">Integrations</h1>
          <p className="mt-1.5 max-w-[60ch] text-sm leading-6 text-[var(--foreground-50)]">
            Connect the tools your company runs on — repo, hosting, payments, and more.
          </p>
        </div>
        <Button variant="ghost" size="sm" className="text-[var(--foreground-60)] hover:bg-[var(--foreground-8)]" onClick={refresh}>
          <RefreshCw aria-hidden="true" className="size-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={data.counts.total} />
        <StatCard label="Connected" value={data.counts.connected} accent="green" />
        <StatCard label="Sandbox" value={data.counts.sandbox} accent="yellow" />
        <StatCard label="Needs setup" value={data.counts.needsSetup} accent="muted" />
      </div>

      {/* Toast message */}
      {message ? (
        <div className={cn(
          "flex items-center gap-2 rounded-[10px] border px-4 py-3 text-sm",
          message.ok
            ? "border-[var(--tt-color-text-green-contrast)] bg-[var(--foreground-3)] text-[var(--foreground-70)]"
            : "border-[var(--destructive)] bg-[var(--foreground-3)] text-[var(--destructive)]"
        )}>
          {message.ok
            ? <CheckCircle2 className="size-4 shrink-0 text-[var(--tt-color-text-green-contrast)]" aria-hidden="true" />
            : <Circle className="size-4 shrink-0" aria-hidden="true" />}
          {message.text}
        </div>
      ) : null}

      {/* Providers grouped by category */}
      <div className="grid gap-8">
        {grouped.map(([category, providers]) => (
          <section key={category}>
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--foreground-40)]">{category}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {providers.map((provider) => (
                <ProviderCard
                  key={provider.provider}
                  orgId={orgId}
                  provider={provider}
                  busy={busy}
                  onAction={action}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ProviderCard({
  orgId,
  provider,
  busy,
  onAction
}: {
  orgId: string;
  provider: Provider;
  busy: string | null;
  onAction: (provider: string, kind: "connect" | "check" | "disconnect") => void;
}) {
  const integration = provider.integration;
  const status = integration?.status ?? "missing";
  const isBusy = busy?.startsWith(provider.provider);
  const isConnected = status === "connected" || status === "sandbox";

  return (
    <article className="flex flex-col gap-4 rounded-[14px] border border-[var(--border-10)] bg-[var(--background-l0)] p-4 transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Provider icon placeholder */}
          <div className={cn(
            "grid size-10 shrink-0 place-items-center rounded-[10px] border text-sm font-semibold",
            isConnected
              ? "border-[var(--tt-color-text-green-contrast)] bg-[rgba(52,168,83,0.08)] text-[var(--tt-color-text-green-contrast)]"
              : "border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-50)]"
          )}>
            <Zap className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--foreground-80)]">{provider.label}</p>
            <StatusPill status={status} />
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs leading-5 text-[var(--foreground-50)]">{provider.description}</p>

      {/* Stats row */}
      <div className="flex gap-4 text-[10px] text-[var(--foreground-40)]">
        <span>Mode: <span className="font-medium text-[var(--foreground-60)]">{integration?.mode ?? "—"}</span></span>
        <span>Secrets: <span className="font-medium text-[var(--foreground-60)]">{integration?.secretsCount ?? 0}</span></span>
        <span>Events: <span className="font-medium text-[var(--foreground-60)]">{integration?.eventsCount ?? 0}</span></span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-10)] pt-3">
        {isConnected ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--foreground-60)] hover:bg-[var(--foreground-8)]"
              disabled={isBusy}
              onClick={() => onAction(provider.provider, "check")}
            >
              {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              Verify
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--destructive)] hover:bg-[rgba(239,68,68,0.06)]"
              disabled={isBusy}
              onClick={() => onAction(provider.provider, "disconnect")}
            >
              <Unplug className="size-3.5" />
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            variant="app"
            size="sm"
            disabled={isBusy}
            onClick={() => onAction(provider.provider, "connect")}
          >
            {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <PlugZap className="size-3.5" />}
            Connect
          </Button>
        )}

        {provider.provider === "postiz" ? (
          <Link
            href={`/org/${orgId}/integrations/postiz`}
            className={buttonClassName({ variant: "ghost", size: "sm", className: "ml-auto text-[var(--foreground-50)] hover:bg-[var(--foreground-8)]" })}
          >
            Channels
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}

      </div>
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; class: string }> = {
    connected:    { label: "Connected",    class: "text-[var(--tt-color-text-green-contrast)]" },
    sandbox:      { label: "Sandbox",      class: "text-[var(--alert)]" },
    needs_setup:  { label: "Needs setup",  class: "text-[var(--foreground-40)]" },
    disconnected: { label: "Disconnected", class: "text-[var(--foreground-40)]" },
    error:        { label: "Error",        class: "text-[var(--destructive)]" },
    missing:      { label: "Not set up",   class: "text-[var(--foreground-30)]" },
  };
  const s = map[status] ?? { label: status, class: "text-[var(--foreground-40)]" };
  return <p className={cn("mt-0.5 text-[10px] font-medium", s.class)}>{s.label}</p>;
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "green" | "yellow" | "muted" }) {
  const color = accent === "green" ? "text-[var(--tt-color-text-green-contrast)]"
    : accent === "yellow" ? "text-[var(--alert)]"
    : "text-[var(--foreground-80)]";
  return (
    <div className="rounded-[12px] border border-[var(--border-10)] bg-[var(--background-l0)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--foreground-40)]">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", color)}>{value}</p>
    </div>
  );
}

function statusVariant(status: string): BadgeVariant {
  if (status === "connected") return "success";
  if (status === "sandbox") return "warning";
  if (status === "error") return "danger";
  return "neutral";
}
