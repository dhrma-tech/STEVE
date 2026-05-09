# SCRATCHPAD.md

## Current Phase And Status
- Current phase: Execution - Phase 17: Final System Audit & Performance
    - [x] Phase 16: Error, Loading And Empty States (complete and verified)
    - [ ] Conduct final deep-dive audit of all 16 previous phases
    - [ ] Optimize bundle sizes and asset delivery
    - [ ] Verify production-readiness (env vars, secure headers)
    - [ ] Finalize implementation-plan.md as 100% complete
    - [ ] Write final-completion-report.md
- Phase 16: complete and verified.
- Phase 15: complete and verified.
- Phase 14: complete and verified.
- Phase 13: complete and verified.
- Phase 1 docs: complete and verified.
- Application code: foundation, design system, public website, auth, personal onboarding, company onboarding, activation, design onboarding, authenticated app shell, React Flow canvas/dashboard, departments, roadmap, tasks, agents, chat, files, settings/billing, responsive design, and animations are built.
- Repository root: `C:\Users\ACER\OneDrive\Music\Documents\Playground\STEVE`.

## Phase 16 Notes
- **Standardization:** Created `AppError` and `mapError` utility. Updated `routeError` to handle database and internal errors gracefully.
- **Redesign:** Upgraded `Loading`, `ErrorPage`, `NotFound`, and `EmptyState` to premium aesthetics with `framer-motion`.
- **Boundaries:** Created `loading.tsx` and `error.tsx` for `src/app/org/[orgId]/` to polish workspace transitions.
- **Build:** Production build passed exit 0 after fixing `EmptyState` and `Link` type issues.

## Phase 15 Notes
- **New motion primitives:** `SpringButton`, `PanelSlide`, `ScaleFade` (spring-button.tsx); `AnimatedList`, `AnimatedListItem`, `AgentPulseDot` (animated-list.tsx).
- **CSS keyframes:** `node-select-pop`, `panel-slide-in`, `tab-content-fade`, `agent-pulse`, `counter-up`, `node-breath`, `modal-enter`, `modal-exit`.
- **Wired:** `TaskList` stagger, `AgentList` stagger + running pulse dot, `MarketplaceSkills` stagger, `CofounderNode` idle breath, `DepartmentNode` selection pop, all `TabsContent` fade, `CanvasSidePanel` slide-in, `DialogContent` upgraded modal enter.
- **Build:** Production build passed exit 0, TypeScript clean, 26 static pages generated.

## Phase 14 Notes
- **Login Block:** Resolved by moving `dev.db` to `prisma/` folder where `lib/db/client.ts` expects it.
- **Settings UX:** Mobile sidebar now scrolls horizontally. Redundant headers hidden.
- **Validation:** Added non-empty check for "Preferred name" in settings.

