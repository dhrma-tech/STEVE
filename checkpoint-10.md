# checkpoint-10.md

## Phase
Execution Phase 9 - Tasks

## Status
Complete.

## What Was Built
- Task data layer in `src/lib/tasks/data.ts` covering workspace lists, details, task creation, assignment resolution, subtasks, comments, attachments, sessions, cancellation, and approvals.
- Task API handlers:
  - `GET/POST /api/orgs/:orgId/tasks`
  - `GET/PATCH /api/orgs/:orgId/tasks/:taskId`
  - `POST /subtasks`, `PATCH /subtasks/:subtaskId`
  - `POST /comments`
  - `POST /attachments`
  - `POST /start`
  - `POST /cancel`
  - `POST /approvals`, `PATCH /approvals/:approvalId`
- Task UI components:
  - `TaskWorkspace`
  - `TaskCreateDialog`
  - `TaskList`
  - `TaskBoard`
  - `TaskCalendar`
  - `TaskDetailPanel`
- Required task entry points:
  - App shell FAB opens the task modal.
  - Canvas Tasks side panel has a new-task button.
  - Suggested-next items can create or launch tasks.
  - Roadmap card launch continues to create tasks or approvals.
  - Department launch CTA creates an execute-now agent task and opens the session shell.
- Canvas task links:
  - `?tab=tasks` opens the task surface instead of persisted department detail.
  - `?task=...` opens the Tasks tab and selected task detail.
- `REGISTRY.md` now lists the Phase 9 task components.
- `docs/api-spec.md` now includes task attachment and approval review endpoints.

## Assumptions Made This Phase
- [ASSUMPTION-16] The notes require an app dropdown in the task modal but do not define an App entity or option list, so it is implemented as an execution target selector: staging, production, repository, integration.

## Decisions Added
- [ASSUMPTION-16] Implement the new-task app dropdown as an execution target selector.
- [DECISION-41] Use status columns for board view and a compact week-strip for calendar view.
- [DECISION-42] Limit optimistic UI behavior to post-mutation refreshes.

## Verification Pass
| Requirement | Status | Notes |
|---|---|---|
| Create task from FAB | ✅ built | App shell desktop and mobile FAB open `TaskCreateDialog`. |
| Create task from side panel | ✅ built | `TaskWorkspace` has a new-task button. |
| Create task from suggested next | ✅ built | Home suggested rows and Tasks suggested list create/launch tasks. |
| Create task from roadmap card | ✅ built | Phase 8 roadmap launch remains wired and visible in Phase 9 task workspace. |
| Create task from department launch CTA | ✅ built | Department detail and board launch create execute-now agent tasks. |
| New task modal fields | ✅ built | Large prompt textarea, file attachment picker, execute dropdown, auto-assign dropdown, app target dropdown, type, priority, assignment, due date, create button. |
| Statuses match product spec | ✅ built | queued, running, finished turn, ready to review, completed, blocked, canceled. |
| Types match product spec | ✅ built | agent task, user task, agent requires approval. |
| Department/agent/member assignments | ✅ built | Create modal and API resolve assignments against organization records. |
| Filters and search | ✅ built | Status, department, assignee, type, text search. |
| List/board/calendar views | ✅ built | List rows, status board columns, compact seven-day calendar plus unscheduled tasks. |
| Subtasks | ✅ built | Create and toggle completion from task detail. |
| Comments | ✅ built | Stored as task chat thread messages. |
| Attachments | ✅ built | Existing file IDs can attach; local file picker creates task attachment records by selected name. |
| Approval requests | ✅ built | Pending approvals block task start and can be approved/rejected. |
| Task session for execution | ✅ built | Start creates `TaskSession` and a first `AgentAction`; execute-now task creation starts a session. |
| Loading/empty/error states | ✅ built | Workspace loading, empty list, empty detail sections, and mutation errors are handled. |

## Commands Run
- `pnpm typecheck` ✅
- `pnpm lint` ✅
- `pnpm verify` ✅
- `pnpm build` ✅
- API smoke via local dev server ✅
  - created task
  - added subtask
  - added comment
  - added attachments
  - created approval
  - approved approval
  - started task/session
  - canceled task/session
- Browser smoke via Playwright ✅
  - opened `/org/:orgId/canvas?tab=tasks`
  - switched list/board/calendar
  - opened new-task modal
  - created a browser smoke task
  - screenshot: `artifacts/phase9-tasks.png`
  - console errors: none

## Deviations From Plan
- The app dropdown had to be implemented as an execution target selector because no App entity/options exist in the source notes or frozen schema. This is logged in `OPEN-QUESTIONS.md` and `DECISIONS.md`.
- The first rebuild after browser smoke failed on a locked `.next/phase9-dev.log` file. The dev server was stopped, the log removed, and `pnpm build` passed.

## Open Questions Raised
- [QUESTION-22] Exact new-task app dropdown option list is unspecified.

## Next Phase Depends On
- Re-read `implementation-plan.md`, `SCRATCHPAD.md`, all checkpoints, `OPEN-QUESTIONS.md`, and Phase 10 product/API sections.
- Replace the current agent workspace/session shell with the full Agents phase: agent creation, configuration, execution, monitoring, logs, marketplace/skills panel, and session views.
