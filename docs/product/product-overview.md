# STEVE — Product Report

**Date:** 2026-09-29 · **Branch:** main · **Basis:** direct inspection of the repo (routes, Prisma schema, agent tools, package.json, docs). Typecheck, lint (0 errors) and build pass. No automated tests exist and no live run with real provider keys is recorded, so runtime claims below are "code exists", not "verified in production".

---

## 1. Purpose

STEVE is a clone of Cofounder.co: an **AI company operating system**. A founder signs in, describes an idea, answers five AI-generated questions, and STEVE generates a business plan, brand kit and a workspace of **8 departments**. Each department has AI agents that plan and execute real work (code, deploys, payments, social posts, email, support, research) under a permission/approval model. The founder sees the company as an interactive orbit **canvas** with a side panel for chat, tasks, roadmap and files.

**Target user:** a solo founder or very small team who wants to run a company through delegated AI agents rather than hiring.

**Value proposition:** idea → structured company → agents doing supervised work, in one place.

**Stack:** Next.js 16 (App Router, React 19), TypeScript 6, Tailwind 4, Radix UI, React Flow (`@xyflow/react`), framer-motion, Prisma 7 on SQLite (better-sqlite3), Zod, Anthropic + OpenAI SDKs, Ollama (local fallback). Auth is GitHub OAuth plus a sandbox login, using an HMAC-signed session cookie.

---

## 2. Feature inventory (what exists today)

### 2.1 Public / marketing
- Home with hero, pixel-art scene, video sections, chapters, value props, roadmap preview, tool carousel, industry wordsearch
- Pricing (3 tiers, slider cost calculator, comparison, FAQ) · Resources + launch article · How-to chapters (start/build/sell/scale) · Docs · Privacy · Terms · `/questions` intake
- Session-aware CTA ("Go to workspace" when signed in)

### 2.2 Auth & onboarding
- GitHub OAuth; sandbox login guarded off in production when OAuth is configured
- Personal onboarding (resumable) → Company onboarding: describe idea → 5 AI questions (answer or "decide all") → business plan → activate departments
- Design onboarding: vibe picker, reference uploads, brand-kit generation, approve/skip

### 2.3 Workspace
- **Canvas:** center node plus 8 orbiting department nodes, animated edges for active work, persisted viewport and selection
- **Side panel (5 tabs):** Home, Cofounder chat, Company, Tasks (list/board/calendar), Library
- **Departments:** board dialog, cover art with animated pixel particles, context tabs, roadmap strip
- **Roadmap:** 8-stage tech tree (Idea → Mature) with items, dependencies, complete and launch actions
- **Tasks:** create, start, cancel, comments, subtasks, attachments, approvals
- **Files/Library:** folders, upload, versions, archive, preview
- **Chat:** threads, SSE token streaming, attachments
- **Inbox/notifications** derived from audit log; **command palette** (Ctrl/⌘K) with global search
- **Settings:** preferences, AI model, env files, notifications, organization, inbox domains + agent addresses, support, Stripe, billing, advanced (Supabase import, repo switch)
- **Integrations center** + Postiz page; **Skills**, **Domains**, **Database**, **Referrals**, **Billing** pages

### 2.4 Multi-agent runtime (8 phases, all built)
- **Model router:** Claude / OpenAI / Ollama
- **Agent runner:** tool-use loop (max 20 turns)
- **SSE stream** of agent events; **approval gate** (`review_required` / `sandbox_only` / `trusted`) that pauses runs
- **Orchestration:** `delegate_agent` lets agents spawn child agents; **persistent memory** (`AgentMemory`)
- **Real-time UI** for the live execution feed
- **~45 tools:**

| Area | Tools |
|---|---|
| Code & deploy | `github_*` (5), `vercel_*` (3) |
| Payments | `stripe_*` (4) |
| Data | `supabase_*` (3) |
| Growth | `postiz_*` (3), `apify_*` (2), `web_search` |
| Comms | `email_*` (2), `support_*` (3) |
| Observability | `posthog_get_events`, `sentry_list_issues` |
| Work mgmt | `create_task`, `update_task`, `assign_task`, `delegate_agent` |
| Files & memory | `read/write/list/delete_file`, `memory_*` (3) |