## Decisions Made And Why
- [DECISION-01] Use the cloned `STEVE` folder as the product repository root - it is the empty Git checkout requested immediately before this build.
- [DECISION-02] Treat source-note certainty in this order: [VERIFIED] > [OBSERVED] > [INFERRED] > [UNKNOWN] - the notes use those labels explicitly and the precision gap-fill contains corrections to earlier reports.
- [DECISION-03] Do not copy proprietary Cofounder imagery, wordmarks, or licensed fonts - the UI/UX note explicitly says to create original assets and use alternatives where needed.
- [DECISION-04] Use a single Next.js TypeScript app - empty repo, broad route surface, and shared UI make a single app the simplest reliable base.
- [DECISION-05] Use React Flow for the canvas - verified in source notes.
- [DECISION-06] Use REST route handlers - aligns with endpoint-oriented source notes and the API spec.
- [DECISION-07] Use Prisma migrations - supports the user's schema freeze/migration rule.
- [DECISION-08] Use local SQLite with a PostgreSQL-compatible logical schema - enables local verification without external database setup.
- [DECISION-09] Use sandbox adapters by default - external credentials are absent.
- [DECISION-10] Use pnpm - installed locally and deterministic.
- [DECISION-11] Pin package versions from npm lookup on 2026-05-08 - avoids guessing current versions.
- [DECISION-12] Store logical enum/json fields as text in SQLite Prisma - application validation preserves the frozen logical schema while local migrations can run.
- [DECISION-13] Apply Prisma-generated SQLite migration through a local script - Prisma can generate SQL but `migrate dev` crashes in this environment.
- [DECISION-14] Use Prisma 7.8.0 and the better-sqlite3 adapter - needed for Node 24 and Prisma 7 direct SQLite connections.
- [DECISION-15] Approve pnpm build scripts only for native/tooling packages needed by the setup.
- [DECISION-16] Use Radix UI primitives for interactive controls - preserves keyboard and focus behavior.
- [DECISION-17] Use `lucide-react` as the icon set - broad coverage and matches the UI guidance.
- [DECISION-18] Use `framer-motion` behind local wrappers - centralizes reduced-motion support.
- [ASSUMPTION-08] Keep `Departure Mono` as a future/local font stack name and load IBM Plex Mono as fallback - no licensed Departure Mono asset exists in the repo.
- [DECISION-19] Disable Next typed routes during phase-gated implementation - public CTAs point to later-phase routes before those routes exist.
- [DECISION-20] Use original CSS pixel-art and interface mockups for public visuals - avoids copied proprietary assets.
- [DECISION-21] Use `/terms` as canonical and redirect `/terms-of-service` - resolves legal route conflict.
- [ASSUMPTION-09] Pricing calculator formulas are sandbox estimates - exact math was not specified.
- [ASSUMPTION-10] Legal and docs pages are product-surface content shells - exact reviewed copy was not specified.
- [DECISION-22] Use signed first-party HMAC cookies for local sessions - avoids adding a session table after schema freeze.
- [DECISION-23] Implement GitHub OAuth provider mode with a state cookie/callback, and use sandbox fallback only when credentials are absent - keeps local auth verifiable.
- [DECISION-24] Add partial profile progress saving with `PATCH /api/onboarding/profile` - required for onboarding resume.
- [DECISION-25] Use deterministic sandbox generators for AI onboarding artifacts - external AI credentials and exact prompts are absent.
- [DECISION-26] Store design onboarding state in existing `OnboardingAnswer` rows - avoids a schema migration.
- [ASSUMPTION-11] GitHub OAuth credentials/callback URL are absent locally - provider code is implemented but local verification uses sandbox.
- [ASSUMPTION-12] Exact AI wording and brand-kit output are unspecified - sandbox output supplies the required structures.
- [DECISION-27] Derive inbox notifications from existing workspace records and use `AuditLog` read markers - no notification item table exists in the frozen schema.
- [DECISION-28] Use `Ctrl+K` / `Meta+K` for command palette - common keyboard access for global search.
- [DECISION-29] Use compact bottom mobile nav - preserves app actions on narrow screens.
- [DECISION-30] Exclude `.next/dev` generated validator files from TypeScript checks - Next dev adds them automatically and production types remain checked.
- [ASSUMPTION-13] Inbox persistence is read-state only until a dedicated notification table is specified.
- [DECISION-31] Add `@xyflow/react` 12.10.2 for the workspace canvas - React Flow is verified in the notes.
- [DECISION-32] Use deterministic circular node positions - all 8 department nodes must be immediately visible and reproducible.
- [DECISION-33] Use a route-specific canvas side panel on `/canvas` - department selection needs to drive the panel.
- [DECISION-34] Keep roadmap and agent-session query handling as functional shells in Phase 6 - full implementations are scheduled in Phase 8 and Phase 10.
- [DECISION-35] Use deterministic generated CSS department covers - notes require original/generated covers and no licensed local department image files exist.
- [DECISION-36] Keep Support, Operations, Finance, and Legal inspectable while showing coming-soon availability until Phase 8 unlock logic.
- [ASSUMPTION-14] Department setup prompt/context copy is deterministic product copy derived from department responsibilities because exact wording is unspecified.
- [DECISION-37] Normalize legacy `/assets/departments/*.webp` cover paths to generated cover keys at serialization - existing local data remains usable without schema changes.
- [ASSUMPTION-15] Use source-listed stage order plus documented unlock-chain behavior to define roadmap dependencies.
- [DECISION-38] Idempotently sync roadmap stages/items/dependencies before roadmap reads/writes to retrofit existing orgs without schema changes.
- [DECISION-39] Render Mature as an empty source-gap stage shell because no Mature items are listed.
- [DECISION-40] Use `roadmapDefinitions` work types as launch defaults for agent/user/approval behavior.
- [ASSUMPTION-16] Treat the new-task "app dropdown" as an execution target selector (`staging`, `production`, `repository`, `integration`) because the task notes name the dropdown but do not define an App entity or option list.
- [DECISION-41] Use status-specific board columns and a compact week-strip calendar for Phase 9 - this keeps desktop and mobile task views usable inside the right side panel.
- [DECISION-42] Use optimistic updates only for local task UI refreshes after successful mutations - avoids rollback complexity for comments, files, approvals, and session creation.
- [DECISION-43] Use deterministic sandbox execution actions for Phase 10 agent runs - external agent infrastructure is unavailable locally, and the architecture already calls for simulated actions/logs in sandbox mode.
- [ASSUMPTION-17] Agent marketplace skills are sourced from the documented department responsibilities and named integration surfaces - the notes require marketplace/skills but do not provide a canonical marketplace catalog.
- [DECISION-44] Keep a repeatable Phase 10 Chrome CDP smoke runner in `artifacts/phase10-browser-smoke.cjs` - the in-app browser runtime failed in this session, and a reusable local browser check verifies the agent center and workspace console state without adding test dependencies.
- [DECISION-45] Implement Phase 11 chat as request/response APIs with an optimistic streaming/typing UI and SSE-ready metadata - no websocket/SSE provider is specified, and this keeps chat verifiable in local sandbox mode.
- [ASSUMPTION-18] Persist chat message attachments in `ChatMessage.metadataJson.fileIds` plus existing `File` rows when users pick local files - the frozen schema has no chat-message/file join table.
- [DECISION-46] Keep a repeatable Phase 11 Chrome CDP smoke runner in `artifacts/phase11-browser-smoke.cjs` - the Browser plugin runtime remained unavailable, and local CDP verifies the rendered chat surface and console state without adding dependencies.
- [ASSUMPTION-19] File binary storage provider/path is unspecified; Phase 12 uses logical storage keys and safe preview metadata in the existing frozen schema.
- [DECISION-47] Use `orgs/{orgId}/files/...` logical storage keys for uploads/versions so future object storage can attach without a migration.
- [DECISION-48] Inline-preview text, markdown, JSON, and CSV; show metadata previews for image/PDF/office/unknown files until a renderer/provider is specified.
- [ASSUMPTION-20] Live provider credentials for Stripe, Vercel, Supabase, Postiz, Apify, email/domain, analytics, and monitoring are absent locally; Phase 13 will use explicit sandbox adapter states backed by provider records.
- [DECISION-49] Store provider settings in existing `Integration.configJson` and provider events in `IntegrationEvent`, with secrets stored only as write-only redacted ciphertext metadata in `Secret`.
- [DECISION-50] Require exact typed confirmations for destructive settings actions such as importing an own Supabase project or switching to an own GitHub repo.

