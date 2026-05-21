"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle, Download, Loader2, Maximize2, Minus, RotateCcw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type QA = { question: string; answer: string };

type Message =
  | { role: "user"; content: string }
  | { role: "ai"; content: string; options?: string[]; isPlan?: boolean; isTyping?: boolean; isError?: boolean };

function PlanContent({ text }: { text: string }) {
  return (
    <div className="grid gap-1.5">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("# "))
          return <h2 key={i} className="mt-1 text-sm font-semibold text-[var(--foreground)]">{line.slice(2)}</h2>;
        if (line.startsWith("## "))
          return <h3 key={i} className="mt-3 mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-50)]">{line.slice(3)}</h3>;
        if (/^\d+\.\s\*\*/.test(line)) {
          const match = line.match(/^\d+\.\s\*\*(.+?)\*\*\s*[—–-]\s*(.*)/);
          if (match)
            return (
              <p key={i} className="flex gap-1.5 text-xs leading-5 text-[var(--foreground-70)]">
                <span className="shrink-0 font-semibold text-[var(--foreground-50)]">{line.match(/^\d+/)?.[0]}.</span>
                <span><strong className="text-[var(--foreground-80)]">{match[1]}</strong> — {match[2]}</span>
              </p>
            );
        }
        if (line.startsWith("- "))
          return (
            <p key={i} className="flex gap-2 text-xs leading-5 text-[var(--foreground-70)]">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-[var(--foreground-30)]" />
              <span>{line.slice(2)}</span>
            </p>
          );
        if (line.trim() === "") return <div key={i} className="h-0.5" />;
        return <p key={i} className="text-xs leading-5 text-[var(--foreground-70)]">{line}</p>;
      })}
    </div>
  );
}

const GREETINGS = [
  (name: string) => `Hey ${name}! I'm here to turn your idea into the sharpest business plan you've ever seen. What are you building?`,
  (name: string) => `${name}! Drop your idea below — I'll ask a few smart questions, then write you a world-class plan. Let's go.`,
  (name: string) => `Good to see you, ${name}. Tell me what you're building and I'll craft a business plan so good it'll speak for itself.`,
  (name: string) => `${name}, every great company started with one idea. Tell me yours — I'll do the rest.`,
];

function pickGreeting(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  const fn = GREETINGS[Math.abs(hash) % GREETINGS.length]!;
  return fn(name);
}

