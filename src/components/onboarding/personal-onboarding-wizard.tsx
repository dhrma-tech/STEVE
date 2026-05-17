"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils/cn";

type InitialProfile = {
  onboardingStatus: string;
  preferredName: string;
  technicalExperience: string | null;
  primaryRole: string | null;
  companyStage: string | null;
};

const EXPERIENCE_OPTIONS = [
  { value: "writes_code",       label: "I write code myself" },
  { value: "manages_engineers", label: "I manage engineers with a dev team" },
  { value: "not_technical",     label: "I'm not involved on the technical side" }
] as const;

const ROLE_OPTIONS = [
  "Product",
  "Engineering",
  "Design",
  "Marketing",
  "Sales",
  "Operations",
  "Founder / Executive",
  "Other"
] as const;

const STAGE_OPTIONS = [
  { value: "Pre-idea",  label: "Pre-idea",  desc: "Exploring problems worth solving" },
  { value: "Idea",      label: "Idea",      desc: "I know what I want to build" },
  { value: "Pre-MVP",   label: "Pre-MVP",   desc: "Racing toward a first product" },
  { value: "MVP",       label: "MVP",       desc: "Shipped — finding product-market fit" },
  { value: "Customers", label: "Customers", desc: "Real users giving real feedback" },
  { value: "Revenue",   label: "Revenue",   desc: "Charging for the product" },
  { value: "Public",    label: "Public",    desc: "Scaling fast, eyes on the market" }
] as const;

// step 0 = welcome, 1 = name, 2 = experience, 3 = role, 4 = stage, 5 = company
const TOTAL = 6;

