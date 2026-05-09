# Implementation Plan

## Operating Procedure
Before each execution phase:
- Re-read `SCRATCHPAD.md`.
- Re-read the latest checkpoint.
- Re-read relevant sections of `docs/product-spec.md` and `docs/source-analysis.md`.
- State current phase, complete work, work about to be built, and dependencies.

During each phase:
- Use `REGISTRY.md` after Execution Phase 2.
- Log ambiguity immediately in `OPEN-QUESTIONS.md`.
- Log non-obvious technical decisions immediately in `DECISIONS.md`.
- Update `SCRATCHPAD.md` continuously.
- Do not silently change the schema after Planning Phase 1.

After each phase:
- Verify against `docs/product-spec.md` and `docs/source-analysis.md`.
- List each relevant requirement as built / partial / missing.
- Fix all partial/missing items before moving on.
- Write `checkpoint-N.md`.

## Planning Phase 1 Completion Criteria
- [x] `docs/source-analysis.md` exists.
- [x] `docs/product-spec.md` exists.
- [x] `docs/design-system.md` exists.
- [x] `docs/architecture.md` exists.
- [x] `docs/database-schema.md` exists and is frozen.
- [x] `docs/api-spec.md` exists.
- [x] `docs/implementation-plan.md` exists and covers all 17 execution phases.
- [x] `SCRATCHPAD.md`, `OPEN-QUESTIONS.md`, `DECISIONS.md` are current.
- [x] `checkpoint-1.md` is written.

---

# Execution Phase 1: Project Setup

## Goal
Create the app foundation without product feature shortcuts.

