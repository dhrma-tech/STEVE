"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

export function OneTapConfirm({ token, decision, orgId }: { token: string; decision: "approve" | "deny"; orgId: string }) {
  const [state, setState] = React.useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  async function confirm() {
    setState("busy");
    try {
      const response = await fetch("/api/approvals/one-tap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token })
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(payload?.error?.message ?? "That did not work.");
      setState("done");
      setMessage(decision === "approve" ? "Approved. The agent carries on." : "Denied. The agent is told not to do it.");
    } catch (caught) {
      setState("error");
      setMessage(caught instanceof Error ? caught.message : "That did not work.");
    }
  }

  if (state === "done") {
    return (
      <div className="grid gap-2">
        <p className="text-sm text-[var(--foreground-80)]">{message}</p>
        <a className="text-sm text-[var(--tt-color-text-blue)] underline" href={`/org/${orgId}/mission?tab=approvals`}>
          Open Mission Control
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Button variant={decision === "approve" ? "app" : "danger"} loading={state === "busy"} onClick={() => void confirm()}>
        {decision === "approve" ? "Approve" : "Deny"}
      </Button>
      {state === "error" && message ? <p className="text-sm text-[var(--destructive)]">{message}</p> : null}
      <a className="text-xs text-[var(--foreground-50)] underline" href={`/org/${orgId}/mission?tab=approvals`}>
        Decide in the approvals inbox instead
      </a>
    </div>
  );
}