### 2.5 Backend
- 94 API routes, 31 Prisma models (User, Organization, Membership, Department, Agent, Task, TaskSession, AgentAction, AgentMemory, Approval, ChatThread/Message, File/Folder/FileVersion, Roadmap*, Integration*, Secret, BillingAccount, UsageRecord, AuditLog, …)
- Auth enforced in the data layer (`requireOrgMember` / `requireOrgAdmin`), not in each route file

### 2.6 Design system
- 319 dark tokens + light-mode tokens, 21 UI primitives, 36 animation keyframes, z-index scale. UI overhaul 17/17 slices complete.

---

## 3. Fixes needed

Ordered by severity. Every item was seen in the code or repo, not assumed.

### P0 — Security / repo health
1. **Hard-coded session-secret fallback.** `src/lib/auth/session.ts:195` falls back to `"cofounder-local-dev-session-secret"` when `AUTH_SECRET` is unset, so anyone can forge session cookies on a misconfigured deploy. Fail hard at startup in production.
2. **Unauthenticated AI endpoint.** `POST /api/ai/chat` has no session check and no rate limit, and `/test` (a public page) is wired to it. Anyone who can reach the server can burn model compute. Remove `/test` from production, or gate both behind auth.
3. **Repo is enormous.** `.git` is about 34 GB: 10.7 GB pack plus about 12 GB of garbage `tmp_pack_*`. `public/` holds about 100 MB of tracked video and a **2.9 GB untracked `.mkv`** in the working tree. Run `git gc --prune=now`, delete the leftover temp packs, move videos to a CDN or object storage, and add `public/*.mp4` to LFS or `.gitignore`. Vercel deploys will choke on this.
4. **Secrets are write-only hashes.** `Secret.valueCiphertext` stores `redacted:sha256:…` (`settings/*.ts:903`). Nothing real is stored, so agent tools cannot use user-supplied keys per org and can only read global env vars. Real provider mode needs actual encryption at rest (AES-GCM with a KMS or env master key).
5. **SQLite in production.** Fine for local development, but there is no concurrent-writer story for serverless (Vercel). Move to Postgres (Supabase is already an integration) before deploying.

### P1 — Correctness / reliability
6. **No automated tests, no CI.** There is no `*.test.*`, no Playwright/Vitest config and no `.github`. `pnpm verify` is typecheck plus lint only. Add unit tests for the runner, approval gate and session signing, and Playwright smoke tests for login → onboarding → canvas → task run.
7. **Agent runtime never run live.** No recorded end-to-end run with real keys. Do a smoke test per department, then record the results.
8. **Sandbox simulation still present.** `src/lib/queue/sandbox-execution.ts` still contains an artificial `setTimeout(1200)`, and tasks/roadmap still call `startAgentSession` from it. Confirm which code paths are real runs and which are still simulated, and remove the simulation.
9. ~~**Stale docs contradicting the code.**~~ Done 2026-10-02: old status and gap reports removed.
10. **Build rewrites `next-env.d.ts`**, which breaks typecheck. Add `next-env.d.ts` handling to the build script or CI (`git checkout`), or gitignore it.
11. ~~**Leftover public files.**~~ Done 2026-10-02: renamed to `login-bg.mp4`, removed the duplicate business plan.
12. **Rate limiting** is absent everywhere (no matches for `rateLimit`). Add it to auth, AI, upload and agent-launch routes.
13. **Cost and abuse controls for agents:** per-org token budget, per-run tool-call cap beyond the 20-turn loop, and a kill switch. `UsageRecord` exists, so enforce it before a run starts.

