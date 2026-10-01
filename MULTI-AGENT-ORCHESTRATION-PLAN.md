# STEVE — Multi-Agent Orchestration Plan (v2)

> Created: 2026-09-29 · Status: proposed, not started
> Supersedes the "what's next" part of `MULTI-AGENT-PLAN.md` (phases 1–8 of that plan are built; this plan makes them a *system*).
> Audience: founders and managers who delegate company work to AI agents and stay in control.

---

## 1. Goal and definition of done

**Goal:** a founder types an outcome ("get our first 10 paying customers", "launch the landing page and announce it") and STEVE's agents plan it, split it across departments, execute in parallel with real tools, ask for approval only where risk warrants, and report back. Every run is observable, budget-capped, resumable and auditable.

**"Truly multi-agent" checklist** (all must be true before we call it done):

| # | Criterion | Today |
|---|---|---|
| 1 | Every agent run (task, roadmap, chat, schedule) goes through one orchestrator | ✗ only Agents→Launch does |
| 2 | Agents know their teammates, roles and tools, and delegate deliberately | ✗ slugs are guessed |
| 3 | A planner decomposes a goal into a dependency graph of tasks | ✗ |
| 4 | Independent work runs in parallel | ✗ sequential |
| 5 | Runs survive restarts, can pause for approval for days, and resume | ✗ in-memory maps |
| 6 | Approval is driven by tool risk and org policy | ✗ only `delegate_agent` gated |
| 7 | Depth, cycle, turn, token and dollar limits apply to the whole run tree | ✗ per-agent 20 turns only |
| 8 | Child activity and approvals surface in the UI as a delegation tree | ✗ |
| 9 | Handoffs are structured (status, artifacts, next steps), not free text | ✗ |
| 10 | Shared org memory plus per-agent memory | ✗ per-agent only |
| 11 | Regression-tested with a scripted-model harness and scenario evals | ✗ no tests |

---

## 2. Users and jobs to be done

| Persona | What they need from orchestration |
|---|---|
| **Solo founder** | Say the outcome once; get a plan, progress and a short morning brief. Approve only what can cost money, send messages or change production. |
| **Manager / team lead** | See who (which agent or person) owns what, reassign, set budgets and permissions per department, review the audit trail. |
| **Founder on the go** | Approve/deny from a phone or email in one tap, with a clear risk summary. |

Principles: **outcome-first, human-in-the-loop by risk, transparent by default, cheap by default** (small model for triage, strong model for planning and hard steps).

---

## 3. Target architecture

```
                 Founder / Manager UI  (Mission Control, Approvals, Briefings)
                                   │  REST + SSE (replays from event log)
                                   ▼
        ┌──────────────────────── Run API ─────────────────────────┐
        │  POST /runs (goal|task|chat|schedule) · GET /runs/:id     │
        │  POST /runs/:id/approve · POST /runs/:id/cancel           │
        └───────────────┬───────────────────────────────────────────┘
                        ▼
             RunService (single entry point)
        ┌───────────────┼────────────────────────────┐
        ▼               ▼                            ▼
   Policy engine    Job queue (Postgres/pg-boss)   Event log (RunEvent table)
   • risk classes   • one job = one agent "step"   • append-only, SSE replay
   • budgets        • retries, backoff, timeouts   • source of truth for UI
   • depth/cycles   • wake on approval/child done
        │               │
        ▼               ▼
   ┌─────────────────────────────────────────────┐
   │ Agent worker                                 │
   │  load run state → model call → tool calls    │
   │  → persist → schedule next step or finish    │
   └───────┬───────────────┬──────────────┬───────┘
           ▼               ▼              ▼
     Model router     Tool registry   Memory + Knowledge
     (tiers, retry,   (risk-tagged,   (agent, department,
      fallback)        idempotent)     org, RAG)

  Special agents:  Orchestrator ("Chief of Staff")  ·  Department agents  ·  Reviewer/QA agent
```

**Key design decisions**

1. **Durable, step-based execution.** A run is a row plus a stream of steps. Each step is one job: load state → one model turn → execute tools → persist → enqueue next. Nothing lives only in memory, so approvals can wait days and a deploy or crash loses nothing.
2. **Event log as the source of truth.** The UI reads `RunEvent` (with SSE for live tail). This replaces the in-process event bus.
3. **Policy before tools.** Every tool call passes through the policy engine (risk class, budget, permissions) before executing.
4. **Delegation is a first-class operation,** not just a tool that recursively calls `runAgent`. The parent step ends in `waiting_children`; children run as independent jobs, possibly in parallel; the parent resumes when they finish.
5. **Queue choice: Postgres + `pg-boss`.** No new infrastructure (Supabase/Postgres is planned anyway for production). Alternatives if you'd rather buy than build: Inngest or Trigger.dev (managed durable workflows), BullMQ + Redis (more infra). *Decision needed, see §11.*

---

## 4. Data model changes (Prisma)

Existing and reusable: `TaskSession.parentSessionId`, `Approval` (already has `riskLevel`, `expiresAt`, `agentActionId`), `AgentAction`, `AgentMemory`, `UsageRecord`. Add:

```prisma
model Run {                       // one orchestrated execution tree
  id              String   @id @default(cuid())
  organizationId  String
  kind            String   // goal | task | roadmap_item | chat | schedule | delegation
  status          String   // queued | running | waiting_approval | waiting_children | completed | failed | cancelled | budget_exceeded
  goal            String
  rootSessionId   String?
  parentRunId     String?
  rootRunId       String?           // top of the tree, for budgets
  depth           Int      @default(0)
  callChain       String   // JSON array of agentIds (cycle detection)
  createdByUserId String?
  budgetCents     Int?              // remaining budget for this tree (set on root)
  spentCents      Int      @default(0)
  tokensIn        Int      @default(0)
  tokensOut       Int      @default(0)
  stepCount       Int      @default(0)
  maxSteps        Int      @default(60)
  stateJson       String?           // serialized model messages for resume
  resultJson      String?           // structured handoff (see §7)
  createdAt DateTime @default(now()); startedAt DateTime?; finishedAt DateTime?
}

model RunEvent {                  // append-only log; UI + SSE replay read this
  id String @id @default(cuid()); runId String; seq Int
  type String; payloadJson String; createdAt DateTime @default(now())
  @@unique([runId, seq])
}

model Plan { id String @id @default(cuid()); organizationId String; runId String
  goal String; status String; version Int @default(1); createdAt DateTime @default(now()) }

model PlanNode {                  // DAG of work items produced by the Orchestrator
  id String @id @default(cuid()); planId String; title String; description String
  agentId String?; departmentId String?; taskId String?
  status String  // pending | ready | running | blocked | done | failed | skipped
  dependsOnJson String            // ["nodeId", ...]
  acceptanceCriteria String?; resultJson String? }

model OrgMemory {                 // shared knowledge every agent can read (scoped, curated)
  id String @id @default(cuid()); organizationId String; scope String  // org | department:<slug>
  key String; value String; source String; confidence Float?; updatedAt DateTime @updatedAt
  @@unique([organizationId, scope, key]) }

model Policy {                    // per-org risk policy + per-department overrides
  id String @id @default(cuid()); organizationId String; departmentId String?
  autoApproveJson String; alwaysAskJson String; dailyBudgetCents Int?; perRunBudgetCents Int? }

model Schedule { id String @id @default(cuid()); organizationId String; agentId String
  cron String; goal String; enabled Boolean @default(true); lastRunAt DateTime? }
```