export function IdeaPanel({ orgId, userName }: { orgId: string; userName?: string }) {
  const name = userName ?? "there";
  const greeting = pickGreeting(name);

  const [description, setDescription] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([
    { role: "ai", content: greeting }
  ]);
  const [qas, setQas] = React.useState<QA[]>([]);
  const [selectedOption, setSelectedOption] = React.useState("");
  const [otherText, setOtherText] = React.useState("");
  const [showOtherInput, setShowOtherInput] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [phase, setPhase] = React.useState<"describe" | "questions" | "plan">("describe");
  const [planContent, setPlanContent] = React.useState("");
  const [revisionText, setRevisionText] = React.useState("");
  const [revising, setRevising] = React.useState(false);
  const [showFullPlan, setShowFullPlan] = React.useState(false);
  const [planMinimized, setPlanMinimized] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const retryRef = React.useRef<(() => Promise<void>) | null>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleRetry() {
    setMessages((m) => m.slice(0, -1));
    if (retryRef.current) await retryRef.current();
  }

  async function callIdea(
    p: "question" | "plan" | "revise",
    desc: string,
    currentQAs: QA[],
    extra?: { currentPlan?: string; revisionRequest?: string }
  ) {
    const res = await fetch(`/api/orgs/${orgId}/idea`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase: p, description: desc, qas: currentQAs, ...extra })
    });
    const payload = (await res.json()) as { data?: Record<string, unknown>; error?: string };
    if (!res.ok) throw new Error(payload.error ?? "Request failed.");
    return payload.data ?? {};
  }

  async function submitDescription() {
    const text = description.trim();
    if (!text || text.length < 20 || loading) return;

    sessionStorage.setItem("ideaDescription", text);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);

    try {
      const data = await callIdea("question", text, []) as { question: string; options: string[]; done: boolean };
      if (data.done) {
        await runPlan(text, []);
      } else {
        setMessages((m) => [
          ...m,
          { role: "ai", content: data.question, options: data.options }
        ]);
        setPhase("questions");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      const retry = async () => {
        retryRef.current = retry;
        setLoading(true);
        try {
          const data = await callIdea("question", text, []) as { question: string; options: string[]; done: boolean };
          if (data.done) { await runPlan(text, []); }
          else { setMessages((m) => [...m, { role: "ai", content: data.question, options: data.options }]); setPhase("questions"); }
        } catch (e) {
          const m2 = e instanceof Error ? e.message : "Something went wrong.";
          setMessages((m) => [...m, { role: "ai", content: `Error: ${m2}`, isError: true }]);
        } finally { setLoading(false); }
      };
      retryRef.current = retry;
      setMessages((m) => [...m, { role: "ai", content: `Error: ${msg}`, isError: true }]);
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer(overrideAnswer?: string) {
    const answer = overrideAnswer ?? (showOtherInput && otherText.trim() ? otherText.trim() : selectedOption);
    if (!answer || loading) return;

    const lastAI = [...messages].reverse().find((m) => m.role === "ai" && m.options);
    const question = (lastAI as { content: string } | undefined)?.content ?? "";
    const newQA: QA = { question, answer };
    const newQAs = [...qas, newQA];
    setQas(newQAs);
    setSelectedOption("");
    setOtherText("");
    setShowOtherInput(false);

    setMessages((m) => [
      ...m.map((msg) => ({ ...msg, options: undefined })),
      { role: "user", content: answer }
    ]);
    setLoading(true);

    try {
      const data = await callIdea("question", description.trim(), newQAs) as { question: string; options: string[]; done: boolean };
      if (data.done) {
        await runPlan(description.trim(), newQAs);
      } else {
        setMessages((m) => [...m, { role: "ai", content: data.question, options: data.options }]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      const capturedDesc = description.trim();
      const retry = async () => {
        retryRef.current = retry;
        setLoading(true);
        try {
          const data = await callIdea("question", capturedDesc, newQAs) as { question: string; options: string[]; done: boolean };
          if (data.done) { await runPlan(capturedDesc, newQAs); }
          else { setMessages((m) => [...m, { role: "ai", content: data.question, options: data.options }]); }
        } catch (e) {
          const m2 = e instanceof Error ? e.message : "Something went wrong.";
          setMessages((m) => [...m, { role: "ai", content: `Error: ${m2}`, isError: true }]);
        } finally { setLoading(false); }
      };
      retryRef.current = retry;
      setMessages((m) => [...m, { role: "ai", content: `Error: ${msg}`, isError: true }]);
    } finally {
      setLoading(false);
    }
  }

  async function runPlan(desc: string, currentQAs: QA[]) {
    setMessages((m) => [...m, { role: "ai", content: "Writing your business plan…", isTyping: true }]);
    try {
      const data = await callIdea("plan", desc, currentQAs) as { plan: string };
      setPlanContent(data.plan);
      sessionStorage.setItem("businessPlan", data.plan);
      setMessages((m) => [
        ...m.filter((msg) => !("isTyping" in msg && msg.isTyping)),
        { role: "ai", content: data.plan, isPlan: true }
      ]);
      setPhase("plan");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate business plan.";
      const retry = async () => {
        retryRef.current = retry;
        await runPlan(desc, currentQAs);
      };
      retryRef.current = retry;
      setMessages((m) => [
        ...m.filter((msg) => !("isTyping" in msg && msg.isTyping)),
        { role: "ai", content: `Error: ${msg}`, isError: true }
      ]);
    }
  }

  async function requestRevision() {
    const request = revisionText.trim();
    if (!request || revising) return;

    setRevising(true);
    setRevisionText("");
    setMessages((m) => [
      ...m,
      { role: "user", content: request },
      { role: "ai", content: "Updating your business plan…", isTyping: true }
    ]);

    try {
      const data = await callIdea("revise", description.trim(), qas, {
        currentPlan: planContent,
        revisionRequest: request
      }) as { plan: string };

      setPlanContent(data.plan);
      setMessages((m) => {
        const withoutTyping = m.filter((msg) => !("isTyping" in msg && msg.isTyping));
        const indices = withoutTyping.map((msg, i) => ("isPlan" in msg && msg.isPlan ? i : -1)).filter((i) => i !== -1);
        const lastPlanIdx = indices.at(-1);
        if (lastPlanIdx !== undefined) {
          const updated = [...withoutTyping];
          updated[lastPlanIdx] = { role: "ai", content: data.plan, isPlan: true };
          return updated;
        }
        return [...withoutTyping, { role: "ai", content: data.plan, isPlan: true }];
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update plan.";
      setMessages((m) => [
        ...m.filter((msg) => !("isTyping" in msg && msg.isTyping)),
        { role: "ai", content: `Error: ${msg}` }
      ]);
    } finally {
      setRevising(false);
    }
  }

  function downloadPlan() {
    const blob = new Blob([planContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "business-plan.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const activeOptions = (() => {
    const last = [...messages].reverse().find((m) => m.role === "ai" && m.options);
    return (last as { options?: string[] } | undefined)?.options;
  })();

  const canAnswer = (selectedOption && selectedOption !== "Other") || (showOtherInput && otherText.trim().length > 0);

  return (
    <>
      {/* Full-screen plan modal — rendered via portal to escape overflow:hidden parent */}
      {showFullPlan ? createPortal(
        <div
          className={`animate-fullplan-backdrop fixed inset-0 z-[500] flex ${planMinimized ? "items-end justify-start p-6" : "items-center justify-center p-6"}`}
          style={{ background: planMinimized ? "transparent" : "rgba(0,0,0,0.65)", backdropFilter: planMinimized ? "none" : "blur(2px)" }}
          onClick={planMinimized ? undefined : () => setShowFullPlan(false)}
        >
          {/* Floating panel */}
          <div
            className={`animate-fullplan-in relative flex overflow-hidden rounded-[22px] bg-[var(--background)] shadow-[0_32px_100px_rgba(0,0,0,0.4)] transition-all duration-300 ${planMinimized ? "h-[52px] w-[300px]" : "h-[85vh] w-full max-w-3xl flex-col"}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-10)] px-5 py-3.5">
              <span className="text-sm font-semibold text-[var(--foreground-80)]">Business Plan</span>
              <div className="flex items-center gap-1">
                {!planMinimized ? (
                  <Button variant="ghost" size="sm" onClick={downloadPlan} className="text-[var(--foreground-60)] hover:bg-[var(--foreground-5)]">
                    <Download aria-hidden="true" className="size-3.5" />
                    Download .md
                  </Button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPlanMinimized((v) => !v)}
                  aria-label={planMinimized ? "Restore" : "Minimize"}
                  className="grid size-7 place-items-center rounded-[7px] border border-[var(--border-10)] text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-5)] hover:text-[var(--foreground-80)]"
                >
                  {planMinimized ? (
                    <Maximize2 aria-hidden="true" className="size-3.5" />
                  ) : (
                    <Minus aria-hidden="true" className="size-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowFullPlan(false); setPlanMinimized(false); }}
                  aria-label="Close"
                  className="grid size-7 place-items-center rounded-[7px] border border-[var(--border-10)] text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-5)] hover:text-[var(--foreground-80)]"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
            </div>
            {/* Scrollable content */}
            {!planMinimized ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
                <div className="mx-auto max-w-2xl">
                  <PlanContent text={planContent} />
                </div>
              </div>
            ) : null}
          </div>
        </div>,
        document.body
      ) : null}

      <aside className="flex h-full flex-col border-l border-[var(--border-10)] bg-[var(--background-sidepanel)]">
        {/* Header */}
        <div className="shrink-0 border-b border-[var(--border-10)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">What are you building?</h2>
          <p className="text-[11px] text-[var(--foreground-60)]">
            {phase === "plan"
              ? "Your business plan is ready — download, revise, or proceed."
              : "Tell us your idea — we'll ask a few questions, then write your business plan."}
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="grid gap-4">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[82%] rounded-[14px] rounded-tr-[3px] bg-[var(--primary)] px-3.5 py-2.5 text-sm leading-5 text-[var(--primary-foreground)]">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {msg.isPlan ? (
                      <div className="rounded-[14px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-4">
                        <PlanContent text={msg.content} />
                      </div>
                    ) : (
                      <div className={cn(
                        "max-w-[85%] rounded-[14px] rounded-tl-[3px] px-3.5 py-2.5 text-sm leading-5",
                        msg.isTyping
                          ? "bg-[var(--foreground-5)] text-[var(--foreground-40)] italic"
                          : "bg-[var(--foreground-5)] text-[var(--foreground-80)]"
                      )}>
                        {msg.isTyping ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="size-3.5 animate-spin" />
                            {msg.content}
                          </span>
                        ) : msg.content}
                      </div>
                    )}

                    {msg.isError && i === messages.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => void handleRetry()}
                        disabled={loading}
                        className="flex w-fit items-center gap-1.5 rounded-[8px] border border-[var(--border-10)] bg-[var(--background-l0)] px-3 py-1.5 text-xs text-[var(--foreground-60)] transition-all hover:border-[var(--foreground-20)] hover:text-[var(--foreground-80)] disabled:opacity-40"
                      >
                        <RotateCcw className="size-3" />
                        Retry
                      </button>
                    ) : null}

                    {i === messages.length - 1 && activeOptions && !loading ? (
                      <div className="grid gap-2 pl-1">
                        {activeOptions.filter((opt) => opt !== "Other").map((opt) => {
                          const isRec = opt.endsWith("(Recommended)");
                          const label = isRec ? opt.replace(" (Recommended)", "") : opt;
                          const isSelected = selectedOption === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => { setSelectedOption(opt); setShowOtherInput(false); setOtherText(""); }}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 rounded-[10px] border px-3.5 py-2.5 text-left text-sm transition-all duration-150 active:scale-[0.99]",
                                isSelected
                                  ? "border-[var(--tt-brand-color-500)] bg-[rgba(98,41,255,0.07)] text-[var(--foreground)]"
                                  : "border-[var(--border-10)] bg-[var(--background-l0)] text-[var(--foreground-70)] hover:border-[var(--foreground-20)]"
                              )}
                            >
                              <span>{label}</span>
                              {isRec ? (
                                <span className="shrink-0 rounded-full bg-[var(--tt-brand-color-500)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white">
                                  Recommended
                                </span>
                              ) : null}
                            </button>
                          );
                        })}

                        {/* "Add anything else" toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            const next = !showOtherInput;
                            setShowOtherInput(next);
                            if (next) setSelectedOption("");
                            else setOtherText("");
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-[10px] border px-3.5 py-2.5 text-left text-sm transition-all duration-150 active:scale-[0.99]",
                            showOtherInput
                              ? "border-[var(--tt-brand-color-500)] bg-[rgba(98,41,255,0.07)] text-[var(--foreground)]"
                              : "border-dashed border-[var(--border-10)] bg-transparent text-[var(--foreground-40)] hover:border-[var(--foreground-20)] hover:text-[var(--foreground-70)]"
                          )}
                        >
                          <span className="text-base leading-none">{showOtherInput ? "−" : "+"}</span>
                          <span>Add anything else</span>
                        </button>

                        {showOtherInput ? (
                          <textarea
                            autoFocus
                            value={otherText}
                            onChange={(e) => setOtherText(e.target.value)}
                            placeholder="Describe your answer…"
                            rows={3}
                            className="w-full resize-none rounded-[10px] border border-[var(--tt-brand-color-500)] bg-[var(--foreground-3)] p-3 text-sm text-[var(--foreground-80)] outline-none placeholder:text-[var(--foreground-30)]"
                          />
                        ) : null}

                        <div className="mt-1 flex items-center gap-2">
                          <Button
                            variant="app"
                            size="sm"
                            disabled={!canAnswer}
                            onClick={() => void submitAnswer()}
                            className="w-fit"
                          >
                            Submit answer
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={loading}
                            onClick={() => {
                              const allOpts = activeOptions.filter((o) => o !== "Other");
                              void submitAnswer(allOpts.join(", "));
                            }}
                            className="w-fit border border-[var(--border-10)] text-[var(--foreground-70)] hover:bg-[var(--foreground-5)]"
                          >
                            Select All
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}

            {loading && !messages.some((m) => "isTyping" in m && m.isTyping) ? (
              <div className="flex items-center gap-2 text-xs text-[var(--foreground-40)]">
                <Loader2 className="size-3.5 animate-spin" />
                Thinking…
              </div>
            ) : null}
          </div>

          <div ref={bottomRef} />
        </div>

        {/* Describe input */}
        {phase === "describe" ? (
          <div className="shrink-0 border-t border-[var(--border-10)] p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submitDescription(); } }}
                placeholder="Describe your startup idea… (min 20 chars)"
                disabled={loading}
                rows={3}
                className="flex-1 resize-none rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-5)] p-3 text-sm text-[var(--foreground-80)] outline-none placeholder:text-[var(--foreground-30)] focus:border-[var(--focused)] disabled:opacity-50"
                style={{ minHeight: "72px", maxHeight: "140px" }}
              />
              <Button
                variant="app"
                size="sm"
                className="mb-0.5 shrink-0"
                disabled={description.trim().length < 20 || loading}
                onClick={() => void submitDescription()}
              >
                <Send aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
            <p className="mt-1.5 text-[10px] text-[var(--foreground-30)]">Press Enter to send · Shift+Enter for new line</p>
          </div>
        ) : null}

        {/* Plan actions */}
        {phase === "plan" ? (
          <div className="shrink-0 border-t border-[var(--border-10)] p-4">
            <div className="mb-3 flex gap-2">
              <Button variant="ghost" size="sm" onClick={downloadPlan} className="flex-1 text-[var(--foreground-70)]">
                <Download aria-hidden="true" className="size-3.5" />
                Download .md
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowFullPlan(true)} className="flex-1 text-[var(--foreground-70)]">
                <Maximize2 aria-hidden="true" className="size-3.5" />
                Full Screen
              </Button>
            </div>

            <div className="mb-3 border-t border-[var(--border-10)]" />

            <p className="mb-2 text-[11px] font-medium text-[var(--foreground-50)]">Want any changes?</p>
            <textarea
              value={revisionText}
              onChange={(e) => setRevisionText(e.target.value)}
              placeholder="e.g. Make the revenue section more detailed, focus on B2B…"
              rows={2}
              disabled={revising}
              className="mb-2 w-full resize-none rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-5)] p-3 text-sm text-[var(--foreground-80)] outline-none placeholder:text-[var(--foreground-30)] focus:border-[var(--focused)] disabled:opacity-50"
            />

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={!revisionText.trim() || revising}
                onClick={() => void requestRevision()}
                className="flex-1 text-[var(--foreground-70)]"
              >
                {revising ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Request Changes
              </Button>
              <Button
                variant="app"
                size="sm"
                disabled={saving}
                onClick={() => void (async () => {
                  setSaving(true);
                  try {
                    await fetch(`/api/orgs/${orgId}/files`, {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        name: "Business Plan.md",
                        mimeType: "text/markdown",
                        sizeBytes: new TextEncoder().encode(planContent).length,
                        content: planContent,
                        visibility: "organization",
                        source: "idea_wizard"
                      })
                    });
                  } catch { /* non-blocking */ }
                  finally { setSaving(false); }
                  window.location.href = `/org/${orgId}/onboarding/branding`;
                })()}
                className="flex-1"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle aria-hidden="true" className="size-3.5" />}
                {saving ? "Saving…" : "Finalise & Proceed"}
              </Button>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
