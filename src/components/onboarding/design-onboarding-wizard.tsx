"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Palette, Upload } from "lucide-react";
import { designVibes } from "@/lib/onboarding/definitions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { FileUpload } from "@/components/ui/file-upload";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { OptionCard } from "@/components/onboarding/option-card";

type DesignState = {
  status: string;
  selectedVibe: string | null;
  references: unknown;
  brandKit: unknown;
  feedback: string | null;
};

export function DesignOnboardingWizard({
  orgId,
  initialState,
  onStatusChange
}: {
  orgId: string;
  initialState: DesignState;
  onStatusChange: (status: string) => void;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(initialState.brandKit ? 4 : initialState.selectedVibe ? 2 : 0);
  const [selectedVibe, setSelectedVibe] = React.useState(initialState.selectedVibe ?? "");
  const [referenceFiles, setReferenceFiles] = React.useState<Array<{ name: string; type: string; size: number }>>([]);
  const [referenceDescription, setReferenceDescription] = React.useState("");
  const [brandKit, setBrandKit] = React.useState<Record<string, unknown> | null>(() => normalizeBrandKit(initialState.brandKit));
  const [feedback, setFeedback] = React.useState(initialState.feedback ?? "");
  const [skipOpen, setSkipOpen] = React.useState(false);
  const [loading, setLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function saveVibe(vibe: string) {
    setSelectedVibe(vibe);
    setLoading("vibe");
    const response = await post(`/api/orgs/${orgId}/design-onboarding/vibe`, { vibe });
    setLoading(null);
    if (response.ok) {
      onStatusChange("in_progress");
      setStep(2);
    }
  }

  async function saveReferences() {
    setLoading("references");
    const response = await post(`/api/orgs/${orgId}/design-onboarding/references`, {
      files: referenceFiles,
      description: referenceDescription
    });
    setLoading(null);
    if (response.ok) setStep(3);
  }

  async function generate() {
    setLoading("generate");
    setStep(3);
    const response = await post(`/api/orgs/${orgId}/design-onboarding/generate`, {});
    setLoading(null);
    if (response.ok) {
      setBrandKit(response.data.brandKit);
      setStep(4);
    }
  }

  async function approve(approved: boolean) {
    setLoading(approved ? "approve" : "iterate");
    const response = await post(`/api/orgs/${orgId}/design-onboarding/approve`, { approved, feedback: feedback || null });
    setLoading(null);
    if (response.ok) {
      onStatusChange(approved ? "complete" : "in_progress");
      router.push(response.data.nextRoute);
    }
  }

  async function skip() {
    setLoading("skip");
    const response = await post(`/api/orgs/${orgId}/design-onboarding/skip`, { confirmedRisk: true });
    setLoading(null);
    if (response.ok) {
      onStatusChange("skipped");
      router.push(response.data.nextRoute);
    }
  }

  async function post(path: string, body: unknown) {
    setError(null);
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Design onboarding request failed.");
      return { ok: false, data: null };
    }
    return { ok: true, data: payload.data };
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">Design onboarding</p>
          <h2 className="mt-1 text-xl font-medium tracking-[0px]">Brand kit setup</h2>
        </div>
        <Badge variant={initialState.status === "complete" ? "success" : "brand"}>{initialState.status}</Badge>
      </div>

      {error ? <ErrorState title="Design setup failed" description={error} /> : null}

      {step === 0 ? (
        <Card variant="deep" className="grid gap-4 rounded-[12px] p-4">
          <Palette aria-hidden="true" className="size-6 text-[var(--focused)]" />
          <h3 className="text-lg font-medium text-[var(--foreground)]">Choose a vibe or skip setup.</h3>
          <p className="text-sm leading-6 text-[var(--foreground-50)]">
            Skipping can reduce output quality because design context will be missing from future agent work.
          </p>
          <div className="flex gap-2">
            <Button variant="brand" onClick={() => setStep(1)}>Choose vibe</Button>
            <Button variant="ghost" onClick={() => setSkipOpen(true)}>Skip setup</Button>
          </div>
        </Card>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-3">
          {designVibes.map((vibe) => (
            <OptionCard key={vibe.value} selected={selectedVibe === vibe.value} title={vibe.label} onClick={() => saveVibe(vibe.value)} />
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-4">
          <FileUpload
            label="Upload references"
            description="Drop up to 6 PNG, JPG, or WebP files to anchor the brand kit generator."
            accept="image/png,image/jpeg,image/webp"
            maxFiles={6}
            onFilesSelected={(files) => setReferenceFiles(files.map((file) => ({ name: file.name, type: file.type, size: file.size })))}
          />
          <Textarea surface="dark" label="Reference description" value={referenceDescription} onChange={(event) => setReferenceDescription(event.target.value)} />
          <div className="flex gap-2">
            <Button variant="app" onClick={saveReferences} disabled={loading === "references"}>
              <Upload aria-hidden="true" className="size-4" />
              Save references
            </Button>
            <Button variant="brand" onClick={generate}>Generate brand kit</Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <Card variant="deep" className="grid gap-4 rounded-[12px] p-4">
          <h3 className="text-lg font-medium">Generating design system</h3>
          <Progress value={loading === "generate" ? 72 : 100} />
          {["COMPOSING BOARD", "BALANCING PALETTE", "SETTING TYPE"].map((label) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span>{label}</span>
              <Badge variant={loading === "generate" ? "running" : "success"}>{loading === "generate" ? "running" : "done"}</Badge>
            </div>
          ))}
          {loading !== "generate" ? <Button variant="brand" onClick={generate}>Generate brand kit</Button> : null}
        </Card>
      ) : null}

      {step === 4 && brandKit ? (
        <BrandKitReview
          brandKit={brandKit}
          feedback={feedback}
          setFeedback={setFeedback}
          loading={loading}
          onApprove={() => approve(true)}
          onIterate={() => approve(false)}
        />
      ) : null}

      <Dialog open={skipOpen} onOpenChange={setSkipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip design setup?</DialogTitle>
            <DialogDescription>
              Output risk: future design and marketing tasks will lack palette, typography, and reference context. This is not recommended.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 text-sm text-[var(--foreground-50)]">
            <p>Missing: selected vibe, references, and brand kit.</p>
            <p>Affects: marketing pages, product UI, brand assets, and design department work.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSkipOpen(false)}>Keep setup</Button>
            <Button variant="danger" onClick={skip} disabled={loading === "skip"}>
              {loading === "skip" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              Skip anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BrandKitReview({
  brandKit,
  feedback,
  setFeedback,
  loading,
  onApprove,
  onIterate
}: {
  brandKit: Record<string, unknown>;
  feedback: string;
  setFeedback: (value: string) => void;
  loading: string | null;
  onApprove: () => void;
  onIterate: () => void;
}) {
  const palette = Array.isArray(brandKit.palette) ? brandKit.palette.map(String) : [];
  const typography = brandKit.typography as Record<string, unknown> | undefined;
  const examples = Array.isArray(brandKit.layoutExamples) ? brandKit.layoutExamples.map(String) : [];

  return (
    <Card variant="deep" className="grid gap-4 rounded-[12px] p-4">
      <Badge variant="success">Brand kit ready</Badge>
      <div>
        <h3 className="text-lg font-medium">{String(brandKit.vibe ?? "Brand kit")}</h3>
        <div className="mt-3 flex gap-2">
          {palette.map((color) => (
            <span key={color} className="size-8 rounded-[8px] border border-white/15" style={{ background: color }} title={color} />
          ))}
        </div>
      </div>
      <div className="grid gap-1 text-sm text-[var(--foreground-50)]">
        <p>Primary: {String(typography?.primary ?? "")}</p>
        <p>Mono: {String(typography?.mono ?? "")}</p>
      </div>
      <div className="grid gap-2">
        {examples.map((example) => (
          <div key={example} className="rounded-[8px] border border-[var(--border-10)] p-3 text-sm">{example}</div>
        ))}
      </div>
      <Textarea surface="dark" label="Iteration feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onIterate} disabled={loading === "iterate"}>Iterate</Button>
        <Button variant="app" onClick={onApprove} disabled={loading === "approve"}>
          {loading === "approve" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          Approve
        </Button>
      </div>
    </Card>
  );
}

function normalizeBrandKit(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