## Files To Create
- `package.json`
- `pnpm-lock.yaml` or package-manager lock
- `next.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `postcss.config.mjs`
- `tailwind.config.ts`
- `.env.example`
- `.gitignore`
- `README.md`
- `src/app/layout.tsx`
- `src/app/not-found.tsx`
- `src/app/error.tsx`
- `src/styles/tokens.css`
- `src/styles/globals.css`
- `src/styles/motion.css`
- `src/lib/utils/*`
- `src/lib/db/*`
- `prisma/schema.prisma`
- `prisma/seed.ts`

## Components To Build
- Root app layout.
- Global error boundary.
- Not-found page.
- Basic loading shell.

## APIs/DB To Wire
- Prisma schema from `docs/database-schema.md`.
- Initial migration.
- Seed script for departments, roadmap definitions, and sandbox data.
- Health endpoint `/api/health`.

## Decisions To Make
- Package manager choice.
- Exact dependency versions.
- Local DB setup command.

## Completion Criteria
- [x] Project installs successfully.
- [x] TypeScript compiles.
- [x] Lint runs.
- [x] Prisma migration exists.
- [x] Seed command creates all required seed data.
- [x] `/api/health` returns success.
- [x] `SCRATCHPAD.md`, `DECISIONS.md`, `OPEN-QUESTIONS.md` updated.
- [x] Verification pass clean.
- [x] `checkpoint-2.md` written.

---

# Execution Phase 2: Design System

## Goal
Build tokens, global styles, base UI primitives, motion primitives, fonts, and icons.

## Files To Create
- `src/components/ui/button.tsx`
- `src/components/ui/icon-button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/toggle.tsx`
- `src/components/ui/segmented-control.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/accordion.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/ui/slider.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/empty-state.tsx`
- `src/components/ui/error-state.tsx`
- `src/components/ui/loading-state.tsx`
- `src/components/ui/file-upload.tsx`
- `src/components/ui/progress.tsx`
- `src/components/motion/*`
- `src/lib/design/tokens.ts`
- `REGISTRY.md`

## Components To Build
- All base UI components.
- Marketing buttons: light surface and dark gradient CTA.
- Hero notification pill.
- Pricing card primitive.
- Feature callout.
- App panel/card primitives.
- Modal/confirmation primitives.
- Status badge system.
- Responsive app/public containers.

## APIs/DB To Wire
- None beyond local visual examples/story harness if needed.

## Decisions To Make
- Font implementation details.
- Icon mapping.
- Reduced-motion implementation.

## Completion Criteria
- [x] Tokens match `docs/design-system.md`.
- [x] Base components are responsive and accessible.
- [x] Reduced motion supported.
- [x] `REGISTRY.md` lists every component with status and planned usage.
- [x] No duplicate component abstractions.
- [x] Verification pass clean.
- [x] `checkpoint-3.md` written.

---

# Execution Phase 3: Public Website

## Goal
Implement all marketing pages, SEO, layout, nav, footer, CTA flows, and visual assets.

## Files To Create
- `src/app/(marketing)/layout.tsx`
- `src/app/(marketing)/page.tsx`
- `src/app/(marketing)/pricing/page.tsx`
- `src/app/(marketing)/resources/page.tsx`
- `src/app/(marketing)/resources/introducing-cofounder-2/page.tsx`
- `src/app/(marketing)/how-to/[chapter]/page.tsx`
- `src/app/(marketing)/privacy-policy/page.tsx`
- `src/app/(marketing)/terms/page.tsx`
- `src/app/(marketing)/terms-of-service/page.tsx`
- `src/app/(marketing)/docs/page.tsx`
- `src/components/marketing/*`
- `src/data/marketing-content.ts`
- `src/data/how-to-content.ts`
- `src/data/pricing.ts`
- `src/lib/pricing/calculator.ts`

## Components To Build
- Marketing navbar and mobile menu.
- Hero with original pixel-art background.
- Notification wheel.
- Product preview section.
- Value prop columns.
- Chapter cards.
- Feature showcase sections.
- Tool carousel.
- Industry wordsearch.
- Footer and footer tilt card.
- Pricing cards and cost calculator.
- Feature comparison table.
- FAQ accordion.
- Resources grid.
- Blog article shell.
- How-to TOC and article renderer.

## APIs/DB To Wire
- Public pricing calculator endpoint `/api/pricing/calculate`.
- Static data modules.

## Decisions To Make
- Original asset creation method.
- Canonical legal route handling.
- Internal docs content scope.

## Completion Criteria
- [x] Every public route in product spec exists.
- [x] CTAs route correctly.
- [x] Pricing calculator computes category breakdown.
- [x] How-to pages include all listed TOC sections.
- [x] Mobile menu works.
- [x] SEO metadata present.
- [x] No copied proprietary assets.
- [x] Verification pass clean.
- [x] `checkpoint-4.md` written.

---

# Execution Phase 4: Auth And Onboarding

## Goal
Implement login, GitHub/sandbox auth, personal onboarding, company onboarding, and design onboarding.

## Files To Create
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/onboarding/page.tsx`
- `src/app/org/[orgId]/onboarding/page.tsx`
- `src/components/auth/*`
- `src/components/onboarding/*`
- `src/lib/auth/*`
- `src/lib/onboarding/*`
- API route files under `/api/auth`, `/api/onboarding`, `/api/orgs`.

## Components To Build
- Login screen.
- GitHub/sandbox auth button.
- Onboarding stepper.
- Option cards.
- Company creation form.
- AI onboarding chat.
- Question modal.
- Business plan preview.
- Department activation progress.
- Design onboarding wizard.
- Skip warning modal.
- Brand kit review.

## APIs/DB To Wire
- Auth session/logout/sandbox login.
- Personal onboarding get/update.
- Create organization.
- Describe company.
- Answer questions.
- Decide all.
- Generate business plan.
- Activate departments.
- Design onboarding APIs.

## Decisions To Make
- Sandbox auth labeling.
- Deterministic AI question generation in sandbox.
- Brand kit sandbox output structure.

## Completion Criteria
- [x] Login routes unauthenticated users correctly.
- [x] Onboarding resumes partial progress.
- [x] All five personal onboarding steps validate.
- [x] Company onboarding creates questions, answers, business plan, and file.
- [x] Accept activates departments, agents, roadmap, integrations.
- [x] Design onboarding supports choose, skip, upload, generate, approve/iterate.
- [x] Error/loading/empty states present.
- [x] Verification pass clean.
- [x] `checkpoint-5.md` written.

---

# Execution Phase 5: App Shell

## Goal
Build the authenticated app frame and shared navigation.

## Files To Create
- `src/app/org/[orgId]/layout.tsx`
- `src/components/app-shell/*`
- `src/components/command-palette/*`
- `src/components/notifications/*`
- `src/lib/orgs/*`
- `src/lib/search/*`

## Components To Build
- App frame.
- Company switcher/avatar.
- Breadcrumb.
- Top-right search.
- Hamburger action menu.
- Command palette.
- Inbox notification panel.
- Upgrade modal shell.
- Side panel tab shell.
- Responsive mobile app navigation.

## APIs/DB To Wire
- Org fetch/update.
- Search endpoint.
- Inbox endpoints.
- Canvas view state endpoint.

## Decisions To Make
- Mobile app shell navigation pattern.
- Command palette keyboard shortcut.

## Completion Criteria
- [x] App shell wraps all org routes.
- [x] Auth/org guards work.
- [x] Breadcrumb updates.
- [x] Search and command palette return grouped results.
- [x] Inbox empty and populated states work.
- [x] Upgrade modal opens from menu.
- [x] Verification pass clean.
- [x] `checkpoint-6.md` written.

---

# Execution Phase 6: Dashboard And Canvas

## Goal
Implement the main workspace canvas, side panel tabs, and query-param driven modal/session routing.

## Files To Create
- `src/app/org/[orgId]/canvas/page.tsx`
- `src/components/canvas/*`
- `src/components/side-panel/*`
- `src/lib/canvas/*`

## Components To Build
- React Flow canvas.
- Cofounder node.
- Department node.
- Orbit connectors.
- Active connector.
- Workspace preview card.
- Home tab.
- Cofounder tab shell.
- Company tab shell.
- Tasks tab shell.
- Library tab shell.
- Roadmap modal trigger.
- Session view trigger.

## APIs/DB To Wire
- `/api/orgs/:orgId/canvas`.
- `/api/orgs/:orgId/canvas/view-state`.
- Department/task/roadmap summary data.

## Decisions To Make
- Node positions and responsive canvas bounds.
- Persisted viewport format.

## Completion Criteria
- [x] Canvas shows Cofounder plus all 8 departments.
- [x] Pan/zoom works.
- [x] Selecting department updates panel.
- [x] Side panel tabs work.
- [x] Roadmap query opens modal placeholder only if full modal is not yet phase-built; final implementation happens Phase 8.
- [x] Session query routes to agent workspace shell only if full workspace is not yet phase-built; final implementation happens Phase 10.
- [x] Verification pass clean for Phase 6 scope.
- [x] `checkpoint-7.md` written.

---

# Execution Phase 7: 8 Department System

## Goal
Build all department structures, views, entities, panels, and department board interactions.

## Files To Create
- `src/components/departments/*`
- `src/data/departments.ts`
- `src/lib/departments/*`
- department API route handlers.

## Components To Build
- Department detail panel.
- Department cover image.
- Agents section.
- Tasks section.
- Files section.
- Context section.
- Department board.
- Department roadmap strip.
- Launch agent CTA.
- Department context tabs.
- Department availability/coming-soon states.

## APIs/DB To Wire
- Department list/detail.
- Department context update.
- Agents/tasks/files summaries.

## Decisions To Make
- Department cover asset generation/selection.
- Locked vs coming-soon display for Support/Ops/Finance/Legal.

## Completion Criteria
- [x] All 8 departments visible and inspectable.
- [x] Active/locked/coming-soon states match spec assumptions.
- [x] Every department has default agent, description, cover, tasks/files/context sections.
- [x] Department board supports setup prompt and launch CTA.
- [x] Verification pass clean.
- [x] `checkpoint-8.md` written.

---

# Execution Phase 8: Roadmap And Tech Tree

## Goal
Build full roadmap UI, dependency graph, milestones, unlocks, and launch flow.

## Files To Create
- `src/components/roadmap/*`
- `src/data/roadmap.ts`
- `src/lib/roadmap/*`
- Roadmap API handlers.

## Components To Build
- Full-screen roadmap modal.
- Horizontal stage board.
- Stage columns.
- Tech tree card.
- Dependency connectors.
- Detail panel.
- Progress indicators.
- Launch agent/user-input flow.

## APIs/DB To Wire
- Roadmap list/detail.
- Launch item.
- Complete item.
- Dependency unlock engine.

## Decisions To Make
- Mature stage empty/locked display.
- Work type defaults per roadmap item.

## Completion Criteria
- [x] All listed stages and items exist.
- [x] Dependencies lock/unlock correctly.
- [x] Detail panel has all required sections.
- [x] Launch creates task or asks input/approval.
- [x] Roadmap progress updates.
- [x] Verification pass clean.
- [x] `checkpoint-9.md` written.

---

# Execution Phase 9: Tasks

## Goal
Implement task creation, assignment, filters, list/board/calendar views, subtasks, comments, and approvals.

## Files To Create
- `src/components/tasks/*`
- `src/lib/tasks/*`
- Task API handlers.

## Components To Build
- New task modal.
- Task list.
- Task board.
- Task calendar.
- Task filters/search.
- Task detail.
- Subtasks.
- Comments.
- Attachments.
- Approval state UI.
- Suggested next list and refresh control.

## APIs/DB To Wire
- Task CRUD.
- Subtasks.
- Comments.
- Start/cancel.
- Approval creation hooks.

## Decisions To Make
- Calendar layout for mobile.
- Optimistic update scope.

## Completion Criteria
- [x] Task can be created from every required entry point.
- [x] List/board/calendar views work.
- [x] Filters work.
- [x] Subtasks/comments/attachments work.
- [x] Statuses match product spec.
- [x] Approval-required tasks pause for human review.
- [x] Verification pass clean.
- [x] `checkpoint-10.md` written.

---

# Execution Phase 10: Agents

## Goal
Build agent creation, configuration, execution, monitoring, logs, and marketplace/skills surface.

## Files To Create
- `src/components/agents/*`
- `src/lib/agents/*`
- `src/lib/queue/*`
- Agent/session API handlers.

## Components To Build
- Agent list rows/cards.
- Agent config form.
- New agent modal.
- Agent workspace.
- Agent Browser tab.
- Scratchpad tab.
- Replay tab/loading state.
- Agent action log.
- Session status badges.
- Agent marketplace/skills panel.

## APIs/DB To Wire
- Agent CRUD.
- Agent launch.
- Session fetch.
- Session actions.
- Scratchpad update.
- Queue processor for sandbox execution.

## Decisions To Make
- Sandbox execution script/action sequence.
- Agent marketplace scope from notes.

## Completion Criteria
- [x] Default agents exist.
- [x] New agent can be created/configured.
- [x] Agent can launch task session.
- [x] Running/finished statuses update.
- [x] Logs/actions visible.
- [x] Browser/scratchpad/replay states exist.
- [x] Verification pass clean.
- [x] `checkpoint-11.md` written.

---

# Execution Phase 11: Chat

## Goal
Implement Cofounder chat, task chat, threads, mentions, file attachments, and AI integration layer.

## Files To Create
- `src/components/chat/*`
- `src/lib/chat/*`
- `src/lib/ai/*`
- Chat API handlers.

## Components To Build
- Thread list/new conversation.
- Message list.
- Markdown renderer.
- Action log message.
- Thinking/code block rendering.
- Composer with mentions and attachments.
- Copy message button.
- Streaming/typing indicator.
- Error/retry state.

## APIs/DB To Wire
- Thread CRUD.
- Message list/send.
- AI/sandbox response adapter.
- File attachment linking.

## Decisions To Make
- Streaming transport: polling first, SSE-ready.
- Thinking block visibility behavior.

## Completion Criteria
- [x] Cofounder chat works.
- [x] Task chat works.
- [x] Mentions resolve departments.
- [x] Attachments persist.
- [x] Agent/system action logs display.
- [x] Empty/loading/error states complete.
- [x] Verification pass clean.
- [x] `checkpoint-12.md` written.

---

# Execution Phase 12: Files And Library

## Goal
Implement file upload, organization, preview, sharing, archive, and version history.

## Files To Create
- `src/components/files/*`
- `src/lib/files/*`
- File/folder API handlers.

## Components To Build
- Library browser.
- Folder tree/list.
- File grid/list.
- Upload dialog/dropzone.
- File preview panel.
- Version history panel.
- Share/archive controls.
- Department file section.
- Task attachment picker.

## APIs/DB To Wire
- Folder CRUD.
- File upload/list/get/archive.
- File versions.
- Preview endpoint.

## Decisions To Make
- Local storage path.
- Preview supported MIME types.

## Completion Criteria
- [x] Business Plan appears in General folder.
- [x] Upload works.
- [x] Search works.
- [x] Folder navigation works.
- [x] Preview works for supported types.
- [x] Versions work.
- [x] Archive/share states work.
- [x] Verification pass clean.
- [x] `checkpoint-13.md` written.

---

# Execution Phase 13: Settings, Billing And Integrations

## Goal
Implement every settings page, billing flow, and integration surface.

## Files To Create
- `src/app/org/[orgId]/settings/*`
- `src/app/org/[orgId]/integrations/postiz/page.tsx`
- `src/components/settings/*`
- `src/components/billing/*`
- `src/components/integrations/*`
- `src/lib/settings/*`
- `src/lib/billing/*`
- `src/lib/integrations/*`
- Settings/billing/integration API handlers.

## Components To Build
- Settings sidebar.
- Preferences form.
- AI settings form.
- Env files/secrets manager.
- Notification preferences.
- Organization/members/context import.
- Inbox domains and agent inboxes.
- Support surface.
- Stripe test/live settings.
- Billing dashboard/usage.
- Advanced Supabase/repo destructive flows.
- Postiz channel integration.
- Upgrade modal completion.

## APIs/DB To Wire
- All settings endpoints from API spec.
- Billing endpoints.
- Integration connect/disconnect/check.
- Secret write-only storage/push simulation.

## Decisions To Make
- Sandbox provider status copy.
- Destructive confirmation patterns.

## Completion Criteria
- [x] Every settings route exists.
- [x] Every form validates and persists.
- [x] Billing plan and usage visible.
- [x] Upgrade flow works.
- [x] Integrations can connect/check/disconnect in sandbox.
- [x] Secrets are not returned in plain text.
- [x] Verification pass clean.
- [x] `checkpoint-14.md` written.

---

# Execution Phase 14: Responsive Design

## Goal
Audit and complete mobile/tablet behavior for every surface.

## Files To Touch
- All route and component styles as needed.
- `src/styles/globals.css`
- `src/styles/tokens.css`
- `src/components/app-shell/*`
- `src/components/marketing/*`

## Components To Build/Refine
- Mobile marketing nav.
- How-to TOC drawer.
- Pricing stack.
- App mobile drill-in navigation.
- Responsive canvas fallback controls.
- Mobile modals/forms.

## APIs/DB To Wire
- None unless viewport preferences need persistence updates.

## Decisions To Make
- Minimum practical app viewport behavior.

## Completion Criteria
- [x] Public site usable at mobile/tablet/desktop.
- [x] App usable at mobile/tablet/desktop.
- [x] No text overflow.
- [x] No incoherent overlaps.
- [x] Playwright screenshots checked.
- [x] Verification pass clean.
- [x] `checkpoint-15.md` written.

---

# Execution Phase 15: Animations And Motion

## Goal
Complete page transitions, micro-interactions, skeleton states, entrance animations, and reduced-motion behavior.

## Files To Touch
- `src/styles/motion.css`
- `src/components/motion/*`
- Marketing/app interactive components.

## Components To Build/Refine
- Hero stagger.
- Notification wheel.
- Task row animations.
- Carousels.
- Wordsearch draw.
- Footer tilt.
- Mobile menu animation.
- App panel/modal transitions.
- Skeleton shimmer.
- Agent status pulse.

## APIs/DB To Wire
- None.

## Decisions To Make
- Which animations are disabled in reduced motion.

## Completion Criteria
- [x] Verified keyframes implemented or equivalent.
- [x] Reduced motion disables nonessential movement.
- [x] Animations do not cause layout shift.
- [x] Verification pass clean.
- [x] `checkpoint-16.md` written.

---

# Execution Phase 16: Error, Loading And Empty States

## Goal
Ensure every surface has explicit loading, empty, error, and retry states.

## Files To Touch
- All pages/components.
- Shared state components.
- API error utilities.

## Components To Build/Refine
- Route loading screens.
- Skeletons.
- Empty inbox/tasks/files/search/integrations/agents.
- API error banners.
- Upload failure state.
- Auth failure state.
- Billing failure state.
- AI generation failure state.
- Provider error state.

## APIs/DB To Wire
- Standardized API error mapper.
- Retry endpoints where applicable.

## Decisions To Make
- Retry behavior for provider vs validation errors.

## Completion Criteria
- [x] No raw crashes.
- [x] No blank screens.
- [x] Every async surface has loading/error/empty.
- [x] Error codes map to user-facing copy.
- [x] Verification pass clean.
- [x] `checkpoint-17.md` written.

---

# Execution Phase 17: QA And Testing

## Goal
Add unit, integration, and E2E tests for critical logic and flows.

## Files To Create
- `vitest.config.ts`
- `playwright.config.ts`
- `src/test/*`
- `tests/e2e/*`

## Tests To Build
- Unit:
  - pricing calculator.
  - roadmap unlock engine.
  - task status transitions.
  - slug generation.
  - provider sandbox adapters.
  - schema/validation helpers.
- Integration:
  - onboarding to company activation.
  - task creation/session start.
  - file upload/version/archive.
  - settings persistence.
  - billing upgrade.
  - integration connect/check.
- E2E:
  - public homepage/pricing/resources/how-to.
  - login/sandbox auth.
  - personal onboarding.
  - company onboarding.
  - canvas/departments/roadmap.
  - task/agent/chat/files.
  - settings/billing.

## APIs/DB To Wire
- Test database seed/reset.

## Decisions To Make
- Browser matrix.
- CI command set.

## Completion Criteria
- [x] Unit tests pass.
- [x] Integration tests pass.
- [x] E2E tests pass.
- [x] CI skeleton runs checks.
- [x] Final audit can begin.
- [x] Verification pass clean.
- [x] `checkpoint-18.md` written.

---

# Final Audit

## Procedure
- Read `docs/product-spec.md` line by line.
- For every feature, page, workflow, component, state, API, and entity:
  - Verify it exists.
  - Verify it is wired.
  - Verify it is not a TODO/stub.
  - Verify it matches the notes or is logged as an assumption.
- Output audit table:
  - Feature/Page/Component
  - Status
  - Notes
- Fix every partial/missing item.

## Completion Criteria
- [x] Audit table is 100% built.
- [x] No partial/missing items remain.
- [x] `SCRATCHPAD.md` says build complete.
- [x] Final checkpoint written.
