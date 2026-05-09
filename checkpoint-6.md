# checkpoint-6.md

## Phase
Execution Phase 5 - App Shell

## Status
Complete.

## What Was Built
- Authenticated `/org/[orgId]/*` layout using the existing Phase 4 auth/org guards.
- Dark app shell with left rail, top-left company switcher/avatar, responsive topbar, breadcrumb, search trigger, action menu, bottom-left inbox/new-task affordances, and mobile bottom navigation.
- Right side panel tab shell with Home, Cofounder, Company, Tasks, and Library tabs backed by real org counts/statuses.
- Command palette with `Ctrl+K` / `Meta+K`, grouped search, and keyboard-accessible dialog behavior.
- Inbox panel with derived notification items, populated/empty states, read-one, and read-all flows.
- Upgrade modal shell reachable from the app action menu.
- Org shell data library, grouped search library, and inbox derivation/read-state library.
- API routes:
  - `GET /api/orgs/:orgId/search`
  - `GET /api/orgs/:orgId/inbox`
  - `POST /api/orgs/:orgId/inbox/:notificationId/read`
  - `POST /api/orgs/:orgId/inbox/read-all`
  - `GET /api/orgs/:orgId/canvas/view-state`
  - `PUT /api/orgs/:orgId/canvas/view-state`
- Phase 5 components registered in `REGISTRY.md`.

## Verification Pass
| Requirement | Status | Notes |
|---|---|---|
| App shell wraps all org routes | built | `/org/[orgId]/layout.tsx` wraps authenticated org children with `AppShell`. Browser smoke verified shell around `/org/:orgId/onboarding`. |
| Auth/org guards work | built | Layout calls `getOrgShellData`, which uses `requireOrgMember`; unauthenticated users redirect to `/login`, forbidden org access returns not-found. |
| Breadcrumb updates | built | Breadcrumb derives organization, route section, and drill/query params from pathname/search params. |
| Search returns grouped results | built | API smoke returned 5 groups for `q=Business`; command palette browser smoke displayed grouped results. |
| Command palette works | built | `Ctrl+K` / search trigger opens palette; results navigate to org-scoped URLs. |
| Inbox populated state works | built | API smoke returned 9 derived inbox items for an active seeded org. |
| Inbox read-one works | built | API smoke reduced unread count from 9 to 8 after marking one notification read. |
| Inbox read-all/empty state works | built | API smoke reduced unread count to 0; panel has all-caught-up empty state. |
| Canvas view state endpoint persists | built | API smoke wrote `{ x: 12, y: -24, zoom: 1.25 }` with selected engineering node and read it back. |
| Upgrade modal opens from menu | built | Playwright opened action menu, selected Upgrade plan, and verified Cofounder Pro content. |
| Responsive mobile app navigation works | built | Playwright mobile check verified bottom app nav, search icon, inbox button, and no horizontal overflow. |
| TypeScript and lint pass | built | `pnpm verify` passed. |
| Production build passes | built | `pnpm build` passed and includes all Phase 5 API routes. |

## API Flow Verified
Fresh sandbox user and active organization were created, onboarded, activated, and design-approved. Phase 5 endpoints then returned:
- Search groups: 5
- Search items for `Business`: 1
- Inbox items: 9
- Unread before read: 9
- Unread after one read: 8
- Unread after read-all: 0
- Canvas view state selected node: `department:engineering`
- Canvas view state zoom: `1.25`

## Assumptions Made This Phase
- [ASSUMPTION-13] Inbox item persistence is read-state only until a dedicated notification/event table is specified.

## Deviations From Plan
- No schema migration was added. Inbox item storage is derived from existing records and read state is stored in `AuditLog`.
- `.next/dev` generated validator files are excluded from `tsconfig.json` checks because Next dev re-adds the include automatically and the dev-only validator conflicts with phase-gated dynamic route typing.

## Decisions Added
- [DECISION-27] Derive inbox notifications from existing records and store read markers in `AuditLog`.
- [DECISION-28] Use `Ctrl+K` / `Meta+K` for the command palette.
- [DECISION-29] Use compact bottom mobile nav for app shell actions.
- [DECISION-30] Exclude `.next/dev` generated validator files from TypeScript checks.
- [ASSUMPTION-13] Inbox item persistence is read-state only.

## Open Questions Raised
- [QUESTION-18] The frozen schema contains notification preferences but no dedicated notification item table.

## What The Next Phase Depends On
- Re-read `SCRATCHPAD.md`, this checkpoint, `REGISTRY.md`, `docs/product-spec.md`, `docs/source-analysis.md`, `docs/api-spec.md`, and Execution Phase 6 in `docs/implementation-plan.md`.
- Build `/org/[orgId]/canvas` inside the Phase 5 shell with React Flow canvas, Cofounder node, 8 department nodes, connectors, pan/zoom, side-panel tab content, and query-param modal/session shells.
