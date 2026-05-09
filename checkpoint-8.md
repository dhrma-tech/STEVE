# checkpoint-8.md

## Phase
Execution Phase 7 - 8 Department System

## Status
Complete.

## What Was Built
- `GET /api/orgs/:orgId/departments` for all department summaries with availability, default agent, counts, cover asset key, and labels.
- `GET /api/orgs/:orgId/departments/:departmentId` for department detail by id or slug, including agents, tasks, files, context, visual metadata, and roadmap strip items.
- `PATCH /api/orgs/:orgId/departments/:departmentId/context` guarded by org admin, storing context in existing `Department.contextJson` and logging an `AuditLog` entry.
- `src/data/departments.ts` with deterministic generated cover art metadata, setup prompts, launch prompt labels, and context tabs for all 8 departments.
- Department UI components:
  - `DepartmentCover`
  - `DepartmentDetailPanel`
  - `DepartmentSections`
  - `DepartmentContextTabs`
  - `DepartmentRoadmapStrip`
  - `DepartmentBoardDialog`
- Canvas integration:
  - selecting a department opens the full detail panel.
  - double-click/open board shows setup prompt, context tabs, attachments, launch CTA, and roadmap strip.
  - active department launch CTA opens the Phase 6 agent workspace shell.
  - coming-soon department CTAs are visible but disabled.
- Activation and seed flows now write generated department cover asset keys for future organizations.
- Existing local rows with old `/assets/departments/*.webp` paths are normalized at serialization so no schema or data migration is needed.
- `REGISTRY.md`, `SCRATCHPAD.md`, `OPEN-QUESTIONS.md`, and `DECISIONS.md` updated.

## Verification Pass
| Requirement | Status | Notes |
|---|---|---|
| All 8 departments visible and inspectable | built | API returned 8 departments; browser snapshot found Engineering, Marketing, Sales, Design, Support, Operations, Finance, and Legal. |
| Active/locked/coming-soon states match spec assumptions | built | API smoke returned 4 active and 4 coming-soon departments: Support, Operations, Finance, Legal. |
| Every department has default agent, description, cover, tasks/files/context sections | built | API smoke returned 8 default agents and 8 generated cover keys; browser verified Engineering and Support sections. |
| Department board supports setup prompt and launch CTA | built | Browser opened Engineering board and verified setup prompt, context tabs, attachments, roadmap strip, and Launch Engineering Agent CTA. |
| Coming-soon departments remain inspectable | built | Browser inspected Support detail, verified Support Agent context, sections, coming-soon label, and disabled Prepare Support Agent CTA. |
| Department context update works | built | API PATCH for Engineering context returned `phase7Smoke: passed` and wrote through the context route. |
| Launch CTA works for active departments | built | Browser clicked Launch Engineering Agent and verified the Agent workspace shell with Browser, Scratchpad, and Replay sections. |
| Registry updated | built | New department components are listed in `REGISTRY.md`. |
| TypeScript and lint pass | built | `pnpm verify` passed. |
| Production build passes | built | `pnpm build` passed and includes department API routes. |
| Browser console errors | built | Browser dev logs reported 0 console errors during Phase 7 smoke. |

## API Flow Verified
Authenticated sandbox session against `http://localhost:3000` returned:
- Departments: 8
- Active departments: 4
- Coming soon departments: 4
- Default agents: 8
- Generated cover keys: 8
- Engineering detail: 1 agent, tasks/files/context sections, 8 roadmap strip items
- Patched context key: `phase7Smoke = passed`

## Browser Flow Verified
- Opened `/org/:orgId/canvas`.
- Verified all 8 department names render on the canvas.
- Clicked Engineering node and verified:
  - generated department cover.
  - Department detail heading.
  - default Engineering Agent.
  - Agents, Tasks, Files, and Context sections.
  - Launch Engineering Agent and Open board actions.
- Opened Engineering board and verified:
  - setup prompt.
  - context tabs.
  - attachments area.
  - roadmap strip.
  - launch CTA.
- Clicked Support node and verified:
  - coming-soon state.
  - default Support Agent.
  - Agents, Tasks, Files, and Context sections.
  - disabled Prepare Support Agent CTA.
- Clicked Launch Engineering Agent and verified the agent workspace shell opens.

## Assumptions Made This Phase
- [ASSUMPTION-14] Exact department setup prompt and context-tab wording is not specified in the notes, so deterministic department-specific copy is derived from documented department responsibilities.

## Deviations From Plan
- No schema migration was needed. Department context, cover asset keys, summary counts, agents, tasks, files, roadmap items, and audit logging all use the Phase 1 frozen schema.
- Existing local departments had old placeholder `/assets/departments/*.webp` values. These are normalized at serialization rather than migrated.
- Full roadmap unlock logic remains in Phase 8; Phase 7 only displays coming-soon availability and linked roadmap strip items.

## Decisions Added
- [DECISION-35] Use deterministic generated CSS cover assets for departments.
- [DECISION-36] Keep Support, Operations, Finance, and Legal inspectable while displaying coming-soon availability.
- [ASSUMPTION-14] Department setup prompt and context-tab copy is deterministic product copy derived from department responsibilities.
- [DECISION-37] Normalize legacy `/assets/departments/*.webp` cover paths to generated cover keys at serialization.

## Open Questions Raised
- [QUESTION-19] Exact department setup prompt and context-tab wording is not specified in the notes.

## What The Next Phase Depends On
- Re-read `SCRATCHPAD.md`, this checkpoint, `REGISTRY.md`, `docs/product-spec.md`, `docs/source-analysis.md`, `docs/api-spec.md`, and Execution Phase 8 in `docs/implementation-plan.md`.
- Build the full roadmap and tech tree system using `RoadmapStage`, `RoadmapItem`, and `RoadmapDependency`.
- Preserve the frozen schema unless Phase 8 discovers a required schema change, in which case a migration and DECISIONS entry are mandatory.