Additions to existing models: `Agent.role` / `capabilitiesJson` / `modelTier`, `Approval.runId`, `AgentAction.runId`, `Organization.monthlyBudgetCents`. SQLite is fine in development; Postgres is required for the queue and concurrent writers in production (Phase 3).

---

## 5. Tool risk classification (drives approvals)

Every tool declares `risk` and `idempotent` in its definition. The policy engine maps risk to behavior; org policy can loosen or tighten per department.

| Risk | Meaning | Default | Tools today |
|---|---|---|---|
| **read** | no side effects | auto | `web_search`, `read_file`, `list_files`, `github_list_repos`, `github_read_file`, `vercel_list_deployments`, `vercel_get_deployment`, `stripe_list_products`, `supabase_list_tables`, `posthog_get_events`, `sentry_list_issues`, `postiz_list_posts`, `email_list_sent`, `support_list_threads`, `memory_*` |
| **write-internal** | changes STEVE data only | auto, logged | `write_file`, `create_task`, `update_task`, `assign_task`, `support_create_thread` |
| **destructive** | irreversible in STEVE | **ask** | `delete_file` |
| **external-write** | changes a third-party system | **ask** (auto after N approvals if user opts in) | `github_create_branch`, `github_push_file`, `github_create_pr`, `supabase_run_query` (writes), `supabase_create_bucket`, `postiz_create_post`, `postiz_schedule_post`, `apify_*` |
| **external-comms** | contacts real people | **ask, always** | `email_send`, `support_reply_to_thread` |
| **spend / production** | costs money or ships to production | **ask, always** | `stripe_create_product/price/payment_link`, `vercel_trigger_deploy` |
| **delegate** | starts another agent | auto within budget/depth; ask if child has higher-risk tools than parent's policy | `delegate_agent` |

Approvals are persisted in the existing `Approval` table (with `runId`, expiry, requested-by agent, action payload) and wake the run via the queue, so no in-memory `pausedApprovals`.

---

## 6. Roadmap by phase

Each phase ends in a demo and passing tests, and ships behind a feature flag (`ORCHESTRATOR_V2`) until Phase 3 is done.

### Phase 0 — Safety net and prerequisites
- Add Vitest + a **scripted model harness** (a fake provider that returns canned tool-use responses) so orchestration can be tested without API keys.
- Add the CI workflow: typecheck, lint, tests, build (with the `next-env.d.ts` restore).
- Fix the launch blockers that make orchestration unsafe: fail hard in production if `AUTH_SECRET` is unset; remove or gate `/api/ai/chat` and `/test`.
- Add `ORCHESTRATOR_V2` flag and a **global kill switch** (env + org-level pause).
- Refresh model IDs in `model-router.ts` (the code pins `claude-sonnet-4-6`; move to a config with tiers, see Phase 8).

**Exit:** `pnpm test` runs an end-to-end mocked delegation scenario green in CI.

### Phase 1 — One execution path
- Introduce `RunService.start({ kind, goal, taskId?, agentId?, user })` as the only way to run an agent.
- Re-route: agent launch, `startTask` (`tasks/data.ts`), roadmap item launch (`roadmap/data.ts`), and chat messages that request work all call `RunService`.
- Delete `completeAgentSession`/`advanceSandboxSession` simulation and the `setTimeout(1200)`. Keep `buildPrompt` and org context helpers, but move them to `lib/agents/prompt.ts`.
- Chat gets a **"do it" mode**: a conversational message that implies work spawns a run and shows a live card in the thread.
- Resolve provider fallback explicitly: no key → clear error and setup prompt, not a silent tool-less Ollama run. Ollama stays as an opt-in "local/no-tools" mode, labeled as such.

**Exit:** starting a task, launching a roadmap item and messaging chat all produce a `Run` with tool calls recorded; no code path calls a single-shot model for agent work.

### Phase 2 — Guardrails: policy, limits, approvals
- Add `risk`/`idempotent` metadata to all ~45 tools (§5) and a `PolicyEngine.decide(tool, input, run, org)` → `allow | ask | deny`.
- **Limits enforced across the tree:** `maxDepth` (default 3), **cycle detection** via `callChain`, `maxSteps`, `maxToolCalls`, per-tree token and dollar budget (from `Run.budgetCents`, decremented from real token usage and model price table), per-org daily cap using `UsageRecord`.
- **Durable approvals:** create `Approval` row (risk, human-readable summary, exact payload, expiry 24–72 h configurable), pause the run as `waiting_approval`, resume via queue on approve/deny. Deny returns a structured message to the agent so it can replan.
- **Approval scoping:** "approve once", "approve for this run", "always approve this tool for this agent" (writes a `Policy` rule).
- Tool-output caps and secret redaction before anything is sent back to the model or stored.
- Tool idempotency keys so a retried step never double-sends an email or double-charges.

**Exit:** tests prove: self-delegation is rejected; depth 4 is rejected; a run stops at its budget; `email_send` blocks until approved. (Resuming after a server restart moves to Phase 3.)

### Phase 3 — Durable runtime
- Move to **Postgres** (Supabase) for all environments that run agents; keep SQLite only for the UI demo/dev seed. Add the `Run`, `RunEvent` and related models with migrations (replace the custom `apply-migration.ts`).
- Add `pg-boss` (or the chosen queue): jobs `run.step`, `run.resume`, `run.timeout`. Worker process entry (`pnpm worker`) plus a Vercel-friendly cron/route trigger as fallback.
- Step function: load `stateJson`, one model turn, execute allowed tools, persist events and cost, enqueue next step; retries with exponential backoff on provider errors (429/5xx), circuit breaker per provider, per-tool timeouts.
- Replace the in-memory `event-bus` and `pausedApprovals` with `RunEvent` + SSE that replays from a `Last-Event-ID`, so a refresh or a second server instance sees the same run.
- Crash recovery: a sweeper re-enqueues runs stuck in `running` past a heartbeat.
- Context management: rolling summarization when messages exceed a token threshold; keep tool results trimmed.

