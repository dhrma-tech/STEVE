# checkpoint-5.md

## Phase
Execution Phase 4 - Auth And Onboarding

## Status
Complete.

## What Was Built
- `/login` centered auth screen with original pixel-sky background, Cofounder title treatment, GitHub continue action, clearly labeled local sandbox fallback, and legal links.
- Signed first-party session helpers, logout/session APIs, sandbox login API, GitHub OAuth entry route, and GitHub callback exchange route.
- `/onboarding` personal onboarding with five validated steps: name, technical experience, role, company stage, and company name.
- Partial personal onboarding persistence with `PATCH /api/onboarding/profile`, including reload/resume behavior.
- `/org/[orgId]/onboarding` company activation workspace with activation canvas, AI chat panel, generated five-question modal, answer/decide-all flows, action log, answered question accordion, business plan generation, and activation CTA.
- Department activation service that creates all 8 departments, default agents, roadmap seed data, general folder, business plan file, billing account, and managed integration records.
- Design onboarding wizard with intro, vibe picker, skip warning modal, reference metadata upload, generation loading state, brand kit review, approve, and iterate paths.
- Design onboarding APIs for state, vibe, references, generate, approve, and skip.
- Phase 4 components registered in `REGISTRY.md`.

## Verification Pass
| Requirement | Status | Notes |
|---|---|---|
| Login routes unauthenticated users correctly | built | `/login` returns 200 on desktop/mobile. `/onboarding` unauthenticated browser navigation redirects to `/login`. |
| Login has GitHub auth and labeled sandbox fallback | built | Login shows "Continue with GitHub" plus "Use sandbox founder" local fallback. GitHub provider callback route exists and compiles. |
| Authenticated incomplete users route to onboarding | built | Session destination logic sends incomplete users to `/onboarding`; Playwright verified authenticated personal onboarding render. |
| Authenticated active orgs route onward | built | `destinationForSession` routes complete users with active, design-complete orgs to `/org/:orgId/canvas`; canvas route is Phase 6. |
| Onboarding resumes partial progress | built | UI flow saved name via PATCH, reloaded, and resumed at "Experience" / Step 2 of 5. |
| All five personal onboarding steps validate | built | Playwright walked Name, Experience, Role, Stage, and Company; invalid/empty current steps are blocked by `canContinue`. |
| Company onboarding creates questions, answers, business plan, and file | built | API flow generated 5 questions, decided 5 answers, created a business plan, and saved `Business Plan.md`. |
| Accept activates departments, agents, roadmap, integrations | built | API flow created 8 departments, default agents, roadmap seed, billing, folder/file artifacts, and 12 managed integrations. |
| Design onboarding supports choose, skip, upload, generate, approve/iterate | built | APIs and UI support vibe selection, skip modal, reference metadata, generation loading states, brand kit review, approve, and iterate feedback. |
| Error/loading/empty states present | built | Login/onboarding API errors render `ErrorState`; save/generate/activate buttons render loading states; company workspace has empty prompts and action log states. |
| Responsive auth/onboarding screens | built | Playwright desktop and mobile checks found no horizontal overflow on login and onboarding surfaces. |
| TypeScript and lint pass | built | `pnpm verify` passed after Phase 4 code. |
| Production build passes | built | `pnpm build` passed and includes `/api/auth/github/callback`, `/login`, `/onboarding`, and `/org/[orgId]/onboarding`. |

## API Flow Verified
Local sandbox flow created a fresh founder, completed personal profile, created an org, generated questions, decided answers, generated the business plan, activated departments, saved design references, generated a brand kit, and approved it. The verified activation output included 8 departments and 12 integrations.

## Assumptions Made This Phase
- [ASSUMPTION-11] GitHub OAuth credentials and a registered callback URL are absent locally; provider code is implemented, and local verification uses the clearly labeled sandbox fallback.
- [ASSUMPTION-12] Exact AI wording and brand-kit output are unspecified; deterministic sandbox outputs provide required structures.

## Deviations From Plan
- Added `PATCH /api/onboarding/profile` and documented it in `docs/api-spec.md` so personal onboarding can persist partial progress cleanly.
- Design onboarding state is stored in existing `OnboardingAnswer` records rather than a new table to respect the frozen schema.

## Decisions Added
- [DECISION-22] Use signed first-party HMAC cookies for local sessions.
- [DECISION-23] Implement GitHub OAuth provider mode with a state cookie and callback exchange.
- [DECISION-24] Add `PATCH /api/onboarding/profile` for partial personal onboarding progress.
- [DECISION-25] Use deterministic sandbox generators for company questions, business plan, activation, and brand kits.
- [DECISION-26] Store design onboarding state in existing `OnboardingAnswer` records.
- [ASSUMPTION-11] GitHub OAuth credentials/callback URL are absent locally.
- [ASSUMPTION-12] Exact AI wording and brand-kit output are unspecified.

## Open Questions Raised
- [QUESTION-16] GitHub OAuth app credentials and registered callback URL are not present in the repo or environment.
- [QUESTION-17] Exact AI prompt contracts and generated text for company onboarding and brand-kit recommendations are not specified.

## What The Next Phase Depends On
- Re-read `SCRATCHPAD.md`, this checkpoint, `REGISTRY.md`, `docs/product-spec.md`, `docs/source-analysis.md`, `docs/api-spec.md`, and Execution Phase 5 in `docs/implementation-plan.md`.
- Build the authenticated org shell around existing auth/org guards: org layout, sidebar/topbar, command palette, search, inbox notifications, upgrade modal shell, and responsive mobile app navigation.