### P2 — Quality / polish
14. **Accessibility is thin.** There are about 47 `aria-label`s across the whole app and one `prefers-reduced-motion` reference, despite 36 keyframes plus video backgrounds. Add reduced-motion guards, focus-visible audits, keyboard navigation for the canvas nodes, and an axe pass.
15. **Lint has 54 warnings** (some unused `eslint-disable` directives). `pnpm lint` runs with `--max-warnings=0` and currently fails on warnings, so either clear them or relax the flag.
16. **Placeholder / proprietary fonts** (Departure Mono, ppmondwest) fall back to IBM Plex Mono and system serif. Buy licences or pick open alternatives.
17. **Legal copy is unreviewed** (privacy and terms).
18. **Heavy media on the marketing site** (four videos of 6–18 MB each). Compress to WebM/H.264 at ≤2 MB, add poster frames, and lazy-load below the fold.
19. **`db:migrate` runs a custom script** (`tsx prisma/apply-migration.ts`) instead of `prisma migrate`. Document it, or move to standard migrations when switching to Postgres.
20. **Departments marked "coming soon"** (Support, Ops, Finance, Legal per the source notes): the agent tools for Support exist, so make the UI state match reality.

---

## 4. Top 20 features to add

Ranked by impact for a founder actually running a company through agents. Effort: S ≤ 3 days, M ≈ 1–2 weeks, L ≥ 3 weeks.

| # | Feature | Why it matters | Effort |
|---|---|---|---|
| 1 | **Real per-org encrypted secret vault + OAuth connections** (GitHub, Vercel, Stripe, Supabase) | Unblocks every real tool; today agents can't use customer keys | M |
| 2 | **Agent run replay & audit trail UI** (timeline of every tool call, input/output, cost) | Trust and debuggability for autonomous actions | M |
| 3 | **Budgets & spend guardrails** (per agent/dept/org, hard stop, alerts) | Prevents runaway model and API cost; prerequisite to billing | M |
| 4 | **Stripe billing with real subscriptions & usage metering** | Turns the product into a business; `UsageRecord` is ready | M |
| 5 | **Team collaboration**: invites, roles, per-department permissions, presence | Moves beyond solo founders | M |
| 6 | **Approval inbox with mobile/email/Slack notifications** | Approval gate is only useful if humans respond quickly | S |
| 7 | **Agent marketplace / skill library** with installable, versioned skills | Replaces the deterministic placeholder skills | L |
| 8 | **Scheduled & recurring agent runs** (cron: weekly report, daily social posts) | Agents become ongoing operators, not one-shot | M |
| 9 | **KPI dashboard** (revenue from Stripe, traffic from PostHog, errors from Sentry, tasks shipped) | Gives the founder a single "how is my company doing" view | M |
| 10 | **Live deploy preview & one-click launch** (GitHub → Vercel with preview URL on the roadmap item) | Closes the loop from "Build" to "Launch" | M |
| 11 | **Human-in-the-loop editing of agent plans** (edit steps before approving) | Better control than approve/reject | S |
| 12 | **Multi-model routing per task** (cheap model for triage, strong for code) with cost/quality display | Cuts cost, uses the router that already exists | S |
| 13 | **Document editor & AI co-writing** for business plan, PRDs, legal drafts | Business plan is currently a static file | M |
| 14 | **CRM / lead pipeline** fed by Apify prospecting and email tools | Makes the Sales/GTM department tangible | M |
| 15 | **Social content calendar** (Postiz) with drafts, approvals and analytics | Marketing department deliverable | M |
| 16 | **Inbound email & support desk** (per-agent inboxes exist) with threading and AI replies | Completes the Support department | M |
| 17 | **Workspace-wide semantic search / RAG** over files, chat, memory | Current search is lexical; agents need shared context | M |
| 18 | **Export/import & templates** (company templates: SaaS, agency, e-commerce) | Faster onboarding, viral sharing | S |
| 19 | **Public API + webhooks + CLI** | Lets outside tools trigger and observe agents | M |
| 20 | **Observability for the platform itself** (Sentry, structured logs, agent-run metrics, status page) | Necessary before real customers | S |