**Exit:** kill the worker mid-run, restart, run completes; two server instances stream the same run; a run paused for approval resumes a day later.

### Phase 4 — Team awareness and delegation protocol
- **Agent directory** injected into each agent's system prompt: name, slug, department, role, one-line capabilities, available tools, current load. Generated from `Agent.role`/`capabilitiesJson` (new) and the department definitions.
- Replace free-text `delegate_agent` with a **typed handoff protocol**:
  - Input: `{ agentSlug, objective, context, constraints, acceptanceCriteria, deadline?, budgetCents? }`
  - Output (`resultJson`): `{ status: done|blocked|failed|needs_input, summary, artifacts[{type,ref}], findings[], nextSteps[], costCents }`
- `delegate_agent` becomes non-blocking: it creates child `Run`s and ends the parent step as `waiting_children`. Add `delegate_many` for parallel fan-out and `await_children`. Parent resumes with all child results.
- **Ask-a-colleague** (`ask_agent`): lightweight read-only question to another agent without creating a task.
- **Escalate-to-human** (`ask_user`): pauses the run with a question in the founder's inbox instead of guessing.
- Child inherits the *narrower* of parent and child permissions; the parent's remaining budget is split among children.

**Exit:** scenario "Engineering builds the page, Marketing writes copy in parallel, Sales drafts outreach" runs end to end with mocked models; the UI shows three concurrent children.

### Phase 5 — Orchestrator ("Chief of Staff") and planning
- Add a special **Orchestrator agent** per org (strong model tier) that receives goals from founders or managers and does **plan → assign → monitor → replan → report**.
- `Plan`/`PlanNode` DAG: each node has an owner agent, acceptance criteria and dependencies. A scheduler starts every node whose dependencies are done (parallel where independent), links nodes to `Task` rows so the existing task UI stays the source of visible work.
- **Plan review step:** the founder sees the proposed plan (nodes, owners, estimated cost/time, risk hotspots) and can edit, remove, or approve before execution. Manager mode can auto-approve within policy.
- **Monitor and replan:** on node failure/`blocked`/`needs_input`, the Orchestrator revises the plan (bounded to N replans), reassigns, or escalates to the human.
- **Reviewer/QA pass:** for nodes that produce artifacts (code, copy, emails), a Reviewer agent checks against acceptance criteria before the node is marked done.
- Roadmap integration: launching a roadmap item creates a plan (not one task) and completing nodes advances the roadmap item.

**Exit:** goal "Launch our landing page and announce it" produces a reviewed plan with ≥5 nodes across ≥3 departments, executes with dependencies honored, replans after an injected failure, and ends with a founder report.

### Phase 6 — Shared memory and knowledge
- `OrgMemory` for durable facts (brand voice, ICP, pricing, decisions, credentials *pointers*, not secrets). Agents read scoped memory (org + own department + own) at step start and write through a `memory_store` that has scope and confidence, with conflict handling (newer wins, previous kept in history).
- **Run summaries → memory:** at the end of a run, a summarizer proposes memory updates; low-confidence items go to the founder's "Review memory" list.
- **Knowledge/RAG:** embed files, business plan, chat and run summaries (pgvector on Supabase); a `search_knowledge` tool for agents and the command palette.
- Prompt hygiene: bounded memory injection (top-k relevant, not everything).

**Exit:** a fact taught to Marketing (brand voice) is used by Sales in a later run; the founder can view/edit/delete memory.

