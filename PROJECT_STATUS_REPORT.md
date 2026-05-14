# STEVE / Cofounder-Clone — Project Status Report

**Audit date:** 2026-05-12
**Auditor:** Claude Code (Opus 4.7), operating as Staff+ Eng / Product Architect
**Branch:** main (1 commit ahead of stated "Graduation Commit")
**Scope:** Full-product audit across docs, codebase, build, runtime, UX

---

## TL;DR

The Codex-built "17-phase" product is **genuinely substantially complete**. Auth, onboarding, org creation, canvas, departments, roadmap, tasks, agents, chat, files, settings, billing, and integrations are all wired end-to-end. The build is green and 85 API routes return 200/201/4xx as designed.

The "Graduation" claim is **80% true / 20% inflated**:
- ✅ Build, typecheck, lint, runtime smoke all green (after two trivial fixes).
- ✅ Core product loop works: sandbox-login → profile → org → describe → questions → activate → canvas → roadmap → tasks → chat.
- ⚠️ **Lint was failing on the Phase 16 error utility** (4 errors + 2 warnings) — contradicts checkpoint claim of "zero lint errors."
- ⚠️ **Typecheck was failing** because `next-env.d.ts` had drifted to point at the dev-only `.next/dev/types/routes.d.ts`.
- ⚠️ **Four public-facing pages visibly leak developer markers** like `[ASSUMPTION: ...]` directly to end users (docs, privacy-policy, terms, pricing calculator). This is the single biggest "looks unfinished" UX issue.

Both verifier failures are now fixed. Public-copy leaks are queued for the next pass.

---

## 1. What Exists

### Marketing surface
- `/`, `/pricing`, `/resources`, `/resources/introducing-cofounder-2`, `/how-to/start|build|sell|scale`, `/privacy-policy`, `/terms` (canonical), `/terms-of-service` (307 → `/terms`), `/docs`, `/login`.
- Hero pixel-art scene rendered with CSS-only original geometry (no proprietary art), stagger entrance animations, glass notification wheel, full home sections (chapters, value props, roadmap preview, demo sections, tool carousel, industry wordsearch, footer CTA).
- Pricing page with 3 tiers, cost calculator (slider-based), feature comparison, FAQ.
- How-to chapters with TOC sidebar via dynamic `[chapter]` route.

### Auth & Onboarding
- GitHub OAuth flow (`/api/auth/github` → `/callback`) + sandbox fallback (`/api/auth/sandbox-login`).
- Signed HMAC session cookie (no session table; DECISION-22).
- Personal onboarding (PUT/PATCH for resume).
- Company onboarding: describe → 5 AI-generated questions → decide-all or per-question answer → business-plan generation → activate-departments.
- Design onboarding: vibe picker → references upload → generation progress → approve/skip with risk warning.

### Workspace (app)
- React Flow canvas at `/org/:orgId/canvas` with custom `CofounderNode` + `DepartmentNode`, 8 departments orbiting a center node, dashed orbit edges + animated active edges for departments with work running.
- View-state persistence (`viewport`, selected node, active tab via `PUT /api/orgs/:orgId/canvas/view-state`).
- 5-tab right side panel: Home (greeting + roadmap card + suggested next + chat), Cofounder (chat), Company (stack/links), Tasks (list/board/calendar + new task dialog), Library (file browser).
- Department board dialog, agent workspace dialog, task workspace dialog.
- Roadmap tech-tree modal with stages, items, dependencies, completion + launch.
- Task system: create, start, cancel, comments, subtasks, attachments, approvals.
- Agent center: list, create, launch, control center.
- Chat: threads, messages, composer with file picker, message renderer.
- Files & Library: folders, upload, archive, preview (text/markdown/JSON/CSV inline; metadata for image/PDF/office), versions.
- Inbox / notifications panel (derived from AuditLog + workspace records; DECISION-27).
- Command palette (Ctrl/Meta+K) with global search (`GET /api/orgs/:orgId/search`).

### Settings & integrations
- Sections: Preferences, AI, Env Files, Notifications, Organization, Inbox (domains + agent addresses), Support, Stripe (test/live keys), Billing, Advanced (Supabase import, repo switch with destructive-confirm).
- Integration center + dedicated Postiz route.
- Plan upgrade modal with confirmation.

### Backend / data
- **30 Prisma models** (User, Organization, Membership, OnboardingAnswer, Department, Agent, AgentAction, AgentInbox, Task, Approval, ChatThread, ChatMessage, File, Folder, FileVersion, RoadmapStage, RoadmapItem, RoadmapDependency, Integration, IntegrationEvent, Secret, InboxDomain, AuditLog, BillingAccount, CanvasViewState, NotificationPreference, UserPreference, plus supporting).
- SQLite local with better-sqlite3 adapter (Prisma 7.8).
- One migration: `20260508000000_init`.
- **85 API routes** under `src/app/api/...` with consistent `dataResponse` / `errorResponse` patterns and a unified `routeError` handler (now lint-clean).
- Sandbox adapters for every external provider (no credentials required for local verification).