export function PersonalOnboardingWizard({ initialProfile: _ }: { initialProfile: InitialProfile }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [direction, setDirection] = React.useState<"fwd" | "bck">("fwd");

  const [preferredName, setPreferredName] = React.useState("");
  const [technicalExperience, setTechnicalExperience] = React.useState("");
  const [primaryRole, setPrimaryRole] = React.useState("");
  const [companyStageIndex, setCompanyStageIndex] = React.useState(0);
  const [companyName, setCompanyName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const companyStage = STAGE_OPTIONS[companyStageIndex]?.value ?? "Idea";

  const canContinue =
    step === 0 ||
    (step === 1 && preferredName.trim().length > 0) ||
    (step === 2 && technicalExperience !== "") ||
    (step === 3 && primaryRole !== "") ||
    step === 4 ||
    (step === 5 && companyName.trim().length >= 2);

  async function saveProgress(payload: Record<string, string>) {
    const res = await fetch("/api/onboarding/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message: string } };
      throw new Error(body.error?.message ?? "Unable to save progress.");
    }
  }

  async function next() {
    setError(null);

    if (step === 5) {
      if (companyName.trim().length < 2) { setError("Give your company at least 2 characters."); return; }
      setLoading(true);
      try {
        const res = await fetch("/api/questions/submit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ preferredName, technicalExperience, primaryRole, companyStage, companyName })
        });
        const data = (await res.json()) as { data?: { orgId: string }; error?: { message: string } };
        if (!res.ok || !data.data) throw new Error(data.error?.message ?? "Unable to create company.");
        toast.success("Company created!");
        router.push(`/org/${data.data.orgId}/onboarding`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      if (step === 1) await saveProgress({ preferredName });
      if (step === 2) await saveProgress({ technicalExperience });
      if (step === 3) await saveProgress({ primaryRole });
      if (step === 4) await saveProgress({ companyStage });
      setDirection("fwd");
      setStep((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function back() {
    if (step === 0 || loading) return;
    setError(null);
    setDirection("bck");
    setStep((s) => s - 1);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--background)] px-5">
      {/* Logout — top left */}
      <button
        type="button"
        onClick={() => void logout()}
        className="absolute left-6 top-6 text-sm text-[var(--foreground-40)] transition-colors hover:text-[var(--foreground-80)]"
      >
        Log out
      </button>

      {/* Animated step wrapper */}
      <div
        key={`${step}-${direction}`}
        className={cn(
          "grid w-full max-w-[400px] gap-8",
          direction === "fwd" ? "animate-step-enter-fwd" : "animate-step-enter-bck"
        )}
      >
        {/* ── Step 0 — Welcome ── */}
        {step === 0 ? (
          <div className="grid gap-6 text-center">
            <div className="grid gap-3">
              <h1 className="font-mono text-[28px] tracking-tight text-[var(--foreground)]">Cofounder</h1>
              <p className="text-[15px] text-[var(--foreground-50)]">Automate your business with natural language.</p>
            </div>
            <div className="flex justify-center">
              <ContinueBtn onClick={() => void next()} loading={loading} enabled />
            </div>
          </div>
        ) : null}

        {/* ── Step 1 — Name ── */}
        {step === 1 ? (
          <div className="grid gap-7">
            <h2 className="text-center text-[22px] font-medium leading-snug text-[var(--foreground)]">
              What should we call you?
            </h2>
            <label className="grid gap-2 text-sm text-[var(--foreground-60)]">
              Your name
              <input
                autoFocus
                type="text"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void next(); }}
                placeholder="Your name"
                className="rounded-[10px] border border-[var(--border-10)] bg-white px-4 py-3 text-[15px] text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--foreground-30)] focus:border-[var(--tt-brand-color-500)]"
              />
            </label>
            {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
            <div className="grid gap-3 text-center">
              <ContinueBtn onClick={() => void next()} loading={loading} enabled={canContinue} />
              <BackBtn onClick={back} visible={step > 0} />
            </div>
          </div>
        ) : null}

        {/* ── Step 2 — Experience ── */}
        {step === 2 ? (
          <div className="grid gap-7">
            <h2 className="text-center text-[22px] font-medium leading-snug text-[var(--foreground)]">
              What's your experience building products?
            </h2>
            <div className="grid gap-2">
              {EXPERIENCE_OPTIONS.map((opt, i) => (
                <NumberedRow
                  key={opt.value}
                  index={i}
                  label={opt.label}
                  selected={technicalExperience === opt.value}
                  onClick={() => setTechnicalExperience(opt.value)}
                />
              ))}
            </div>
            {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
            <div className="grid gap-3 text-center">
              <ContinueBtn onClick={() => void next()} loading={loading} enabled={canContinue} />
              <BackBtn onClick={back} visible />
            </div>
          </div>
        ) : null}

        {/* ── Step 3 — Role ── */}
        {step === 3 ? (
          <div className="grid gap-7">
            <h2 className="text-center text-[22px] font-medium leading-snug text-[var(--foreground)]">
              Which best describes you?
            </h2>
            <div className="grid gap-2">
              {ROLE_OPTIONS.map((role, i) => (
                <NumberedRow
                  key={role}
                  index={i}
                  label={role}
                  selected={primaryRole === role}
                  onClick={() => setPrimaryRole(role)}
                />
              ))}
            </div>
            {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
            <div className="grid gap-3 text-center">
              <ContinueBtn onClick={() => void next()} loading={loading} enabled={canContinue} />
              <BackBtn onClick={back} visible />
            </div>
          </div>
        ) : null}

        {/* ── Step 4 — Stage slider ── */}
        {step === 4 ? (
          <div className="grid gap-8">
            <h2 className="text-center text-[22px] font-medium leading-snug text-[var(--foreground)]">
              What stage is your idea?
            </h2>

            {/* Selected stage display */}
            <div className="grid gap-1.5 text-center">
              <p className="text-[30px] font-semibold tracking-[-0.01em] text-[var(--tt-brand-color-500)] transition-all duration-200">
                {STAGE_OPTIONS[companyStageIndex]?.label}
              </p>
              <p className="text-[13px] text-[var(--foreground-40)] transition-all duration-200">
                {STAGE_OPTIONS[companyStageIndex]?.desc}
              </p>
            </div>

            {/* Dot-pill progress indicator */}
            <div className="flex items-center justify-center gap-1.5">
              {STAGE_OPTIONS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCompanyStageIndex(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === companyStageIndex
                      ? "w-5 bg-[var(--tt-brand-color-500)]"
                      : i < companyStageIndex
                        ? "w-1.5 bg-[var(--tt-brand-color-500)] opacity-30"
                        : "w-1.5 bg-[var(--border-10)]"
                  )}
                />
              ))}
            </div>

            {/* Slider */}
            <Slider
              min={0}
              max={STAGE_OPTIONS.length - 1}
              step={1}
              value={[companyStageIndex]}
              onValueChange={(v) => setCompanyStageIndex(v[0] ?? 0)}
            />

            {/* Stage name ticks — no overflow, just first + last */}
            <div className="flex justify-between px-1">
              <span className="font-mono text-[10px] text-[var(--foreground-30)]">Pre-idea</span>
              <span className="font-mono text-[10px] text-[var(--foreground-30)]">Public</span>
            </div>

            {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
            <div className="grid gap-3 text-center">
              <ContinueBtn label="Next" onClick={() => void next()} loading={loading} enabled />
              <BackBtn onClick={back} visible />
            </div>
          </div>
        ) : null}

        {/* ── Step 5 — Company name ── */}
        {step === 5 ? (
          <div className="grid gap-7">
            <h2 className="text-center text-[22px] font-medium leading-snug text-[var(--foreground)]">
              Create your company
            </h2>
            <label className="grid gap-2 text-sm text-[var(--foreground-60)]">
              Company name
              <input
                autoFocus
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void next(); }}
                placeholder="Your company"
                className="rounded-[10px] border border-[var(--border-10)] bg-white px-4 py-3 text-[15px] text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--foreground-30)] focus:border-[var(--tt-brand-color-500)]"
              />
            </label>
            {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
            <div className="grid gap-3 text-center">
              <ContinueBtn onClick={() => void next()} loading={loading} enabled={canContinue} />
              <BackBtn onClick={back} visible />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Numbered option row ──────────────────────────────── */
function NumberedRow({
  index, label, selected, onClick
}: {
  index: number; label: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-4 rounded-[12px] border px-5 py-3.5 text-left transition-all duration-100 active:scale-[0.99]",
        selected
          ? "border-[var(--tt-brand-color-500)] bg-[rgba(98,41,255,0.04)]"
          : "border-[var(--border-10)] bg-white hover:border-[var(--foreground-20)]"
      )}
    >
      <span className="font-mono text-[11px] text-[var(--foreground-30)]">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className={cn("text-[15px]", selected ? "font-medium text-[var(--foreground)]" : "text-[var(--foreground-70)]")}>
        {label}
      </span>
    </button>
  );
}

/* ── Continue button ──────────────────────────────────── */
function ContinueBtn({
  onClick, loading, enabled, label = "Continue"
}: {
  onClick: () => void; loading: boolean; enabled: boolean; label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled || loading}
      className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--border-10)] bg-white px-6 py-2.5 text-[15px] text-[var(--foreground-80)] transition-all hover:border-[var(--foreground-20)] disabled:opacity-35 disabled:pointer-events-none"
    >
      {loading ? "…" : <>{label} <ArrowRight className="size-4" /></>}
    </button>
  );
}

/* ── Back link ────────────────────────────────────────── */
function BackBtn({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-[var(--foreground-40)] underline-offset-2 transition-colors hover:text-[var(--foreground-70)] hover:underline"
    >
      Back
    </button>
  );
}