## Open Questions Mirror
- [QUESTION-01] Three source files appear truncated at their own ends: `# Cofounder.co - Complete Developer.txt`, `# Cofounder.co - Complete UIUX Desi.txt`, and `Cofounder.co - Full Product Teardow.txt`.
- [QUESTION-02] Routes conflict between `/terms`, `/terms-of-service`, and docs route handling (`https://docs.cofounder.co/` vs `/docs`).
- [QUESTION-03] Auth screen descriptions conflict: one source describes a split screen, while the precision gap-fill verifies a centered login layout.
- [QUESTION-04] Floating hero badge background conflicts: older notes say dark-green glass; precision gap-fill verifies a white translucent gradient.
- [QUESTION-05] App department activation conflicts: all 8 departments are part of the system, but some notes say Support, Operations, Finance, and Legal appear as coming soon.
- [QUESTION-06] Production-grade external integrations require credentials and provider access not present in the repo.
- [QUESTION-13] Departure Mono is named in the notes, but no licensed local font file is present; IBM Plex Mono is the loaded fallback.
- [QUESTION-14] Pricing calculator exact formulas are not provided; sandbox estimator is labeled in UI.
- [QUESTION-15] Exact legal and documentation copy is not provided; content shells are flagged.
- [QUESTION-16] GitHub OAuth credentials/callback URL are not present; sandbox fallback is used locally.
- [QUESTION-17] Exact AI prompt/output contracts for company onboarding and brand-kit generation are not specified.
- [QUESTION-18] No dedicated notification item table exists in the frozen schema; inbox items are derived and read markers use `AuditLog`.
- [QUESTION-19] Exact department setup prompt and context-tab wording is not specified; deterministic department-specific copy is used.
- [QUESTION-20] Exact roadmap dependency edges are not specified item by item; deterministic dependencies follow stage order and unlock-chain behavior.
- [QUESTION-21] Mature stage item list is not specified; Mature renders as a source-gap shell.
- [QUESTION-22] The new-task app dropdown option list is not specified. [ASSUMPTION: use an execution target selector backed by deterministic app target values until integrations/apps are fully implemented.]
- [QUESTION-23] The exact agent marketplace/skills catalog is not specified. [ASSUMPTION: expose deterministic skills derived from departments and integration surfaces until a provider marketplace is specified.]
- [QUESTION-24] Chat requires file attachments, but the frozen schema has no chat-message/file join table. [ASSUMPTION: persist attached file IDs and generated upload records inside `ChatMessage.metadataJson` until a later explicit migration adds first-class chat attachments.]
- [QUESTION-25] File upload/storage lacks a specified binary object-storage provider, signed URL shape, or document renderer. [ASSUMPTION: use existing storage keys and metadata previews locally until provider settings exist.]
- [QUESTION-26] Settings file/avatar upload storage and external provider credential exchange are not specified. [ASSUMPTION: accept local JSON metadata/text and write-only secret values until real provider adapters and object storage are configured.]

