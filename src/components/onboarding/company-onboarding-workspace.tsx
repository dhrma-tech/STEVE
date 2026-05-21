"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, Loader2, Moon, Send, Sparkles, Sun } from "lucide-react";
import { companyQuestions, departmentDefinitions, type CompanyQuestion } from "@/lib/onboarding/definitions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, AppPanel } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Textarea } from "@/components/ui/textarea";
import { OptionCard } from "@/components/onboarding/option-card";
import { DesignOnboardingWizard } from "@/components/onboarding/design-onboarding-wizard";
import { IdeaPanel } from "@/components/onboarding/idea-panel";

type Answer = {
  questionKey: string;
  questionText: string;
  selectedOption: string | null;
  freeText: string | null;
  recommendedOption: string | null;
  aiDecided: boolean;
};

type OrganizationState = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  designOnboardingStatus: string;
  businessPlanFileId: string | null;
};

type InitialState = {
  organization: OrganizationState;
  answers: Answer[];
  departments: Array<{ id: string; slug: string; name: string; availability: string }>;
  agents: Array<{ id: string; name: string }>;
  integrations: Array<{ id: string; provider: string; status: string }>;
  businessPlanFile: { id: string; name: string; metadataJson: string | null } | null;
  design: {
    status: string;
    selectedVibe: string | null;
    references: unknown;
    brandKit: unknown;
    feedback: string | null;
  };
};

type ActionLog = { label: string; status: string };

