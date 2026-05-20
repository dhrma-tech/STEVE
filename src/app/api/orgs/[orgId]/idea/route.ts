import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { ollamaChat } from "@/lib/ai/ollama";

const QUESTION_SYSTEM = `You are a startup advisor. A founder just described their business idea.
Ask ONE focused question at a time to understand their idea well enough to write a business plan.

Rules:
- Only ask questions directly related to the business idea (target users, problem, revenue, competition, or unique advantage)
- Generate exactly 4 specific answer options relevant to THIS idea, plus "Other" as the 5th option
- The first option must be the most likely fit and must end with " (Recommended)"
- Ask at most 2 questions total. If the idea is clear enough after 1 question, set done to true immediately.
- NEVER ask more than 2 questions. If you already have 1 or 2 answers, always set done to true.
- Respond ONLY with a raw JSON object — no markdown, no explanation, no extra text

JSON when asking a question:
{"question":"...","options":["... (Recommended)","...","...","...","Other"],"done":false}

JSON when done:
{"question":"","options":[],"done":true}`;

const PLAN_SYSTEM = `You are a startup consultant writing a business plan for a founder.
Write in simple, plain language — no jargon. Anyone should be able to read and understand this.

Use EXACTLY these Markdown sections in order:

# [Business Name] — Business Plan

## What This Business Does
2-3 sentences. Simple overview anyone can understand.

## The Problem
Who has this problem? Why does it hurt them? Keep it real and specific.

## The Solution
How this idea fixes the problem. What makes it work?

## Who Will Use It
Describe the ideal customer in detail — their age, job, habits, and pain points.

## How It Makes Money
Explain the pricing model clearly. How does money flow in?

## Your Edge Over Competitors
What makes this different from what already exists?

## First 90 Days — Getting Customers
Step-by-step actions: what to build, who to talk to, how to get first paying users.

## Numbers That Matter
List 5–7 key metrics to track (users, revenue, churn, etc.).

## Risks and How to Handle Them
List 3–5 honest risks and a practical mitigation for each.

## 10 Features to Build
List exactly 10 features, ordered from most essential to nice-to-have.
For each: bold name, dash, then one sentence explaining what it does and why users need it.

1. **Feature Name** — What it does and why it matters.
(continue to 10)

Be specific to THIS idea. Minimum 700 words total.`;

const REVISE_SYSTEM = `You are a startup consultant updating a business plan based on founder feedback.
Read the current plan and the change request carefully.
Make ONLY the requested changes — keep everything else exactly the same.
Return the COMPLETE updated business plan in the same Markdown format.`;

type QA = { question: string; answer: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId);

    const body = (await request.json().catch(() => null)) as {
      phase: "question" | "plan" | "revise";
      description: string;
      qas: QA[];
      currentPlan?: string;
      revisionRequest?: string;
    } | null;

    if (!body?.description?.trim()) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }

    const { phase, description, qas } = body;

    if (phase === "question") {
      const context = qas.length
        ? `Questions asked so far: ${qas.length}\n\n` + qas.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join("\n\n")
        : "No questions asked yet — ask question 1.";

      const raw = await ollamaChat({ system: QUESTION_SYSTEM, user: `Idea: ${description}\n\n${context}` });
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      // extract first JSON object from response (Mistral sometimes adds prose)
      const match = cleaned.match(/\{[\s\S]*\}/);
      const jsonStr = match ? match[0] : cleaned;

      try {
        const result = JSON.parse(jsonStr) as { question: string; options: string[]; done: boolean };
        return NextResponse.json({ data: result });
      } catch {
        console.error("[idea/question] JSON parse error. Raw:", cleaned);
        return NextResponse.json({ error: "Failed to parse question from AI response." }, { status: 500 });
      }
    }

    if (phase === "plan") {
      const context = qas.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join("\n\n");
      const plan = await ollamaChat({ system: PLAN_SYSTEM, user: `Idea: ${description}\n\nFounder answers:\n${context}` });
      return NextResponse.json({ data: { plan } });
    }

    if (phase === "revise") {
      if (!body.currentPlan?.trim() || !body.revisionRequest?.trim()) {
        return NextResponse.json({ error: "currentPlan and revisionRequest are required for revise phase." }, { status: 400 });
      }
      const prompt = `CURRENT PLAN:\n${body.currentPlan}\n\nCHANGE REQUEST:\n${body.revisionRequest}\n\nOriginal idea: ${description}`;
      const updated = await ollamaChat({ system: REVISE_SYSTEM, user: prompt });
      return NextResponse.json({ data: { plan: updated } });
    }

    return NextResponse.json({ error: "Invalid phase." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[idea route]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
