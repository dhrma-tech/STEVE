"use client";

import * as React from "react";
import { ArrowLeft, Check, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type ColorPalette = { name: string; description: string; primary: string; secondary: string; accent: string };
type FontPair = { id: string; heading: string; body: string; tag: string; desc: string };

const FONT_PAIRS: FontPair[] = [
  { id: "modern", heading: "Space Grotesk", body: "Inter", tag: "Modern Tech", desc: "Clean, technical, contemporary" },
  { id: "editorial", heading: "Playfair Display", body: "Lato", tag: "Premium Editorial", desc: "Sophisticated, trustworthy, authoritative" },
  { id: "bold", heading: "Montserrat", body: "Source Sans 3", tag: "Bold & Clear", desc: "Strong, confident, easy to read" },
  { id: "friendly", heading: "DM Sans", body: "Nunito", tag: "Friendly", desc: "Approachable, warm, human-centered" }
];

const BRAND_STYLES = [
  { id: "minimal", label: "Minimal", desc: "Less is more — clean and focused" },
  { id: "bold", label: "Bold", desc: "Strong presence, high contrast" },
  { id: "playful", label: "Playful", desc: "Fun, energetic, memorable" },
  { id: "premium", label: "Premium", desc: "Luxurious and refined" },
  { id: "futuristic", label: "Futuristic", desc: "Tech-driven, forward-thinking" },
  { id: "organic", label: "Organic", desc: "Natural, authentic, human" }
];

const STEP_LABELS = ["Name", "Theme", "Colors", "Fonts", "Style", "Review"];

const STEP_HEADS = [
  ["What's your company called?", "AI suggestions or enter your own name."],
  ["Choose your visual theme", "Sets the foundation for your brand's look."],
  ["Pick your color palette", "AI-generated palettes based on your style."],
  ["Choose your typography", "The font pairing that represents your voice."],
  ["What's your brand personality?", "The character behind every design choice."],
  ["Your brand kit is ready", "Review, then save to files and enter your canvas."]
];

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === current ? "w-5 bg-[var(--primary)]" : i < current ? "w-1.5 bg-[var(--foreground-30)]" : "w-1.5 bg-[var(--foreground-10)]"
          )}
        />
      ))}
    </div>
  );
}

function Swatch({ color, size = "md" }: { color: string; size?: "sm" | "md" | "lg" }) {
  const validHex = /^#[0-9a-fA-F]{6}$/.test(color);
  return (
    <span
      className={cn(
        "inline-block rounded-full border border-[var(--border-10)]",
        size === "sm" && "size-4",
        size === "md" && "size-5",
        size === "lg" && "size-7"
      )}
      style={{ backgroundColor: validHex ? color : "#888" }}
    />
  );
}

function OptionCard({
  selected,
  onClick,
  children,
  className
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-[12px] border p-3.5 text-left transition-all duration-150 active:scale-[0.99]",
        selected
          ? "border-[var(--tt-brand-color-500)] bg-[rgba(98,41,255,0.07)]"
          : "border-[var(--border-10)] bg-[var(--background-l0)] hover:border-[var(--foreground-20)]",
        className
      )}
    >
      {children}
      {selected ? <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--tt-brand-color-500)]" /> : <span className="size-3.5 shrink-0" />}
    </button>
  );
}

