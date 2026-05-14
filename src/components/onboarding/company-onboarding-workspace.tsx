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

export function CompanyOnboardingWorkspace({ initialState }: { initialState: InitialState }) {
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
    <main className="min-h-dvh bg-[var(--background)] p-4 text-[var(--foreground-80)]">
      <div className="grid min-h-[calc(100dvh-32px)] gap-4 lg:grid-cols-[minmax(0,1fr)_456px]">
        <section className="relative overflow-hidden rounded-[18px] border border-[var(--border-10)] bg-[radial-gradient(circle_at_center,rgba(98,41,255,0.18),rgba(30,30,35,0)_38%),var(--background)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">Company activation canvas</p>
              <h1 className="mt-2 text-3xl font-medium tracking-[0px]">{state.organization.name}</h1>
            </div>
            <Badge variant={activated ? "success" : "warning"}>{activated ? "Departments active" : "Onboarding"}</Badge>
          </div>

          <div className="relative mx-auto mt-10 min-h-[430px] max-w-[720px]">
            <div className="absolute left-1/2 top-1/2 size-[310px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/15" />
            <div className="absolute left-1/2 top-1/2 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[18px] border border-[var(--border-10)] bg-[var(--card)]">
              <Bot aria-hidden="true" className="size-8 text-[var(--focused)]" />
              <span className="text-xs text-[var(--foreground-50)]">Cofounder</span>
            </div>
            {departmentDefinitions.map((department, index) => {
              const angle = (Math.PI * 2 * index) / departmentDefinitions.length - Math.PI / 2;
              const x = 50 + Math.cos(angle) * 38;
              const y = 50 + Math.sin(angle) * 38;
              const Icon = department.lucideIcon;
              const built = state.departments.some((item) => item.slug === department.slug);
              return (
                <div key={department.slug} className="absolute grid min-w-[120px] -translate-x-1/2 -translate-y-1/2 gap-1 rounded-[12px] border border-white/10 bg-[var(--background-l0-85)] p-3 text-center" style={{ left: `${x}%`, top: `${y}%` }}>
                  <Icon aria-hidden="true" className="mx-auto size-5" style={{ color: department.color }} />
                  <span className="text-xs">{department.name}</span>
                  <span className="text-[10px] uppercase text-[var(--foreground-50)]">{built ? department.availability.replace("_", " ") : "pending"}</span>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <StatusTile label="Questions" value={`${answeredCount}/5`} />
            <StatusTile label="Business plan" value={businessPlan ? "Generated" : "Pending"} />
            <StatusTile label="Activation" value={activated ? "Complete" : "Pending"} />
          </div>
        </section>

        <AppPanel className="grid content-start gap-4 overflow-y-auto p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[10px] bg-[var(--tt-brand-color-500)]">
              <Sparkles aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="font-medium tracking-[0px]">Cofounder onboarding</h2>
              <p className="text-xs text-[var(--foreground-50)]">Company questions, business plan, activation, brand kit.</p>
            </div>
          </div>

          {error ? <ErrorState title="Onboarding request failed" description={error} /> : null}

          {!showDesign ? (
            <div className="grid gap-4">
              <Textarea surface="dark" label="Describe the company" value={description} onChange={(event) => setDescription(event.target.value)} description="Minimum 20 characters. Cofounder will generate 5 company questions." />
              <Button variant="app" disabled={description.trim().length < 20 || loading === "describe"} onClick={describeCompany}>
                {loading === "describe" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Send aria-hidden="true" className="size-4" />}
                Generate questions
              </Button>

              <AnsweredQuestions answers={state.answers} />

              <Button variant="brand" disabled={!allAnswered || loading === "business-plan"} onClick={generatePlan}>
                {loading === "business-plan" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                Generate business plan
              </Button>

              {businessPlan ? <BusinessPlanPreview plan={businessPlan} /> : <EmptyState title="Business plan pending" description="Answer all five company questions, then generate the Product/Service and ICP sections." />}

              <Button variant="app" disabled={!businessPlan || loading === "activate"} onClick={activateDepartments}>
                {loading === "activate" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="size-4" />}
                Accept & activate departments
              </Button>
            </div>
          ) : (
            <DesignOnboardingWizard
              orgId={state.organization.id}
              initialState={state.design}
              onStatusChange={(status) => setState((current) => ({ ...current, organization: { ...current.organization, designOnboardingStatus: status } }))}
            />
          )}

          <ActionLog actions={actions} />
        </AppPanel>
      </div>

      <QuestionDialog
        open={questionOpen}
        onOpenChange={setQuestionOpen}
        question={companyQuestions[questionIndex]}
        index={questionIndex}
        selectedOption={selectedOption}
        setSelectedOption={setSelectedOption}
        freeText={freeText}
        setFreeText={setFreeText}
        loading={loading}
        onAnswer={() => answerQuestion(false)}
        onDecide={() => answerQuestion(true)}
        onDecideAll={decideAll}
      />
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
