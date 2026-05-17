"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, Loader2, Send, Sparkles } from "lucide-react";
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
    <main className="relative h-dvh overflow-hidden bg-black">
      {/* Looping background video — replace /login-bg.mp4.mp4 with your own clip */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/login-bg.mp4.mp4" type="video/mp4" />
      </video>

      {/* Subtle dark overlay so panels stay readable */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Floating idea panel — solid bg ensures video never bleeds through */}
      <div className="animate-panel-slide-in pointer-events-auto fixed bottom-5 right-5 top-16 z-50 flex w-[390px] flex-col overflow-hidden rounded-[16px] border border-[var(--border-10)] bg-[var(--background-sidepanel)] shadow-[var(--tt-shadow-elevated-md)] xl:w-[420px]">
        <IdeaPanel orgId={state.organization.id} userName={userName} />
      </div>
    </main>
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
