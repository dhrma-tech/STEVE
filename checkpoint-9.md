# checkpoint-9.md

## Phase
Execution Phase 8 - Roadmap And Tech Tree

## Status
Complete.

## What Was Built
- Full roadmap API:
  - `GET /api/orgs/:orgId/roadmap`
  - `GET /api/orgs/:orgId/roadmap/items/:itemId`
  - `POST /api/orgs/:orgId/roadmap/items/:itemId/launch`
  - `POST /api/orgs/:orgId/roadmap/items/:itemId/complete`
- Roadmap structure and unlock engine using existing frozen schema.
- Central roadmap metadata in `src/data/roadmap.ts`:
  - work type labels.
  - status labels.
  - source-stage descriptions.
  - deterministic dependency pairs.
- Idempotent roadmap sync for existing organizations:
  - creates missing stages/items.
  - creates dependency edges.
  - computes locked/available states.
  - updates `Organization.roadmapProgress`.
- Launch behavior:
  - agent items create or reuse queued agent tasks.
  - user-input items return a required-input conflict until input is provided.
  - approval items create blocked approval tasks and pending `Approval` rows.
- Complete behavior:
  - marks roadmap item complete.
  - completes active linked tasks.
  - unlocks downstream available items when dependencies are satisfied.
  - recalculates progress.
- Full-screen dark roadmap modal opened from `/org/:orgId/canvas?open_tech_tree=1`.
- Horizontal stage board with all source-listed stages and item cards.
- Stage progress counts and progress bars.
- Card states: complete, available, locked.
- Card labels: Agent can do this, Needs your input, Needs approval, Needs earlier steps first.
- Detail panel with title/status, what becomes true, how to move forward, required first, unlocks, launch action, mark-complete action, and linked tasks.
- Dependency overview mode with dashed dependency summaries.
- Mature stage renders as an empty source-gap shell.
- Canvas query handling now responds when `?open_tech_tree=1` is added without a full remount.
- Activation and seed flows now write the full Phase 8 dependency graph for future organizations.
- `REGISTRY.md`, `SCRATCHPAD.md`, `OPEN-QUESTIONS.md`, and `DECISIONS.md` updated.

## Verification Pass
| Requirement | Status | Notes |
|---|---|---|
| All listed stages and items exist | built | API smoke returned 8 stages and 32 source-listed items. Mature exists as a stage shell with 0 items. |
| Dependencies lock/unlock correctly | built | API smoke returned 43 dependency edges; completing `brand_identity` updated progress and unlocked downstream items. |
| Detail panel has all required sections | built | Browser verified What becomes true, How to move forward, Required first, Completing this unlocks, and Dependency graph. |
| Launch creates task or asks input/approval | built | Agent launch created a queued task; user launch without input returned 409 `input_required`; approval launch created pending approval. |
| Roadmap progress updates | built | API smoke moved progress from 9% to 13% after completing an available item. |
| Full-screen dark modal exists | built | Browser opened `/canvas?open_tech_tree=1` and verified the Roadmap tech tree modal. |
| Horizontal stage board exists | built | Browser verified source stages and the Mature shell in the modal board. |
| Card states and labels exist | built | Cards render complete/available/locked and work-type labels from the roadmap API. |
| Dependency overview exists | built | Browser switched to Dependencies mode and verified dependency in/out summaries. |
| TypeScript and lint pass | built | `pnpm verify` passed. |
| Production build passes | built | `pnpm build` passed and includes all roadmap routes. |
| Browser console errors | built | Browser dev logs reported 0 console errors during roadmap smoke. |

## API Flow Verified
Authenticated sandbox session against `http://localhost:3000` returned:
- Stages: 8
- Items: 32
- Mature items: 0
- Dependencies: 43
- Available before completion: 2
- Locked before completion: 27
- Agent launch candidate: `brand_identity`
- Launch result: `task_created`
- Task status: `queued`
- Complete result: `completed`
- Progress before: 9%
- Progress after: 13%
- User launch candidate: `define_positioning`
- User launch without input: HTTP 409, `input_required`
- Approval launch candidate: `incorporate_llc`
- Approval launch result: `approval_requested`
- Approval status: `pending`

## Browser Flow Verified
- Opened `/org/:orgId/canvas?open_tech_tree=1`.
- Verified the Roadmap tech tree modal opens from the query param.
- Verified stages:
  - IDEA STAGE
  - INITIAL STAGE
  - IDENTITY STAGE
  - BUILD STAGE
  - GTM STAGE
  - LAUNCH STAGE
  - SCALE STAGE
  - MATURE STAGE shell
- Verified detail sections:
  - What becomes true
  - How to move forward
  - Required first
  - Completing this unlocks
  - Dependency graph
- Selected `Define positioning` and clicked Provide input without text; UI displayed the required input error.
- Switched to Dependencies mode and verified dependency in/out summaries.
- Browser console error count: 0.

## Assumptions Made This Phase
- [ASSUMPTION-15] Exact roadmap dependency edges are not specified item by item, so deterministic dependencies follow source stage order and documented unlock-chain behavior.
- [QUESTION-21] Mature stage item list is not specified, so Mature renders as a source-gap shell.

## Deviations From Plan
- No schema migration was needed. Roadmap dependencies, tasks, approvals, and progress updates use the Phase 1 frozen schema.
- Launching approval items creates a blocked task plus a pending `Approval` row rather than executing immediately.
- The full Tasks UX is deferred to Phase 9; Phase 8 creates/links roadmap tasks so Phase 9 has real task data to expand.

## Decisions Added
- [ASSUMPTION-15] Use source-listed stage order plus documented unlock-chain behavior to define roadmap dependencies.
- [DECISION-38] Idempotently sync roadmap stages, items, and dependency edges before roadmap reads/writes.
- [DECISION-39] Render Mature as an empty source-gap stage shell.
- [DECISION-40] Use `roadmapDefinitions` work types as the launch defaults.

## Open Questions Raised
- [QUESTION-20] Exact roadmap dependency edges are not specified item by item.
- [QUESTION-21] Mature stage item list is not specified.

## What The Next Phase Depends On
- Re-read `SCRATCHPAD.md`, this checkpoint, `REGISTRY.md`, `docs/product-spec.md`, `docs/source-analysis.md`, `docs/api-spec.md`, and Execution Phase 9 in `docs/implementation-plan.md`.
- Build the task system over existing roadmap-launched tasks, including creation, assignment, views, subtasks, comments, attachments, and approval handling.