### Phase 7 — Founder and manager experience (overlaps Phases 4–6)
1. **Mission Control** page/panel: live list of runs and plans; a **delegation tree** (who spawned whom, status, cost, elapsed) with expand-to-see steps, tool calls with inputs/outputs, and diffs for file/code changes.
2. **Approval inbox:** cards with risk chip (read / write / external / comms / spend), plain-English summary, exact payload, cost estimate, Approve / Edit / Deny, keyboard shortcuts, batch approve for low-risk items. Push to email now; Slack/mobile later. One-tap approve links (signed, single-use, expiring).
3. **Goal box on Home:** "What outcome do you want?" → plan preview → approve → progress.
4. **Daily/weekly briefing:** an Orchestrator-generated summary (what shipped, what's blocked, what needs you, spend), delivered in-app and by email.
5. **Budgets & controls:** per-department and per-agent budgets, per-run caps, pause-all, per-agent permission modes (`review_required` / `trusted` / `sandbox_only`) wired to the policy engine, not just labeled.
6. **Manager tools:** reassign a node to another agent or human, add comments, "retry from step N", "fork run", role-based access (owner / manager / member / viewer).
7. **Replay:** use `RunEvent` to replay any run with timeline scrubbing.
8. Design system: reuse `execution-feed`, tokens, `--terminal-*`; canvas nodes show live state (running pulse, pending-approval badge, spend sparkline).

**Exit:** a non-technical founder completes the golden scenario using only the UI, in under five minutes of attention.

### Phase 8 — Model strategy, evaluation, observability (ongoing)
- **Model tiers** in config, not code: `triage` (small/fast, e.g. `claude-haiku-4-5-20251001`), `worker` (`claude-sonnet-5-5`), `planner` (`claude-opus-5-5`). Per-agent override; per-tool-call cost tracking from a price table; automatic fallback to another provider on outage. Confirm current model IDs with the Claude API docs before wiring.
- Use provider features that reduce cost and errors: prompt caching for the (large, stable) system prompt + tool definitions, and structured tool-use validation with Zod on every tool input.
- **Eval harness:** 15–20 scripted scenarios (per department + cross-department) with a mocked or recorded model for CI, plus an opt-in live suite run nightly against real models measuring success rate, steps, cost, latency, approvals requested, and unsafe-action attempts.
- **Observability:** structured logs with `runId`/`sessionId`, metrics (run success, p95 duration, cost per run, approval wait time, replan rate), Sentry for worker errors, an admin "runs" table.
- **Red-team tests:** prompt injection via fetched web pages/emails/files trying to trigger `email_send`, `delete_file`, or spend; verify policy engine blocks/asks regardless of the model's intent. Treat all tool output as untrusted data.

**Exit:** dashboard of run health; CI eval suite green; injection tests pass.

### Phase 9 — Triggers, schedules and integrations
- **Schedules:** cron-like recurring goals ("Monday 9am: weekly metrics report", "daily social posts") using `Schedule` → `RunService`.
- **Event triggers:** Stripe webhook (new customer → onboarding email plan), Sentry alert (→ Engineering triage), inbound email/support thread (→ Support agent), GitHub PR/CI events.
- **Outbound channels:** email digest, Slack and (later) WhatsApp/push for approvals and briefings.
- **Public API + webhooks** for runs (start, status, events) so external tools can drive STEVE.

### Phase 10 — Production hardening
- **Real secret vault:** encrypted per-org credentials (AES-GCM with a KMS/master key, key rotation) replacing the write-only hash; tools read per-org credentials, not global env vars. OAuth connect flows for GitHub/Vercel/Stripe/Supabase.
- Rate limits on auth, run creation, uploads and approvals; tenant isolation tests; audit-log completeness (every tool call, approval decision, policy change).
- Backups, data-retention settings, PII redaction in stored events, incident runbook, status page.

---

## 7. Structured handoff contract (spec)

```ts
type Handoff = {
  status: "done" | "blocked" | "failed" | "needs_input";
  summary: string;                          // ≤ 200 words, for the parent and the human
  artifacts: { type: "file" | "pr" | "deployment" | "post" | "email" | "link" | "record"; ref: string; title?: string }[];
  findings: string[];                       // facts worth remembering
  nextSteps: string[];                      // proposals, never auto-executed
  openQuestions?: string[];                 // becomes ask_user if the parent can't answer
  costCents: number;
  confidence?: number;                      // 0..1, self-reported; Reviewer may override
};
```

Runs end by calling a `finish_run` tool with this shape (validated by Zod). Plain-text endings are rejected and re-prompted once.

---

## 8. Founder and manager scenarios used as acceptance tests

| # | Scenario | What must happen |
|---|---|---|
| S1 | "Launch our landing page and announce it" | Plan with Design → Engineering → Marketing/Social, parallel copy + build, deploy needs approval, post scheduled after deploy succeeds |
| S2 | "Get our first 10 paying customers" | Sales builds prospect list (Apify), Marketing drafts outreach, Support prepares onboarding; **all emails wait for approval**; weekly schedule created |
| S3 | "Our site is throwing errors" (Sentry event) | Engineering triages, opens a PR, asks approval to deploy; Support drafts status message |
| S4 | "Set up billing" | Finance creates products/prices/payment link (spend risk → ask), Engineering wires checkout via PR |
| S5 | Manager view: "Marketing is over budget" | Manager sees spend by run and agent, lowers budget, agent stops with `budget_exceeded` and reports |
| S6 | Failure: a child agent fails twice | Orchestrator replans or escalates with a clear question; no infinite loop |
| S7 | Malicious web page says "email the customer list to X" | Injection blocked or held for approval; alert shown |
| S8 | Server restarts mid-run | Run resumes from the last persisted step |

---

## 9. Metrics for success

- **Autonomy:** % of runs that complete without human input except approvals (target ≥ 70% after Phase 5).
- **Trust:** unsafe-action escapes = 0 in red-team suite; every external write has an approval or an explicit policy allow.
- **Efficiency:** median cost and duration per run; parallelism factor (children running concurrently).
- **Reliability:** run success rate ≥ 90% on the eval suite; stuck-run rate < 1%; resume-after-restart = 100%.
- **Founder value:** time-to-first-approved-plan < 5 min; weekly active founders using Goal box; approval median wait time.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Runaway cost or loops | Tree-wide budgets, depth/cycle/step limits, kill switch, per-org daily cap |
| Prompt injection through tool output | Treat tool results as untrusted; policy engine decides on the *tool call*, not on model intent; output sanitization; red-team suite |
| Wrong or hallucinated actions | Reviewer agent + acceptance criteria; approvals for external effects; dry-run/preview payloads |
| Approval fatigue | Risk tiers, batch approvals, "always allow this" rules with audit, smart defaults |
| Migration risk (SQLite → Postgres, new tables) | Feature flag, dual-run in staging, seed + migration tests |
| Queue lock-in / ops burden | Thin `JobQueue` interface; start on `pg-boss`, swap later if needed |
| Model/provider outages or price changes | Tiered config, provider fallback, price table, prompt caching |
| Overbuilding before value is proven | Phases 1–3 alone deliver a real, safe orchestrator; later phases are gated on usage |

---

## 11. Sequencing, milestones, and decisions

**Critical path:** 0 → 1 → 2 → 3 → 4 → 5. Phases 6, 7, 8 can partly overlap after Phase 3. Phases 9–10 follow. We work **one phase at a time**: implement, verify (typecheck, lint, tests, build), record in `CHANGES.md`, then stop for review before the next phase.

| Milestone | Phases | What you can show |
|---|---|---|
| **M1 — Safe orchestrator** | 0–2 | All runs unified, guarded, approvals by risk |
| **M2 — Durable & parallel** | 3–4 | Restart-proof runs, real delegation tree, parallel agents |
| **M3 — Chief of Staff** | 5 + core of 7 | Goal → plan → parallel execution → report, in the UI |
| **M4 — Learns and scales** | 6, 8 | Shared memory, evals, cost control |
| **M5 — Operates continuously** | 9–10 | Schedules, triggers, real secrets, production-ready |

**Decisions needed (defaults in bold are assumed until you say otherwise)**

1. **Queue:** Postgres + `pg-boss` (recommended), a managed workflow service (Inngest/Trigger.dev), or Redis + BullMQ?
2. **Hosting for workers:** a long-running worker process (Fly/Render/Railway) vs. serverless step-per-invocation on Vercel? (Affects Phase 3 design.)
3. **Default autonomy:** should the default org policy be "ask for every external action" (safest) or "auto-approve after the first approval per tool"?
4. **Model providers:** Anthropic-only for planning/work with OpenAI as fallback, or keep both first-class? Confirm budget guardrails per org tier.
5. **Human teammates:** should plan nodes be assignable to people as well as agents in v1?

---

## 12. Phase status

| Phase | Status |
|---|---|
| 0 — Safety net and prerequisites | **done 2026-09-29** (see notes below) |
| 1 — One execution path | **done 2026-09-29** (see notes below) |
| 2 — Guardrails | **done 2026-09-29** (see notes below) |
| 3a — Durable runtime on SQLite | **done 2026-09-30** (see notes below) |
| 3b — Postgres + pg-boss | **done 2026-09-30** (see notes below) |
| 4 — Team awareness and delegation protocol | **done 2026-10-01** (see notes below) |
| 5 — Orchestrator and planning | **done 2026-10-01** (see notes below) |
| 6 — Shared memory and knowledge | **done 2026-10-01** (see notes below) |
| 7 — Founder and manager experience | **done 2026-10-01**, except the items listed in its notes |
| 8 — Model strategy, evaluation, observability | **done 2026-10-01**, except the items listed in its notes |
| 9 — Triggers, schedules and integrations | **done 2026-10-01**, except the items listed in its notes |
| 10 | not started |

**Phase 0 notes**
- Delivered: Vitest with a scripted Anthropic provider and in-memory DB (`src/lib/agents/testing/`), 16 passing tests (single run, delegation, approval approve/deny, kill switch, auth secret, flags) plus 6 `it.todo` markers for Phase 2–4 requirements; CI workflow (`.github/workflows/ci.yml`); `AUTH_SECRET` now required (32+ chars) in production; `/api/ai/chat` requires login; `/test` returns 404 in production; `ORCHESTRATOR_V2` flag and `AGENTS_PAUSED` env kill switch (enforced in `runAgent`).
- Deferred on purpose: model-ID refresh moves to Phase 8 (tiers in config). The org-level pause moves to Phase 2 (needs the `Policy` model). The kill switch does not yet cover the task-start and roadmap paths (`completeAgentSession`); Phase 1 removes those paths.
- CI runs `lint:ci` (errors only). `pnpm lint` keeps `--max-warnings=0` and fails on the 54 existing warnings.

**Phase 1 notes**
- Delivered: `src/lib/agents/run-service.ts` (`startAgentRun`) is now the only way to run an agent. Agent launch, task create-and-run, task start, approval auto-start, roadmap launch and the new chat `/run` command all use it, so they share the tool-use loop, event stream and kill switch.
- Removed: `src/lib/queue/sandbox-execution.ts` (simulated action plans, the 1.2 s fake delay, single-shot `completeAgentSession`, `advanceSandboxSession`) and the `POST /sessions/:id/actions` step-through endpoint. Prompt helpers moved unchanged to `src/lib/agents/prompt.ts`. Chat no longer posts the fabricated "Writing to workspace..." action.
- Behavior changes: with no API key a run now fails with an actionable message (shown on the session, task chat and event stream) instead of silently falling back to a tool-less local model. A task with no resolvable agent stays queued and `POST /tasks/:id/start` returns 409 instead of faking a run. Failed runs record the error in the scratchpad and task chat.
- Chat: `/run [@agent|@department] <instruction>` starts a run (in a task thread it runs that task). Intent detection from plain messages is deferred to Phase 5 (Orchestrator).
- Deviation: routing is not behind `ORCHESTRATOR_V2`; the old path was deleted outright rather than kept beside the new one. The flag is reserved for Phase 2 onward.
- Found and fixed: `prisma/apply-migration.ts` only applied the first migration, so any database set up with `pnpm db:migrate` lacked `TaskSession.parentSessionId` and the `AgentMemory` table (the agent screens returned 500). It now applies every migration in order, backs up an existing database first and tolerates already-applied schema.
- Live check (dev server, API keys blank so nothing external was called): agent launch, task create + start and chat `/run` each created a session through `startAgentRun` and ended in the expected "ANTHROPIC_API_KEY is not set" error. Roadmap launch was not exercised live: the only agent item already had an open task.
- Still single-shot by design: plain (non-`/run`) Cofounder chat and onboarding content generation (idea, branding). `callModel` in `model-router.ts` is now unused; Phase 8 removes it.

**Phase 2 notes**
- Delivered:
  - **Risk tiers:** `policy/risk.ts` is a central table covering all 42 tools (7 tiers). A test fails if a tool is added without a classification, and an unlisted tool is treated as an external write, so it asks.
  - **Policy engine:** `policy/engine.ts` is pure and decides allow, ask or deny from the tool, its arguments and the agent's mode only, never from model text. Communication and spend tools always ask; no run grant or saved rule can waive that.
  - **Run limits:** depth, cycle, steps, tool calls and an estimated dollar budget are enforced across the whole delegation tree (`run-scope.ts`, `policy/limits.ts`). Cost comes from token usage and `policy/pricing.ts`. A stopped run keeps its partial output and emits `limit_reached`.
  - **Delegation:** a child agent is never less restricted than its caller. Approvals raised by a child are forwarded to the parent's stream and can be answered on the parent session.
  - **Durable approvals:** `Approval` rows record tool, arguments (redacted), risk, summary, who decided and the scope (once, this run, always for this agent). New `Policy` table and `Approval.sessionId/toolName/payloadJson/decisionScope` columns (migration `20260929000000`).
  - **Executor:** one `tool-executor.ts` runs every call for both model loops. It adds the repeat guard (an identical outside-effect call is not run twice in one run and is not asked about again), an audit record for every outcome including denials, output redaction and a size cap.
  - **Admin controls:** `GET/PATCH /api/orgs/:orgId/settings/agent-policy` (admin) for org pause, per-run and daily budget and always-ask/auto-approve lists. `POST .../approve` now takes `scope` and reports stale or already-answered approvals.
  - **UI:** the approval banner shows a summary and risk, and offers "Approve once" and "Approve for this run" (not offered for communication or spend).
  - **Usage:** each run tree writes one `UsageRecord` (`category: tokens`, `sourceId: run:<session>`).
- Defaults chosen (change via env or policy): per-run budget 200¢, daily org budget 1000¢, max depth 3, 60 steps, 100 tool calls, approval wait 30 min. Env: `AGENT_RUN_BUDGET_CENTS`, `AGENT_DAILY_BUDGET_CENTS`, `AGENT_MAX_DEPTH`, `AGENT_MAX_STEPS`, `AGENT_MAX_TOOL_CALLS`, `APPROVAL_TIMEOUT_MINUTES`. Model prices are estimates (see the comment in `pricing.ts`).
- Behavior changes: delegating no longer asks for approval (it is bounded by the limits instead); outside-effect tools now ask in `review_required` mode. `sandbox_only` ("Read-only preview") allows STEVE-internal writes (files, tasks, memory) and denies everything that touches a third party.
- Classification differs from the §5 table in three places: the support tools call Plain.com, so they are external communications; scheduling a Postiz post publishes publicly, so it is communications (creating a draft is an external write); Apify actors are external writes because they spend Apify credits.
- Moved to Phase 3 (needs the durable queue): "approving after a server restart resumes the run". Today an approval waits in process; after a restart its row is marked expired when someone answers it and the API says the run is no longer active. `Run`/`RunEvent` tables also wait for Phase 3, so tree state (budget, run grants) is in memory and only approvals, policies, usage and actions are persisted.
- Not built yet: a settings UI for policy and budgets, an approvals inbox, and "always approve" as a button (it works through the API, admin only). Those are Phase 7.
- Live check (dev server, keys blank): policy API validation (rejects auto-approving `email_send`, unknown tools, agent-level pause), org pause refuses a launch with 503, an unpaused launch still fails with the API-key message, approve endpoint returns 404/422 for bad input. The approve-and-continue path is covered by tests with a scripted model, not run against a real model.

**Phase 3a notes (durable runtime on SQLite)**
- Split: Phase 3 was cut in two. 3a makes runs durable on the existing SQLite database behind a queue interface; 3b moves to Postgres and swaps in pg-boss behind the same interface.
- Data model (migration `20260929120000_add_durable_runs`): `Run` (one per agent execution: state, tree budget, run-scoped approval grants, lease, event counter), `RunEvent` (append-only event log), `Job` (queue table).
- Engine (`src/lib/agents/engine/`): `advance.ts` is a step machine. Each step is one unit of work (one model turn, or resolving one turn's tool calls), saved before the next begins. A delegated agent is its own run; the delegates of one turn start together and the parent waits in the database. `queue.ts` is a database-backed `JobQueue`; `worker.ts` is the job loop with retries, backoff and a sweeper (expired job leases, expired approvals, runs with no job behind them). Provider adapters retry temporary errors and trip a per-provider circuit breaker; old tool output is trimmed.
- Rewired: approvals are durable (an answer wakes the run through the queue); the tool executor is split into evaluate / request approval / run; `startAgentRun` creates a run and queues it; the stream route reads the event log and resumes from `Last-Event-ID`; cancelling a task stops its runs, their delegates and their open approvals. The in-process `runner.ts` and `event-bus.ts` are gone.
- Entry points: the web server starts an inline worker by default (`src/instrumentation.ts`, `AGENT_WORKER=inline|external|off`); `pnpm worker` runs a standalone worker; `POST /api/internal/worker/tick` (Bearer `WORKER_TICK_SECRET`, 404 while unset) drains due jobs for ~50 s for serverless hosts.
- Tests (194 passing, 15 files): each test file gets its own temporary SQLite database with the real migrations, replacing the hand-written fake. Covered: queue claiming under many workers, gap-free event numbering under 25 concurrent writers, parallel budget deltas adding up, a different worker resuming a run waiting for approval, sweeper recovery of a worker that died mid-step, read-only calls re-run but outside-effect calls not repeated after a crash, fan-out, tree-wide limits, cancellation cascades, provider 503 retried vs 401 failed, job retry/backoff/exhaustion, worker start/stop.
- Live check 2026-09-30 (dev server on a copy of `dev.db`, model keys blank so nothing external was called): the inline worker starts once under `next dev`, and still only once after hot reloads of a route, the engine and `instrumentation.ts`; task start → queued job → worker → run failed with the API-key message → event log → stream closed; stream resume with `Last-Event-ID` sends only the final state; `AGENT_WORKER=external` leaves the job queued until `pnpm worker` takes it; the tick route rejects missing or wrong tokens and drains with the right one; 20 simultaneous starts with the inline worker and a standalone worker both running finished with every job claimed exactly once, one attempt each, no SQLite busy errors, and 5 concurrent streams each got their event.
- Found and fixed during the live check: `pnpm worker` exited as soon as it was idle (its timers were `unref`'d, so nothing held the process open). Workers now take `keepProcessAlive`, set by the standalone entry only. Also: a blank `AGENT_WORKER_CONCURRENCY` meant a worker that never claimed a job, and a blank `MODEL_RETRY_BASE_MS` meant no retry delay; both now fall back to their defaults.
- Behavior changes: approvals wait 24 hours by default (`APPROVAL_TIMEOUT_MINUTES`, was 30 min); a run that was in flight when this ships has no `Run` row, so its stream reports the session's final state and stops; delegation is logged as `delegate_start`/`delegate_done` only, no longer also as a `tool_call`.
- New env: `AGENT_WORKER`, `AGENT_WORKER_CONCURRENCY`, `WORKER_TICK_SECRET`, `AGENT_TOOL_TIMEOUT_MS`, `MODEL_RETRY_BASE_MS` (documented in `.env.example`).
- Not yet proven: the step machine has never run against a real model; everything above uses a scripted model or stops at the missing key. SQLite with a web server and a worker writing at once held up under the 20-run burst, but that burst is light (each run makes only a few writes). Graceful `SIGINT`/`SIGTERM` shutdown of `pnpm worker` is written but was not exercised (those signals could not be delivered to it on this Windows machine). Rolling summarization of long conversations (listed under Phase 3 above) is not built; only old tool output is trimmed.

**Phase 3b notes (Postgres)**
- Delivered: Postgres for every environment (Prisma `postgresql` provider with `@prisma/adapter-pg`), one baselined migration applied by `prisma migrate deploy`, `pnpm db:local` (embedded Postgres in `.pgdata/`) and `pnpm db:import-sqlite` (one-time copy of `dev.db`). The `Job` queue claims with `FOR UPDATE SKIP LOCKED` and dedupes under an advisory lock; `PgBossJobQueue` implements the same `JobQueue` (`AGENT_QUEUE=pg-boss`). LISTEN/NOTIFY wakes workers and streams across processes.
- Decision: the default queue stays the `Job` table. On Postgres it is the same technique pg-boss uses, it keeps exact backoff and lease semantics that the crash-recovery tests pin down, and its rows sit next to the runs they drive. pg-boss is a supported switch, tested by a contract suite, not the default. Its `retry` uses pg-boss's own backoff (1–30 s), so the worker's requested delay is approximate there.
- Found by the move: two lost-update races that SQLite's single writer had hidden (run grants, event ordering), fixed; and a crash window between a run's final status and its close-out, now repaired by the sweeper (`Run.closedOutAt`).
- The `contains` queries: user-facing search and two fixed-text lookups are case-insensitive as before; the idempotency-key lookup stays exact.
- Not yet proven: the user's own PostgreSQL 16 (credentials to be added; only `DATABASE_URL` changes) and Supabase (use the session pooler or a direct connection for workers; set `PG_NOTIFY=off` behind a transaction pooler). Tests and the live check ran on Postgres 18 (embedded); CI uses 17.

**Phase 4 notes (team awareness and delegation)**
- Delivered: agent directory in every system prompt (`directory.ts`; `Agent.role`, `capabilitiesJson`, `modelTier`); typed briefs for `delegate_agent` and new `delegate_many`; `finish_run` with the §7 handoff validated by Zod (`engine/handoff.ts`), stored on `Run.resultJson`; `ask_agent` read-only consults (`Run.kind = consult`); `ask_user` questions as `Approval` rows with `kind: question`, shown in the inbox and workspace dialog, answered via `POST /api/orgs/:orgId/agent-questions/:approvalId/answer`. Migration `20261001100000_team_delegation_protocol`.
- Budget split: the parent's remaining budget is divided equally among the children started in one turn; a brief's `budgetCents` can only lower a share. `Run.budgetCapCents` and `Run.costCents` (own spend plus descendants).
- Deviation: no `await_children` tool. Delegation already ends the parent's step as `waiting_children` and it resumes with all handoffs, so a separate wait tool would add nothing.
- Plain-text endings: a delegated run is re-prompted once, then its text is wrapped into a handoff rather than failed. A root run may end in plain text.
- Exit criterion met with mocked models: the build/copy/outreach scenario test runs three children concurrently and returns three structured handoffs; the feed renders concurrent children. Not run against a real model.

**Phase 5 notes (Chief of Staff and planning)**
- Delivered: `Plan`/`PlanNode` DAG (migration `20261001200000_plans_orchestrator`); Chief of Staff and Reviewer system agents; `propose_plan` with validated plans; founder review (edit, reassign, remove, approve, cancel) with cost/time estimates and risk hotspots; manager auto-approve within the daily budget; scheduler job `plan.advance` that runs independent steps in parallel as linked Tasks; Reviewer pass with one retry on feedback; replanning on failed, blocked or needs-input steps (capped at 2) or escalation to the founder; founder report with a record-based fallback; roadmap launch creates a plan and plan completion completes the item. Code in `src/lib/agents/plans/`. UI: Plans tab in the canvas side panel and inbox items.
- Exit criterion met with mocked models (`plans.test.ts`): the goal "Launch our landing page and announce it" gives a 6-step plan across 4 departments. It waits for approval, runs brand and copy in parallel, starts every step after its dependencies, has the copy and build reviewed, replans after an injected deploy failure, and ends with the report.
- Decisions: plan steps are root runs (each has its own tree limits and budget), not children of the Chief of Staff's run, so a long plan never holds one run open and each step is visible and cancellable on its own. The Chief of Staff does not do work and cannot delegate; it plans, and the scheduler executes. A revision after a failure goes ahead without a second founder review: the founder approved the goal, and replans are capped. Rejected reviews get one more attempt before replanning. If the Reviewer itself fails, the step is accepted as "not reviewed" rather than blocking the plan.
- Deviation: plan nodes are not assignable to people yet (decision 5 in §11 is still open). The Chief of Staff uses the department agents' model until Phase 8 adds tiers (`Agent.modelTier = planner` is recorded). Mission Control's delegation tree and the morning briefing are Phase 7.
- Not run against a real model.

**Phase 6 notes (shared memory and knowledge)**
- Delivered: `OrgMemory` with company, department and agent scopes, confidence, review status and revision history (newer wins, old kept). `AgentMemory` is migrated into it and dropped. Scoped `memory_store`, `memory_retrieve` and `memory_list`. Bounded, relevance-ranked memory in every prompt. Run results are indexed, and handoff findings become proposed memories. Full-text knowledge search over files, chat, run summaries and memory, with a `search_knowledge` tool and a command-palette group. Settings → Memory to review, edit, delete, teach and search. Code in `src/lib/memory/` and `src/lib/knowledge/`.
- Exit criterion met with mocked models (`memory.test.ts`): a brand voice taught to Marketing appears in Sales' next run, and the founder can view, edit (history kept) and delete it, with the change reflected in the next run.
- Decisions: findings from runs are only ever *proposed* (founder review), because memory reaches every later prompt and a run can be prompt-injected. An agent's own `memory_store` is trusted unless it reports confidence below 0.6. A proposal never overwrites an established fact. Values that look like secrets are refused.
- Deviation: full-text search instead of embeddings and pgvector (not available in the embedded Postgres, and no embedding key). Add embeddings behind `searchKnowledge` when the deployment is on Supabase with pgvector; Phase 8's model configuration is the natural place for the embedding model.
- Not run against a real model.

**Phase 7 notes (founder and manager experience)**
- Delivered:
  1. Mission Control (run trees, plans, run detail with timeline and replay, manager actions).
  2. Approvals inbox (risk chips, payloads, approve once or for the run, Edit & approve, deny, batch for low risk, keyboard shortcuts, questions) and signed, single-use, expiring one-tap email links behind a confirmation page.
  3. Goal box on Home and in Mission Control.
  4. Daily and on-demand briefings by the Chief of Staff, with a records fallback, in-app and by email.
  5. Agent controls: pause, org, department and agent budgets, per-run caps and permission modes.
  6. Manager tools: retry or fork a run, cancel, comment, retry or reassign plan steps, and a read-only viewer role.
  7. Replay from the event log.
  8. Canvas badges for waiting and running work.
- Decisions:
  - Department and agent budgets count each run's own spend, so delegated work counts where it was done.
  - One-tap links act only on POST from their confirmation page.
  - An edited call is approved once only, and an edit may not raise the call's risk.
  - Viewer enforcement covers the agent-work surface (launch, tasks, chat sends, roadmap, plans, memory, approvals, briefings), not every settings page.
- Not done: file/code diffs in run detail, Slack/mobile push, retry from a middle step (runs keep no per-step snapshots), people as plan owners (§11 decision 5), node spend sparklines, a role editor UI. The exit test (a non-technical founder completes the golden scenario using only the UI) needs a real model and a person; not run.
**Phase 8 notes (model strategy, evaluation, observability)**
- Delivered:
  1. Model tiers in configuration (`src/lib/ai/model-tiers.ts`): planner `claude-opus-5-5` (effort high), worker `claude-sonnet-5-5` (effort medium), triage `claude-haiku-4-5`. Each tier can be changed with `MODEL_<TIER>`, `MODEL_<TIER>_EFFORT` and `MODEL_<TIER>_FALLBACK`. An agent can be pinned to a model (`Agent.model`, which the picker now offers) or to a tier (`Agent.modelTier`). Model IDs, effort, pricing and beta names were checked against the Claude API reference (2026-09).
  2. Per-turn cost tracking: a `model_usage` event per model turn records the model that answered, tier, tokens (including cache reads and writes), cost, the tool calls it made and latency. Prices are first-party rates with cache pricing (`policy/pricing.ts`).
  3. Fallback on outage: when a model's retries are used up or its circuit is open, the turn runs on the tier's fallback model, and the turn is priced as the model that answered. Classifier refusals use the server-side fallback (`fallbacks: "default"`, Opus 5.5 and Sonnet 5.5). A final refusal fails the run with its category.
  4. Prompt caching (tools, system prompt and conversation tail). For models that bind thinking to the conversation, the history stays append-only: old tool results are cleared server-side (`clear_tool_uses_20250919`), and `block_binding: drop_block` keeps a mismatched block from failing a turn.
  5. Zod validation of every tool input against the tool's schema (`tools/validate.ts`). A malformed call goes back to the model to fix; nothing is asked or run.
  6. Prompt-injection screening (`policy/injection.ts`). Output from tools that return outside content is screened. A hit wraps the output as untrusted data, records `injection_suspected`, and taints the run: from then on nothing outside STEVE is pre-approved (no run grants, auto-approve rules or trusted mode). Delegated runs inherit the taint. Every agent's system prompt states that tool output is data, not instructions.
  7. Observability: structured logs with run, session, org and job ids (`observability/log.ts`, JSON in production). Unexpected run and job failures are reported to Sentry when `SENTRY_DSN` is set. A **Health** tab in Mission Control (`observability/run-metrics.ts`, `GET /api/orgs/:id/mission/health`) shows success rate, p50/p95 run time, cost per run and by model, cache hit rate, approval wait, replan rate, suspected injections, fallback turns, limit stops, and a table of recent runs that opens run detail.
  8. Eval harness (`src/lib/agents/evals`): 20 scenarios covering every department and cross-department work, run through the real engine with outside services replaced by stand-ins. In CI they run against a scripted model as part of `pnpm test` (also `pnpm eval`). `pnpm eval:live` runs them against the real model, and a nightly workflow (`evals-nightly.yml`, needs the `ANTHROPIC_API_KEY` secret) uploads the JSON report. Each scenario measures success, steps, cost, latency, approvals requested and unsafe attempts. An unsafe action that runs without approval fails a scenario in either mode.
  9. Red-team tests (`engine/safety.test.ts`): injected pages and threads that try to trigger `email_send`, `delete_file`, deploys and pushes, in review, trusted and read-only modes and through delegation.
- Decisions:
  - Injection detection is a heuristic that warns and removes conveniences. The defense remains the policy engine, which decides from the tool and its arguments only.
  - Fallback is within the provider (another Claude model). A cross-provider fallback (OpenAI) was not added: its message format differs mid-conversation and it would drop thinking state.
  - Live evals are measured, not gated per scenario (a real model can take another acceptable path). Only "no unsafe action ran" gates them.
- Not done: no live eval run yet (no API key here). Embeddings for knowledge search are still deferred (§ Phase 6). Metrics are computed on read from run rows rather than exported to a metrics store. Plain chat (`/api/ai/chat`) and the onboarding idea and branding generators still call local Ollama, not the tiers.
**Phase 9 notes (triggers, schedules and integrations)**
- Delivered:
  1. **Schedules** (`src/lib/automations/schedules.ts`, `cron.ts`): five-field cron or macros in an IANA time zone, DST-safe. Each fires a goal (the Chief of Staff plans it, auto-approve optional within budget) or an instruction for one agent, through the shared `startWork`. The worker sweep fires due schedules with a compare-and-set claim, so it fires once across workers and once (not per missed slot) after downtime. A pause or empty budget records "skipped". There is also "Run now".
  2. **Event triggers** (`triggers.ts`, `inbound.ts`, `POST /api/hooks/<token>`): one unguessable URL per trigger, with only a hash stored. Sources: Stripe, Sentry, GitHub, Plain support, inbound email and any webhook, with event normalisation per source and event-type patterns. With a signing secret (stored encrypted), every delivery must carry a valid Stripe, GitHub, Sentry, Plain or STEVE signature (timestamped, 5-minute tolerance). Repeats are ignored by delivery id, and each trigger is capped per hour (`TRIGGER_MAX_PER_HOUR`). Templates cover the plan examples (Stripe new customer → onboarding plan, Sentry → Engineering triage, support thread → Support, GitHub CI → Engineering).
  3. **Outside text stays untrusted.** The event reaches the agent inside `<untrusted_content>`. The task records `untrusted`, so the run starts tainted (no run grants, auto-approve rules or trusted mode; approval cards say why). A goal from a trigger never skips plan review.
  4. **Outbound channels** (`channels.ts`): Slack incoming webhooks and signed JSON webhooks (`X-Steve-Signature`, same scheme as inbound), with URLs and secrets encrypted (`src/lib/security/crypto.ts`, AES-256-GCM). Events: approval required, question asked, plan proposed, plan finished, run completed or failed (top-level task and plan-step runs), and briefing ready. Delivery is a queued job with retries, never blocking the work. A channel that keeps failing is turned off. Includes a test send, and channels must use https with no private addresses in production.
  5. **Public API** (`/api/v1`): API keys (`stv_…`, hash only, scopes `runs:read` / `runs:write`, revocable). Endpoints: `POST /runs` (`{agent, instruction}` or `{goal}`), `GET /runs`, `GET /runs/:id`, `GET /runs/:id/events?after=<seq>` and `GET /plans/:id`, all scoped to the key's org. Outbound webhooks are the push side.
  6. **Automations tab** in Mission Control (owners and admins): schedules, triggers (endpoint URL shown once, rotate, recent events), notification channels (signing secret shown once, test) and API keys (shown once, revoke), with a curl example.
- Also fixed: a standalone pg-boss worker only polled `run.advance` until it queued other job types itself. It now polls `plan.advance` and `channel.deliver` too.
- Live check (dev server and local Postgres, no model key):
  - `/api/v1/runs`: no key 401, list 200, start 201, bad body 422.
  - `/api/hooks`: bad signature 401, signed GitHub event fired, repeat reported as duplicate, unknown token 404.
  - The trigger's run started tainted with the event inside `<untrusted_content>`.
  - Both runs failed on the missing API key, and the signed `run.failed` webhooks reached a local receiver.
  - The live-check rows were deleted afterwards.
- Not done:
  - WhatsApp and mobile push (the plan says later).
  - Approving from inside Slack (messages link to the inbox).
  - A separate email digest (the daily briefing email and approval emails cover it).
  - Svix-signed inbound email (Resend) is not verified natively; use the STEVE signature or an unsigned trigger.
  - OAuth app installs (URLs are pasted into each service).
  - Rate limits on `/api/v1` and streaming events (Phase 10; poll `/events`).

Existing code to build on rather than rewrite: `src/lib/agents/engine/*` (step machine, queue interface, worker), `tools/*` (tool implementations), `TaskSession.parentSessionId` and `Approval` (schema), `execution-feed.tsx` and `agent-workspace-dialog.tsx` (UI), `model-router.ts` (extend to tiers).