## Drift Tracker
- Plan vs actual: on track. Application code began only after Phase 1 docs were complete.
- Source drift: three note files are incomplete/truncated; all missing tail content will be treated as unknown instead of invented.
- Schema drift: `docs/database-schema.md` now defines the frozen schema for future implementation.
- Path drift: initial patch landed in the workspace parent and was moved into `STEVE`; final repo location is correct.
- Implementation mapping: SQLite Prisma will represent logical enums/json as text; this is logged in DECISION-12.
- Toolchain drift: `prisma migrate dev` crashes with a blank schema-engine error; using generated SQL plus local apply script for Execution Phase 1.
- Environment drift: initial install failed because the C drive had 0 bytes free; pruned pnpm cache and retried successfully.
- Design drift: Departure Mono asset absent; logged in OPEN-QUESTIONS and DECISIONS with IBM Plex Mono fallback.
- Phase 3 environment drift: production build hit `ENOSPC` once; cleared generated `.next` output and pruned pnpm store, then build passed.
- Routing drift: Next typed routes are disabled while phase-gated future links exist; logged in DECISION-19.
- Phase 4 schema drift: none. Auth/session, partial onboarding, OAuth, and design state use existing frozen schema fields.
- Phase 4 provider drift: GitHub provider mode is implemented; local auth verification used the credential-free sandbox fallback logged in ASSUMPTION-11.
- Phase 4 API drift: `PATCH /api/onboarding/profile` was added and documented so partial personal onboarding progress persists cleanly.
- Phase 5 schema drift: none. Inbox state, search, org shell, and view state use existing schema fields.
- Phase 5 API drift: search and inbox endpoints are now implemented from the Phase 1 API spec; inbox item records are derived rather than stored.
- Phase 5 tooling drift: Next dev re-added `.next/dev/types/**/*.ts` to `tsconfig.json`; `.next/dev` is excluded to keep dev-only validators out of normal typecheck.
- Phase 6 schema drift: none. Canvas data and view state use existing departments, agents, tasks, files, roadmap, chat, and `CanvasViewState`.
- Phase 6 package drift: added `@xyflow/react` because React Flow behavior is a source requirement and was missing from dependencies.
- Phase 6 route drift: generic shell side panel is hidden on `/canvas`; the canvas route owns the interactive side panel.
- Phase 7 schema drift: none. Department list/detail/context APIs use existing Department, Agent, Task, File, RoadmapItem, and AuditLog fields.
- Phase 7 asset drift: nonexistent `/assets/departments/*.webp` seed/activation cover paths are replaced with generated cover asset keys and CSS-rendered cover art.
- Phase 7 compatibility drift: existing local rows with old cover paths are normalized in serializers instead of requiring a data migration.
- Phase 8 schema drift: none. Roadmap API, launch, complete, approvals, tasks, and unlocks use existing RoadmapStage, RoadmapItem, RoadmapDependency, Task, Approval, Agent, and Organization fields.
- Phase 8 dependency drift: exact edge list is unspecified in notes, so deterministic dependency pairs are logged under ASSUMPTION-15 and centralized in `src/data/roadmap.ts`.
- Phase 8 dev-server drift: `pnpm dev -- -p 3000` passes `--` through to Next and fails; use `pnpm dev -p 3000` when starting local dev manually.
- Phase 9 schema drift: none planned. Task features will use existing Task, Subtask, TaskSession, ChatThread/ChatMessage, File, Approval, Department, Agent, and User fields.
- Phase 9 schema drift: none. Task creation, views, subtasks, comments, attachments, approvals, and sessions use existing frozen schema fields.
- Phase 9 UI drift: explicit `?tab=tasks` and `?task=...` query params now override persisted selected department state so task links open the task surface.
- Phase 9 verification drift: the first production rebuild failed because the dev-server log was written inside `.next`; the dev server was stopped, the locked log removed, and the rebuild passed.
- Phase 10 schema drift: none. Agent CRUD, inboxes, sessions, actions, scratchpads, marketplace skills, and task chat use existing frozen schema fields.
- Phase 10 UI drift: initial browser smoke caught a nested-button React warning in `AgentList`; the agent card is now an `article` with separate selection and action buttons.
- Phase 10 accessibility drift: Agent create/workspace dialogs now include descriptions and the app has a first-party `/icon.svg` to avoid noisy browser resource errors.
- Phase 10 tooling drift: the in-app browser runtime failed with a local kernel asset path error, so Phase 10 browser verification uses the repeatable Chrome CDP smoke runner in `artifacts/phase10-browser-smoke.cjs`.
- Phase 10 environment drift: C: reached 0 bytes free during repeated browser/build passes. Only generated `.next`, Node cache, Phase 10 Chrome temp profiles, and the temporary dev log were cleared; the dev server was restarted on port 3010 with output discarded.
- Phase 11 schema drift: none. Chat threads, messages, mentions, attachments, task chat, and sandbox AI responses use existing ChatThread, ChatMessage, File, Department, Agent, Task, and User fields.
- Phase 11 transport drift: no websocket/SSE provider is specified, so chat uses request/response APIs with optimistic streaming/typing UI and SSE-ready response metadata.
- Phase 11 attachment drift: chat attachment relationships are stored in message metadata and generated File rows because no chat-message/file join table exists in the frozen schema.
- Phase 11 tooling drift: Browser plugin runtime remained unavailable; verification uses `artifacts/phase11-browser-smoke.cjs`, matching the Phase 10 CDP fallback pattern.
- Phase 12 schema drift: none planned. File library upload, folder navigation, versioning, sharing, preview, and archive use existing Folder, File, and FileVersion rows.
- Phase 12 storage drift: binary object storage is unspecified, so local uploads persist metadata/preview text plus logical storage keys instead of adding storage tables or filesystem blobs.
- Phase 12 tooling drift: Browser plugin runtime remains unavailable; verification uses `artifacts/phase12-files-smoke.cjs` with Chrome CDP and includes library plus department-panel file checks.
- Phase 13 schema drift: none planned. Settings, billing, integrations, secrets, domains, agent inboxes, preferences, and usage will use existing frozen tables.

## Next Phase Depends On
- Phase 13 depends on wiring settings routes/forms, billing/upgrade, provider connect/check/disconnect, Postiz channels, write-only secrets, and destructive confirmations without schema changes.
