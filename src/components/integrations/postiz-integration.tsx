"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Megaphone, Plus, RefreshCw } from "lucide-react";
import type { PostizIntegrationData } from "@/lib/integrations/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";

type ApiPayload<T> = { data?: T; error?: { message: string } };

export function PostizIntegration({ orgId, initialData }: { orgId: string; initialData: NonNullable<PostizIntegrationData> }) {
  const [data, setData] = React.useState(initialData);
  const [channelType, setChannelType] = React.useState("x");
  const [displayName, setDisplayName] = React.useState("Company X");
  const [message, setMessage] = React.useState<string | null>(null);

  async function addChannel() {
    const response = await fetch(`/api/orgs/${orgId}/integrations/postiz/channels`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channelType, displayName })
    });
    const payload = (await response.json()) as ApiPayload<NonNullable<PostizIntegrationData>>;
    if (payload.data) {
      setData(payload.data);
      setMessage("Postiz channel connected.");
    } else {
      setMessage(payload.error?.message ?? "Channel could not be connected.");
    }
  }

  async function check() {
    const response = await fetch(`/api/orgs/${orgId}/integrations/postiz/check`, { method: "POST" });
    const payload = (await response.json()) as ApiPayload<PostizIntegrationData>;
    if (payload.data) {
      const refreshed = await fetch(`/api/orgs/${orgId}/integrations/postiz`);
      const refreshedPayload = (await refreshed.json()) as ApiPayload<NonNullable<PostizIntegrationData>>;
      if (refreshedPayload.data) setData(refreshedPayload.data);
      setMessage("Postiz status checked.");
    }
  }

  return (
    <main className="min-h-full bg-[var(--background)] p-4 text-[var(--foreground-80)] md:p-6">
      <div className="mx-auto grid max-w-[1120px] gap-5">
        <Link href={`/org/${orgId}/integrations`} className="inline-flex items-center gap-2 text-sm text-[var(--foreground-50)] hover:text-[var(--foreground-80)]">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Integrations
        </Link>
        <section className="grid gap-4 rounded-[12px] border border-[var(--border-10)] bg-[var(--background-sidepanel)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-[9px] bg-[var(--foreground-8)] text-[var(--foreground-80)]">
                <Megaphone aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">Postiz</p>
                <h1 className="text-2xl font-medium">Social publishing channels</h1>
              </div>
            </div>
            <Badge variant={data.integration.status === "connected" ? "success" : "warning"}>{data.integration.status}</Badge>
          </div>
          <p className="text-sm leading-6 text-[var(--foreground-50)]">{data.publishing.queueLabel}</p>
          <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
            <SelectField
              surface="dark"
              label="Channel"
              value={channelType}
              onValueChange={setChannelType}
              options={[
                { value: "x", label: "X" },
                { value: "linkedin", label: "LinkedIn" },
                { value: "threads", label: "Threads" },
                { value: "youtube", label: "YouTube" }
              ]}
            />
            <Input surface="dark" label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            <div className="grid content-end">
              <Button variant="app" onClick={addChannel}>
                <Plus aria-hidden="true" className="size-4" />
                Add channel
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={check}>
              <RefreshCw aria-hidden="true" className="size-4" />
              Check status
            </Button>
            {message ? <span className="inline-flex items-center text-sm text-[var(--foreground-80)]">{message}</span> : null}
          </div>
        </section>
        <section className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--background-sidepanel)] p-4">
          <h2 className="font-medium">Channels</h2>
          {data.channels.length ? (
            <div className="grid gap-2">
              {data.channels.map((channel) => (
                <div key={channel.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{channel.displayName}</span>
                    <span className="mt-1 block text-xs text-[var(--foreground-50)]">{channel.channelType} / {channel.mode}</span>
                  </span>
                  <Badge variant="success">{channel.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No Postiz channels" description="Add a sandbox channel to make social publishing tasks actionable." />
          )}
        </section>
      </div>
    </main>
  );
}
