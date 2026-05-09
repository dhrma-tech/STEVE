# checkpoint-11.md

## Phase
Execution Phase 10 - Agents

## Status
Complete.

## What Was Built
- Agent data layer in `src/lib/agents/data.ts` for workspace summaries, agent detail, creation, configuration updates, launch, session fetch, session action advancement, and scratchpad persistence.
- Deterministic sandbox execution queue in `src/lib/queue/sandbox-execution.ts`, shared by direct agent launch and task start flows.
- Agent API handlers:
  - `GET/POST /api/orgs/:orgId/agents`
  - `GET/PATCH /api/orgs/:orgId/agents/:agentId`
  - `POST /api/orgs/:orgId/agents/:agentId/launch`
  - `GET /api/orgs/:orgId/sessions/:sessionId`
  - `GET/POST /api/orgs/:orgId/sessions/:sessionId/actions`
  - `PATCH /api/orgs/:orgId/sessions/:sessionId/scratchpad`
- Agent UI components:
  - `AgentControlCenter`
  - `AgentList`
  - `MarketplaceSkills`
  - `AgentCreateDialog`
  - `AgentConfigPanel`
  - `AgentWorkspaceDialog`
- Canvas/company integration:
  - App shell Agents nav opens the Company tab.
  - Canvas `?agent=...` selects the Company agent surface.
  - Canvas `?session=...` opens the full Phase 10 agent workspace.
  - Phase 6/9 temporary agent workspace shell is replaced with the full workspace.
- Agent workspace features:
  - Agent Browser, Scratchpad, and Replay tabs.
  - Copy link, fullscreen, and open-browser controls.
  - Action log with run-next/finish controls.
  - Task chat with timestamps, message copy, markdown/code/thinking rendering, attachments, and composer.
  - Header info, go-back control, and more-options menu.
- Agent marketplace/skills catalog in `src/data/agents.ts`, derived from departments plus named integration surfaces.
- First-party app icon at `src/app/icon.svg`.
- Repeatable browser smoke runner at `artifacts/phase10-browser-smoke.cjs`.

## Assumptions Made This Phase
- [ASSUMPTION-17] The exact agent marketplace/skills catalog is not specified, so marketplace skills are deterministic department/integration capabilities.

## Decisions Added
- [DECISION-43] Use deterministic sandbox execution actions for Phase 10 agent runs.
- [ASSUMPTION-17] Agent marketplace skills are deterministic department/integration capabilities.
- [DECISION-44] Keep a repeatable Phase 10 Chrome CDP smoke runner for local browser verification.

## Verification Pass
| Requirement | Status | Notes |
|---|---|---|
| Default agents per department | built | Existing seeded/default agents load in the agent center and are included in department context. |
| New Agent button | built | Company tab exposes `New Agent`; API create path is wired and browser-rendered agent cards refresh by route. |
| Agent profile/configuration | built | Name, department, model, prompt personalization, tools/skills, status, inbox, and permissions are editable. |
| Launch task/session | built | Agent launch creates a task session and opens the workspace. |
| Running/finished statuses update | built | Sandbox action advancement updates session, task, and agent statuses. |
| Execution monitoring | built | Elapsed time, status badges, action log, task chat, browser, scratchpad, and replay state are visible. |
| Marketplace/skills panel | built | Skills panel filters by selected agent department and integration skills. |
| Agent inbox email assignment | built | Agent create/update persists `AgentInbox` and `InboxDomain` records. |
| Agent Workspace title/panel | built | Session query opens `Agent Workspace` dialog over the canvas. |
| Agent Browser tab | built | Shows embedded local/staging URL plus copy, fullscreen, and open controls. |
| Scratchpad tab | built | Scratchpad is editable and persists through the scratchpad API. |
| Replay tab/loading state | built | Running sessions show recording state; completed sessions expose replay link. |
| Right task chat header/info/more/go back | built | Header shows agent, task status/update time, go back, and options menu. |
| Markdown/thinking/code/links/timestamps/copy | built | Task chat renders thinking blocks, code fences, URL links, timestamps, and copy buttons. |
| Composer with mentions/files/submit | built | Composer supports mention-style text, file picker attachment names, and submit to task comments. |
| Loading/empty/error states | built | Agent list, detail, workspace, messages, replay, and mutation errors have explicit states. |
| Schema freeze respected | built | No schema changes or migrations were introduced in Phase 10. |

## Commands Run
- `pnpm verify` pass
- `pnpm build` pass
- API smoke via local dev server pass:
  - sandbox login
  - create agent
  - patch agent config/inbox
  - launch session
  - fetch session/actions
  - advance and finish sandbox actions
  - patch scratchpad
- Browser smoke via `node artifacts/phase10-browser-smoke.cjs` pass:
  - opened `/org/:orgId/canvas?tab=company`
  - verified agent center renders
  - created an agent through the real API
  - verified the agent card renders
  - launched a session through the real API
  - opened Agent Workspace
  - switched Scratchpad and Replay tabs
  - screenshot: `artifacts/phase10-agents-after-fix.png`
  - console errors: none

## Deviations From Plan
- The in-app browser runtime failed with a local kernel asset path error, so Phase 10 browser verification uses a repeatable Chrome CDP runner instead of the Browser plugin.
- Existing ports 3000 and 3001 were occupied by another DSTACK app, so Phase 10 verification used port 3010.
- The C: drive hit 0 bytes free during repeated build/browser passes. Only generated `.next`, Node cache, Phase 10 Chrome temp profiles, and the temporary Phase 10 dev log were cleared.

## Open Questions Raised
- [QUESTION-23] The exact agent marketplace/skills catalog is not specified.

## Next Phase Depends On
- Re-read `implementation-plan.md`, `SCRATCHPAD.md`, all checkpoint files, `OPEN-QUESTIONS.md`, and the Chat section of `docs/product-spec.md`.
- Continue with Phase 11: Chat, expanding beyond task/session chat into real-time or async chat, threads, mentions, attachments, and AI integration.