export function CompanyOnboardingWorkspace({ initialState, userName }: { initialState: InitialState; userName?: string }) {
  const router = useRouter();
  const [state, setState] = React.useState(initialState);
  const [description, setDescription] = React.useState(initialState.organization.description ?? "");
  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [questionOpen, setQuestionOpen] = React.useState(false);
  const [selectedOption, setSelectedOption] = React.useState("");
  const [freeText, setFreeText] = React.useState("");
  const [actions, setActions] = React.useState<ActionLog[]>([]);
  const [businessPlan, setBusinessPlan] = React.useState<Record<string, unknown> | null>(() => parseBusinessPlan(initialState.businessPlanFile?.metadataJson));
  const [loading, setLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const answersByKey = new Map(state.answers.map((answer) => [answer.questionKey, answer]));
  const answeredCount = companyQuestions.filter((question) => {
    const answer = answersByKey.get(question.key);
    return Boolean(answer?.selectedOption || answer?.freeText);
  }).length;
  const allAnswered = answeredCount === companyQuestions.length;
  const activated = state.organization.status === "active" && state.departments.length === 8;
  const showDesign = activated || state.organization.designOnboardingStatus !== "not_started";

  async function describeCompany() {
    setLoading("describe");
    setError(null);
    const response = await api(`/api/orgs/${state.organization.id}/describe`, { description });
    setLoading(null);
    if (!response.ok) return;
    setActions(response.data.actions);
    setQuestionOpen(true);
  }

  async function answerQuestion(aiDecided = false) {
    const question = companyQuestions[questionIndex];
    const option = selectedOption || question.options.find((item) => item.recommended)?.id || question.options[0]?.id;
    setLoading("answer");
    setError(null);
    const response = await api(`/api/orgs/${state.organization.id}/questions/${question.key}/answer`, {
      selectedOption: option,
      freeText: freeText || null,
      aiDecided
    });
    setLoading(null);
    if (!response.ok) return;

    setState((current) => upsertAnswer(current, response.data.answer as Answer));
    setSelectedOption("");
    setFreeText("");
    if (questionIndex < companyQuestions.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else {
      setQuestionOpen(false);
    }
  }

  async function decideAll() {
    setLoading("decide-all");
    const response = await api(`/api/orgs/${state.organization.id}/questions/decide-all`, {});
    setLoading(null);
    if (!response.ok) return;
    setState((current) => ({ ...current, answers: response.data.answers as Answer[] }));
    setQuestionOpen(false);
  }

  async function generatePlan() {
    setLoading("business-plan");
    const response = await api(`/api/orgs/${state.organization.id}/business-plan`, {});
    setLoading(null);
    if (!response.ok) return;
    setBusinessPlan(response.data.plan);
    setActions(response.data.actions);
    setState((current) => ({ ...current, businessPlanFile: response.data.file }));
  }

  async function activateDepartments() {
    setLoading("activate");
    const response = await api(`/api/orgs/${state.organization.id}/activate-departments`, {});
    setLoading(null);
    if (!response.ok) return;
    setActions([{ label: "Activated departments", status: "succeeded" }, { label: "Seeded agents, roadmap, files, integrations", status: "succeeded" }]);
    setState((current) => ({
      ...current,
      organization: { ...current.organization, status: "active", designOnboardingStatus: "not_started" },
      departments: response.data.departments,
      agents: response.data.agents,
      integrations: response.data.integrations,
      businessPlanFile: response.data.businessPlanFile
    }));
    router.replace(response.data.nextRoute);
  }

  async function api(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Request failed.");
      return { ok: false, data: null };
    }
    return { ok: true, data: payload.data };
  }

  return (
    <main className="relative z-[40] h-dvh overflow-hidden bg-black">
      {/* Looping background video — replace /login-bg.mp4.mp4 with your own clip */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/onboarding.mp4" type="video/mp4" />
      </video>

      {/* Subtle dark overlay so panels stay readable */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Corner toggles — z-[60] so preview portal (z-[500]) always floats above */}
      <OnboardingToggles orgId={state.organization.id} />

      {/* Floating idea panel — solid bg ensures video never bleeds through */}
      <div className="animate-panel-slide-in pointer-events-auto fixed bottom-5 right-5 top-16 z-50 flex w-[390px] flex-col overflow-hidden rounded-[16px] border border-[var(--border-10)] bg-[var(--background-sidepanel)] shadow-[var(--tt-shadow-elevated-md)] xl:w-[420px]">
        <IdeaPanel orgId={state.organization.id} userName={userName} />
      </div>
    </main>
  );
}

function OnboardingToggles({ orgId }: { orgId: string }) {
  const [dark, setDark] = React.useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false
  );

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const btnClass =
    "pointer-events-auto flex items-center gap-2 rounded-[10px] border border-white/20 bg-black/30 px-3 py-2 text-sm text-white/70 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white";

  return (
    <div className="pointer-events-none fixed left-4 top-4 z-[60] flex items-center gap-2">
      {/* Log out */}
      <button type="button" onClick={() => void logout()} className={btnClass}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Log out
      </button>

      {/* Theme toggle */}
      <button type="button" onClick={toggleTheme} aria-label="Toggle theme" className={btnClass}>
        {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      </button>

      {/* Discord */}
      <a
        href="https://discord.gg/yvjur4qj"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Join Discord"
        className={btnClass}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.04.033.05a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
        Discord
      </a>
    </div>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="app" className="rounded-[12px] p-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">{label}</p>
      <p className="mt-2 text-lg font-medium tracking-[0px]">{value}</p>
    </Card>
  );
}

function AnsweredQuestions({ answers }: { answers: Answer[] }) {
  if (answers.length === 0) {
    return <EmptyState title="No questions yet" description="Submit a company description to generate Cofounder's five onboarding questions." />;
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="answers" className="border-[var(--border-10)]">
        <AccordionTrigger className="text-[var(--foreground-80)]">Answered questions</AccordionTrigger>
        <AccordionContent className="grid gap-2 text-[var(--foreground-50)]">
          {answers.map((answer) => (
            <div key={answer.questionKey} className="rounded-[8px] border border-[var(--border-10)] p-3">
              <p className="text-sm text-[var(--foreground-80)]">{answer.questionText}</p>
              <p className="mt-1 text-xs">{answer.freeText || answer.selectedOption || "Waiting for answer"}</p>
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function BusinessPlanPreview({ plan }: { plan: Record<string, unknown> }) {
  return (
    <Card variant="deep" className="grid gap-3 rounded-[12px] p-4">
      <Badge variant="success">Business Plan.md</Badge>
      <div>
        <h3 className="font-medium">Product/Service</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--foreground-50)]">{String(plan.productOrService ?? "")}</p>
      </div>
      <div>
        <h3 className="font-medium">ICP</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--foreground-50)]">{String(plan.icp ?? "")}</p>
      </div>
    </Card>
  );
}

function ActionLog({ actions }: { actions: ActionLog[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="grid gap-2 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
      {actions.map((action) => (
        <div key={action.label} className="flex items-center justify-between gap-3 text-sm">
          <span>{action.label}</span>
          <Badge variant={action.status === "succeeded" ? "success" : "running"}>{action.status}</Badge>
        </div>
      ))}
    </div>
  );
}

function QuestionDialog({
  open,
  onOpenChange,
  question,
  index,
  selectedOption,
  setSelectedOption,
  freeText,
  setFreeText,
  loading,
  onAnswer,
  onDecide,
  onDecideAll
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: CompanyQuestion;
  index: number;
  selectedOption: string;
  setSelectedOption: (value: string) => void;
  freeText: string;
  setFreeText: (value: string) => void;
  loading: string | null;
  onAnswer: () => void;
  onDecide: () => void;
  onDecideAll: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Question {index + 1} of {companyQuestions.length}
          </DialogTitle>
          <DialogDescription>{question.text}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {question.options.map((option) => (
            <OptionCard key={option.id} selected={selectedOption === option.id} title={option.label} recommended={option.recommended} onClick={() => setSelectedOption(option.id)} />
          ))}
          {question.allowsFreeText ? (
            <Textarea surface="dark" label="Free text" value={freeText} onChange={(event) => setFreeText(event.target.value)} />
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onDecideAll} disabled={loading === "decide-all"}>
            Decide all
          </Button>
          <Button variant="app" onClick={onDecide} disabled={loading === "answer"}>
            Decide this one
          </Button>
          <Button variant="brand" onClick={onAnswer} disabled={loading === "answer" || (!selectedOption && !freeText)}>
            Save answer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function upsertAnswer(state: InitialState, answer: Answer): InitialState {
  const answers = state.answers.filter((item) => item.questionKey !== answer.questionKey);
  return { ...state, answers: [...answers, answer] };
}

function parseBusinessPlan(metadataJson: string | null | undefined) {
  if (!metadataJson) return null;
  try {
    return JSON.parse(metadataJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}