**Suggested order:** 1 → 3 → 2 → 6 → 4 → 8 → 5 → rest. Secrets, budgets and audit make autonomy safe to demo, and billing plus scheduling make it sellable.

---

## 5. Best frontend design directions

The current visual language (dark canvas `#1e1e23`, side panel `#29292e`, pixel-art accents, cream marketing) is coherent. The improvements below build on it rather than replace it.

1. **Make the canvas the live control room.** Show agent state directly on nodes: pulsing ring while running, badge with pending-approval count, mini spark-line of tasks completed. Hovering a department shows a floating summary card. (Tokens and `canvasDashFlow` already exist.)
2. **Agent activity as a streaming "terminal + narrative" pane.** Split each run into (a) a human-readable step list and (b) collapsible raw tool I/O, with diff views for file and code changes. Use the existing `--terminal-*` tokens.
3. **Approval cards designed for fast decisions.** Big Approve/Edit/Reject actions, risk chip (read / write / spend / external), estimated cost, and keyboard shortcuts (`A`/`R`). Surface them in a persistent inbox badge, not buried in a panel.
4. **Progressive disclosure on the side panel.** Keep Home minimal (greeting, next best action, one roadmap card) and push detail into full-screen "focus mode" dialogs for tasks and files, so the 390–430 px panel stops being crowded.
5. **Roadmap as a visual tech-tree with unlock animations.** Node states (locked/available/in-progress/done) with dependency lines that animate when a prerequisite completes; reuse the pixel-drift particles for celebration.
6. **Command palette as the primary navigation.** Add actions ("Run agent…", "Create task…", "Approve next") and recent items, not just search. Show shortcut hints throughout.
7. **Empty, loading and error states with personality.** The primitives exist (`empty-state`, `skeleton`, `error-state`). Apply them everywhere, with pixel-art illustrations and a clear next action.
8. **Dashboard-style "Company Pulse" home.** KPI tiles, sparklines, and an "Agents today" activity strip. Use one consistent chart style (single sequential palette, direct labels, light/dark aware).
9. **Motion system with restraint.** Centralise durations and easings as tokens, honour `prefers-reduced-motion`, and replace looping background videos with compressed poster-first media on marketing.
10. **Responsive and touch pass.** The app shell is desktop-first. Add a bottom-sheet variant of the side panel and a list-mode fallback for the canvas below ~768 px.
11. **Accessible-by-default components.** Visible focus rings (`--focused`), 4.5:1 contrast audit on `--foreground-50` text, screen-reader labels on canvas nodes, and roving-tabindex keyboard navigation.
12. **Onboarding that shows value earlier.** Stream the business-plan and departments appearing on a live preview canvas while questions are answered, rather than a loading screen.
13. **Marketing performance polish.** Compress hero/section video to ≤2 MB WebM, add posters, lazy-load, and use `next/image` for the JPEGs. Add a short product demo GIF/loop of the real canvas instead of only stylised art.
14. **Theming control.** The light/dark preference exists; add a system option and make sure marketing stays light by design (already enforced in middleware).

---

## 6. Recommended roadmap

| Horizon | Focus |
|---|---|
| **Now (1–2 wks)** | P0 fixes 1–5, CI + smoke tests, live-run each department, media cleanup |
| **Next (3–6 wks)** | Secret vault + OAuth, budgets, audit/replay UI, approval notifications, Postgres |
| **Later (2–3 mo)** | Billing, scheduling, KPI dashboard, team roles, marketplace |

---

## 7. Method and limits

Evidence: file listing of `src/app` (25 pages, 94 API routes), `prisma/schema.prisma` (31 models), `src/lib/agents/tools/*` (tool names), `package.json`, middleware, auth/session code, git object sizes, and the project docs. I did not run the app with real keys, execute agents, or load pages in a browser, so behavioural claims (for example "runs pause at approval") reflect what the code and docs say. Effort estimates and the feature ranking are judgment calls.