export function BrandingPanel({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [step, setStep] = React.useState(0);
  const [companyName, setCompanyName] = React.useState(orgName);
  const [theme, setTheme] = React.useState<"dark" | "light" | null>(null);
  const [palette, setPalette] = React.useState<ColorPalette | null>(null);
  const [fontPair, setFontPair] = React.useState<FontPair | null>(null);
  const [brandStyle, setBrandStyle] = React.useState<string | null>(null);

  const [nameSuggestions, setNameSuggestions] = React.useState<string[] | null>(null);
  const [paletteSuggestions, setPaletteSuggestions] = React.useState<ColorPalette[] | null>(null);
  const [generatingNames, setGeneratingNames] = React.useState(false);
  const [generatingColors, setGeneratingColors] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [ideaDescription, setIdeaDescription] = React.useState(orgName);

  // Load Google Fonts for typography preview
  React.useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600&family=Inter:wght@400;500&family=Playfair+Display:wght@400;600&family=Lato:wght@400;700&family=Montserrat:wght@400;600&family=Source+Sans+3:wght@400;600&family=DM+Sans:wght@400;500&family=Nunito:wght@400;600&display=swap";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  // Read idea description saved by idea panel
  React.useEffect(() => {
    const stored = sessionStorage.getItem("ideaDescription");
    if (stored) setIdeaDescription(stored);
  }, []);

  // Auto-generate names on mount
  React.useEffect(() => { void generateNames(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate palettes when colors step is reached
  React.useEffect(() => {
    if (step === 2 && !paletteSuggestions) void generateColors();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  async function callBranding(phase: "names" | "colors", extra?: Record<string, string>) {
    const res = await fetch(`/api/orgs/${orgId}/branding`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase, orgName, idea: ideaDescription, ...extra })
    });
    return (await res.json()) as { data?: Record<string, unknown>; error?: string };
  }

  async function generateNames() {
    setGeneratingNames(true);
    try {
      const json = await callBranding("names");
      setNameSuggestions((json.data?.names as string[]) ?? []);
    } catch { setNameSuggestions([]); }
    finally { setGeneratingNames(false); }
  }

  async function generateColors() {
    setGeneratingColors(true);
    setPaletteSuggestions(null);
    setPalette(null);
    try {
      const json = await callBranding("colors", { theme: theme ?? "dark" });
      setPaletteSuggestions((json.data?.palettes as ColorPalette[]) ?? []);
    } catch { setPaletteSuggestions([]); }
    finally { setGeneratingColors(false); }
  }

  async function saveBrandKit() {
    setSaving(true);
    const brandKit = { companyName, theme, colorPalette: palette, typography: fontPair, brandStyle, generatedAt: new Date().toISOString() };
    const content = JSON.stringify(brandKit, null, 2);
    try {
      await fetch(`/api/orgs/${orgId}/files`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Brand Kit.json",
          mimeType: "application/json",
          sizeBytes: new TextEncoder().encode(content).length,
          content,
          visibility: "organization",
          source: "branding_wizard"
        })
      });
    } catch { /* non-blocking */ }
    finally { setSaving(false); }
    window.location.href = `/org/${orgId}/onboarding/loading`;
  }

  const canProceed =
    step === 0 ? companyName.trim().length > 0 :
    step === 1 ? theme !== null :
    step === 2 ? palette !== null :
    step === 3 ? fontPair !== null :
    step === 4 ? brandStyle !== null : true;

  const [head, sub] = STEP_HEADS[step] ?? ["", ""];

  return (
    <aside className="flex h-full flex-col border-l border-[var(--border-10)] bg-[var(--background-sidepanel)]">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--border-10)] px-5 py-4">
        <div className="mb-2.5 flex items-center justify-between">
          <StepDots current={step} total={STEP_LABELS.length} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--foreground-40)]">
            {step + 1}&thinsp;/&thinsp;{STEP_LABELS.length} — {STEP_LABELS[step]}
          </span>
        </div>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{head}</h2>
        <p className="text-[11px] text-[var(--foreground-60)]">{sub}</p>
      </div>

      {/* Scrollable step content */}
      <div className="flex-1 overflow-y-auto px-4 py-5">

        {/* ── Step 0: Company Name ── */}
        {step === 0 && (
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--foreground-40)]">AI Suggestions</p>
              <button
                type="button"
                onClick={() => void generateNames()}
                disabled={generatingNames}
                className="flex items-center gap-1 text-[10px] text-[var(--foreground-40)] transition-colors hover:text-[var(--foreground-70)] disabled:opacity-40"
              >
                {generatingNames ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                Regenerate
              </button>
            </div>

            {generatingNames ? (
              <div className="flex items-center gap-2 py-3 text-xs text-[var(--foreground-40)]">
                <Loader2 className="size-3.5 animate-spin" /> Thinking of names…
              </div>
            ) : (
              <div className="grid gap-2">
                {(nameSuggestions ?? []).map((name) => (
                  <OptionCard key={name} selected={companyName === name} onClick={() => setCompanyName(name)}>
                    <span className="text-sm text-[var(--foreground-80)]">{name}</span>
                  </OptionCard>
                ))}
              </div>
            )}

            <div className="border-t border-[var(--border-10)] pt-3">
              <p className="mb-2 text-[11px] text-[var(--foreground-50)]">Or type your own</p>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your company name…"
                className="w-full rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-5)] px-3 py-2.5 text-sm text-[var(--foreground-80)] outline-none placeholder:text-[var(--foreground-30)] focus:border-[var(--focused)]"
              />
            </div>
          </div>
        )}

        {/* ── Step 1: Theme ── */}
        {step === 1 && (
          <div className="grid gap-3">
            {(["dark", "light"] as const).map((t) => (
              <OptionCard key={t} selected={theme === t} onClick={() => setTheme(t)}>
                <div className="flex-1">
                  <div
                    className="mb-2.5 h-14 w-full rounded-[8px] border border-[var(--border-10)]"
                    style={{ background: t === "dark" ? "linear-gradient(135deg,#0a0a0f 60%,#1a1a2e)" : "linear-gradient(135deg,#ffffff 60%,#f0f4ff)" }}
                  >
                    <div className="flex h-full items-end gap-1.5 p-2">
                      <span className="h-4 w-12 rounded-[4px] opacity-60" style={{ background: t === "dark" ? "#ffffff22" : "#00000015" }} />
                      <span className="h-3 w-8 rounded-[4px] opacity-40" style={{ background: t === "dark" ? "#ffffff22" : "#00000015" }} />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-[var(--foreground-80)]">{t === "dark" ? "Dark Mode" : "Light Mode"}</p>
                  <p className="text-xs text-[var(--foreground-50)]">
                    {t === "dark" ? "Modern, easy on the eyes, premium feel" : "Clean, bright, open, professional"}
                  </p>
                </div>
              </OptionCard>
            ))}
          </div>
        )}

        {/* ── Step 2: Colors ── */}
        {step === 2 && (
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--foreground-40)]">AI Palettes</p>
              <button
                type="button"
                onClick={() => void generateColors()}
                disabled={generatingColors}
                className="flex items-center gap-1 text-[10px] text-[var(--foreground-40)] transition-colors hover:text-[var(--foreground-70)] disabled:opacity-40"
              >
                {generatingColors ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                Regenerate
              </button>
            </div>

            {generatingColors || !paletteSuggestions ? (
              <div className="flex items-center gap-2 py-3 text-xs text-[var(--foreground-40)]">
                <Loader2 className="size-3.5 animate-spin" /> Crafting palettes…
              </div>
            ) : (
              paletteSuggestions.map((p, i) => (
                <OptionCard key={i} selected={palette?.name === p.name} onClick={() => setPalette(p)}>
                  <div className="flex-1 grid gap-1.5">
                    <div className="flex items-center gap-2">
                      <Swatch color={p.primary} size="md" />
                      <Swatch color={p.secondary} size="md" />
                      <Swatch color={p.accent} size="md" />
                      <span className="text-xs font-medium text-[var(--foreground-80)]">{p.name}</span>
                    </div>
                    <p className="text-[11px] text-[var(--foreground-50)]">{p.description}</p>
                  </div>
                </OptionCard>
              ))
            )}
          </div>
        )}

        {/* ── Step 3: Fonts ── */}
        {step === 3 && (
          <div className="grid gap-3">
            {FONT_PAIRS.map((fp) => (
              <OptionCard key={fp.id} selected={fontPair?.id === fp.id} onClick={() => setFontPair(fp)}>
                <div className="flex-1 grid gap-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-[var(--border-10)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--foreground-40)]">
                      {fp.tag}
                    </span>
                  </div>
                  <p
                    className="text-base font-semibold text-[var(--foreground-80)] leading-tight"
                    style={{ fontFamily: `'${fp.heading}', sans-serif` }}
                  >
                    {fp.heading}
                  </p>
                  <p
                    className="text-xs text-[var(--foreground-50)] leading-relaxed"
                    style={{ fontFamily: `'${fp.body}', sans-serif` }}
                  >
                    {fp.body} — The quick brown fox jumps.
                  </p>
                  <p className="text-[10px] text-[var(--foreground-30)]">{fp.desc}</p>
                </div>
              </OptionCard>
            ))}
          </div>
        )}

        {/* ── Step 4: Brand Style ── */}
        {step === 4 && (
          <div className="grid grid-cols-2 gap-2.5">
            {BRAND_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setBrandStyle(s.id)}
                className={cn(
                  "flex flex-col gap-1.5 rounded-[12px] border p-3.5 text-left transition-all duration-150 active:scale-[0.98]",
                  brandStyle === s.id
                    ? "border-[var(--tt-brand-color-500)] bg-[rgba(98,41,255,0.07)]"
                    : "border-[var(--border-10)] bg-[var(--background-l0)] hover:border-[var(--foreground-20)]"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--foreground-80)]">{s.label}</span>
                  {brandStyle === s.id ? <Check className="size-3.5 text-[var(--tt-brand-color-500)]" /> : null}
                </div>
                <p className="text-[10px] leading-4 text-[var(--foreground-50)]">{s.desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* ── Step 5: Review ── */}
        {step === 5 && (
          <div className="grid gap-4">
            <div className="rounded-[14px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-4 grid gap-4">
              {/* Name */}
              <div className="grid gap-1">
                <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--foreground-40)]">Company Name</p>
                <p className="text-base font-semibold text-[var(--foreground)]">{companyName}</p>
              </div>

              {/* Theme */}
              <div className="grid gap-1">
                <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--foreground-40)]">Theme</p>
                <span className="w-fit rounded-full border border-[var(--border-10)] px-2.5 py-0.5 text-xs capitalize text-[var(--foreground-70)]">
                  {theme}
                </span>
              </div>

              {/* Colors */}
              {palette ? (
                <div className="grid gap-1.5">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--foreground-40)]">Color Palette</p>
                  <div className="flex items-center gap-2">
                    <Swatch color={palette.primary} size="lg" />
                    <Swatch color={palette.secondary} size="lg" />
                    <Swatch color={palette.accent} size="lg" />
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground-80)]">{palette.name}</p>
                      <p className="text-[11px] text-[var(--foreground-50)]">{palette.description}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Fonts */}
              {fontPair ? (
                <div className="grid gap-1">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--foreground-40)]">Typography</p>
                  <p className="text-sm text-[var(--foreground-70)]" style={{ fontFamily: `'${fontPair.heading}', sans-serif` }}>
                    {fontPair.heading}
                  </p>
                  <p className="text-xs text-[var(--foreground-50)]" style={{ fontFamily: `'${fontPair.body}', sans-serif` }}>
                    {fontPair.body}
                  </p>
                </div>
              ) : null}

              {/* Style */}
              {brandStyle ? (
                <div className="grid gap-1">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--foreground-40)]">Brand Personality</p>
                  <span className="w-fit rounded-full border border-[var(--border-10)] px-2.5 py-0.5 text-xs capitalize text-[var(--foreground-70)]">
                    {BRAND_STYLES.find((s) => s.id === brandStyle)?.label}
                  </span>
                </div>
              ) : null}
            </div>

            <p className="text-[11px] text-[var(--foreground-40)]">
              Both your Business Plan and Brand Kit will be saved to your files section for reference.
            </p>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="shrink-0 border-t border-[var(--border-10)] p-4">
        <div className="flex gap-2">
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)} className="text-[var(--foreground-70)]">
              <ArrowLeft aria-hidden="true" className="size-3.5" />
              Back
            </Button>
          ) : null}

          {step < STEP_LABELS.length - 1 ? (
            <Button
              variant="app"
              size="sm"
              disabled={!canProceed}
              onClick={() => setStep((s) => s + 1)}
              className="ml-auto"
            >
              Continue →
            </Button>
          ) : (
            <Button
              variant="app"
              size="sm"
              disabled={saving}
              onClick={() => void saveBrandKit()}
              className="ml-auto"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle aria-hidden="true" className="size-3.5" />}
              {saving ? "Saving…" : "Save & Enter Canvas"}
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