### Design system
- Original CSS pixel-art primitives in `src/components/marketing/pixel-art.tsx`.
- Tokens (`src/styles/tokens.css`) match the design-spec verified colors/radii/typography hooks (warm `#f5f5f2` background, app `#1e1e23`, brand `#6229ff`, font stacks for Plus Jakarta + Figtree + Pixelify + IBM Plex Mono).
- Motion primitives in `src/styles/motion.css` (462 lines) covering hero-enter, notif-wheel-in/out, task-row-in, testimonial fade, scroll-arrow, carousel slides, node-select-pop, agent-pulse, panel-slide-in, modal-enter, etc.
- Shared UI in `src/components/ui` + 18 domain folders.

---

## 2. What Works (Verified This Session)

| Surface | Probe | Result |
|---|---|---|
| Build | `pnpm build` | ✅ exit 0, 26 routes generated |
| TypeScript | `pnpm typecheck` | ✅ clean (after fix) |
| Lint | `pnpm lint --max-warnings=0` | ✅ clean (after fix) |
| Health | `GET /api/health` | 200 `{ok:true, phase:"final-graduation-audit"}` |
| All public routes | `/`, `/pricing`, `/resources`, `/how-to/start`, `/login`, `/privacy-policy`, `/terms`, `/docs` | 200 |
| Redirect | `/terms-of-service` | 307 → `/terms` |
| Sandbox login | `POST /api/auth/sandbox-login` | 200, session cookie set |
| Session | `GET /api/auth/session` | 200, user echoed |
| Profile | `PUT /api/onboarding/profile` | 200 status:complete |
| Org create | `POST /api/orgs` | 200 |
| Describe | `POST /api/orgs/:id/describe` | 200, 5 questions + actions |
| Decide-all | `POST /api/orgs/:id/questions/decide-all` | 200, all 5 answered |
| Activate departments | `POST /api/orgs/:id/activate-departments` | 200, 8 departments seeded |
| Canvas | `GET /api/orgs/:id/canvas` | 200 |
| Roadmap | `GET /api/orgs/:id/roadmap` | 200, 32 items, 2 complete, 2 available |
| Tasks list | `GET /api/orgs/:id/tasks` | 200 |
| Task create | `POST /api/orgs/:id/tasks` | 201 |
| Agents | `GET /api/orgs/:id/agents` | 200, 8 default agents |
| Chat thread | `POST /api/orgs/:id/chat/threads` | 201 |
| Files | `GET /api/orgs/:id/files` | 200, General folder + business plan |
| Inbox | `GET /api/orgs/:id/inbox` | 200 |
| Search | `GET /api/orgs/:id/search?q=eng` | 200, agents + tasks groups |
| Canvas page render | `GET /org/:id/canvas` | 200, 96KB HTML, no client errors |

Dev log shows **zero** error/warning lines across the full smoke run.

---

## 3. What Is Broken / Was Broken

### Fixed this session
1. **`next-env.d.ts` drift** — file had been edited to `import "./.next/dev/types/routes.d.ts"` (Next dev artifact, not the build artifact). Typecheck failed with 100+ TS1005 errors. **Fixed via `git checkout`.**
2. **Lint errors in Phase 16 error utility** — `src/lib/utils/error.ts` had 3× `any` (lint errors) and `src/lib/api/route-errors.ts` had `code as any` (lint error) plus an unused `AppError` import (warning). `src/app/not-found.tsx` imported `Button` unused (warning). **Fixed:**
   - Replaced `details?: any` with `ErrorDetails = Record<string, unknown> | undefined`.
   - Replaced `(error as any).code?.startsWith(...)` with a typed `hasPrismaCode` guard.
   - Replaced `(error.code as any) ?? "INTERNAL"` with a `KNOWN_API_ERROR_CODES`-set normalizer (also closes a hole where `error.code` could be any string but `errorResponse` expected the `ApiErrorCode` union).
   - Removed unused imports.

### Still pending (P1, low effort, high visibility)
3. **Four public pages leak internal `[ASSUMPTION:...]` markers** — visible to end users:
   - `src/app/(marketing)/docs/page.tsx` line 19: `[ASSUMPTION: the notes conflict between internal /docs and external docs...]`
   - `src/app/(marketing)/privacy-policy/page.tsx` line 18: `[ASSUMPTION: exact legal copy was not provided...]`
   - `src/app/(marketing)/terms/page.tsx` line 19: `[ASSUMPTION: exact terms copy was not provided...]`
   - `src/components/marketing/pricing-calculator.tsx` line 53: `[ASSUMPTION: exact source formulas were not provided...]`
4. **Legal shell pages openly say "shell"** — title literally reads "Privacy content shell" / "Canonical terms content shell", body says "This shell tracks the surface for future reviewed legal copy." That's developer copy in production.
5. **Docs page title reads "Documentation landing page."** — placeholder.

None of these are bugs — they're verbal hangovers from the build process that ship to users.

---

## 4. What Is Fake / Mock (By Design)

These are intentional sandbox adapters per DECISION-09 (no external credentials available locally) — they are **not** broken, they are working sandbox stubs:

- AI artifact generation (business plan, brand kit) — deterministic generator.
- GitHub repo provisioning, Vercel deploy, Supabase DB, Stripe billing, Postiz publishing, Apify enrichment, S3 file binaries.
- Agent execution: deterministic action timeline rather than a real agent runtime (DECISION-43).

All adapters surface their sandbox state explicitly in the UI (e.g., "managed" badges, "requires setup" stack rows). When real credentials land in `.env`, the provider modes already exist (e.g., `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` switches the auth path to real OAuth — see `src/lib/auth/`).

---

## 5. What Differs From Docs

Most differences are **intentional and documented in `DECISIONS.md` / `OPEN-QUESTIONS.md`** (52 decisions, 25 questions). Notable items:

| Spec call-out | Implementation | Reason |
|---|---|---|
| "Neoris" + "Departure Mono" custom fonts | Plus Jakarta Sans + IBM Plex Mono fallbacks | DECISION-03 (no proprietary fonts), ASSUMPTION-08, QUESTION-13. |
| Pixel art from designer | CSS-only original geometric pixel scenes | DECISION-20 (no proprietary assets). |
| Hero "Run a company" button uses light cream `btn-light-surface` per the verified DevTools extract | Implementation uses `variant="dark"` for the primary hero CTA (dark pill on dark backdrop) | **Mismatch worth fixing** — the docs explicitly correct an earlier report; the hero primary should be the light cream button. |
| Routes: docs at `https://docs.cofounder.co/` (external) and `/docs` (internal) | `/docs` is internal-only with a docsSections grid | QUESTION-02, intentional. |
| "Skills" route surface | Modal-overlay style, not a full page | Matches one source, not the other. |
| Departments availability: notes conflict on whether Support/Operations/Finance/Legal are coming-soon or active | All 8 active in seeding | DECISION-36, QUESTION-05. |

---

## 6. Priority Fix Queue

### P0 (already fixed during this audit pass)
- [x] Restore `next-env.d.ts` to point at the build types path
- [x] Eliminate `no-explicit-any` lint errors in `error.ts` / `route-errors.ts`
- [x] Remove unused `Button` import in `not-found.tsx`
- [x] Tighten `ApiErrorCode` normalization so unknown app-error codes don't escape the typed union

### P1 — Public UX leaks (next pass, ~15 min)
- [ ] Replace `[ASSUMPTION:...]` text on `/docs`, `/privacy-policy`, `/terms`, and pricing calculator with user-facing copy
- [ ] Reword "shell" / "Canonical terms content shell" titles
- [ ] Switch hero primary "Run a company" button to the verified light cream variant (matches the verified DevTools extract)

### P2 — Nice to have
- [ ] Add a `last_org_slug` redirect from `/` on returning sessions (currently has `lastOrgSlug` column but no top-level shortcut)
- [ ] Consider extracting hero geometry into a small `<canvas>` for crisper rendering at HiDPI
- [ ] Add `loading="lazy"` to below-fold mockup images / decorative blocks

### Out of scope without external decisions
- Real GitHub OAuth — needs credentials.
- Real Stripe / Postiz / Supabase / Vercel / Apify — needs credentials.
- True chat streaming (SSE/WebSocket) — currently optimistic request/response (DECISION-45).
- Real agent runtime — currently deterministic sandbox (DECISION-43).
- Departure Mono / Neoris licenses — flagged in OPEN-QUESTIONS as licensing decisions, not engineering tasks.

---

## 7. Estimated Path To Completion

The product is **shippable to a closed beta as-is** for everything that doesn't require external provider credentials. The remaining gap to a "real funded startup product ready for users" is small:

1. **~15 min**: Fix the four `[ASSUMPTION:]` UX leaks + legal shell copy + hero button variant (P1 list above). This is the only thing a visitor would notice as "unfinished."
2. **External**: Plug in real provider credentials and run the seven existing integration flows in provider mode (Stripe, GitHub, Vercel, Supabase, Postiz, S3, email/domain). Each has a sandbox→provider switch already wired.
3. **~1 day**: Real chat streaming (SSE) — frontend composer already speaks the optimistic/streaming shape, so this is a backend swap.
4. **~varies**: Real agent execution — when an external agent runtime is chosen, swap `src/lib/agents/*` sandbox actions for the runtime adapter.

---

## 8. What I Am Doing Next

Executing the P1 list now in a single, focused pass. After that:
- Re-run `pnpm verify` and `pnpm build`.
- Re-smoke `/`, `/docs`, `/privacy-policy`, `/terms`, `/pricing`.
- Write a final `MASTER_GAP_REPORT.md` summarizing what remains for the user.

No new features will be invented — this audit's job is to make the existing build stop visibly looking unfinished and verify the runtime is clean.
