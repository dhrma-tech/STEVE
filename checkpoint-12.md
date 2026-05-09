# checkpoint-12.md

## Phase
Execution Phase 11 - Chat

## Status
Complete.

## What Was Built
- Chat data layer in `src/lib/chat/data.ts` covering thread list, thread creation, thread detail, archive/update, message send, mention resolution, attachment persistence, and serialization.
- Sandbox AI adapter in `src/lib/ai/sandbox-chat.ts` for deterministic Cofounder responses with thinking/code metadata.
- Chat API handlers:
  - `GET/POST /api/orgs/:orgId/chat/threads`
  - `GET/PATCH /api/orgs/:orgId/chat/threads/:threadId`
  - `GET/POST /api/orgs/:orgId/chat/threads/:threadId/messages`
- Chat UI components:
  - `ChatWorkspace`
  - `ChatThreadList`
  - `MessageList`
  - `ChatMessageBubble`
  - `ChatComposer`
- Canvas integration:
  - The Cofounder/AI tab now renders the real chat workspace instead of the Phase 6 shell.
  - Existing task/session chat from Phases 9 and 10 remains wired through `ChatThread` and `ChatMessage`.
- Message features:
  - Markdown-style paragraph rendering.
  - Thinking block rendering.
  - Code block rendering.
  - URL link rendering.
  - Copy message button.
  - System/action-log message rendering.
  - Optimistic streaming/typing indicator while send is pending.
  - Department mention quick buttons and server-side mention resolution.
  - Attachment names persisted as generated `File` rows and message metadata.
- `REGISTRY.md`, `docs/api-spec.md`, `DECISIONS.md`, `OPEN-QUESTIONS.md`, `SCRATCHPAD.md`, and `docs/implementation-plan.md` were updated.

## Assumptions Made This Phase
- [ASSUMPTION-18] Chat message attachments are stored in `ChatMessage.metadataJson.fileIds` plus existing `File` rows because the frozen schema has no chat-message/file join table.

## Decisions Added
- [DECISION-45] Use request/response chat APIs with optimistic streaming/typing UI and SSE-ready metadata.
- [ASSUMPTION-18] Persist chat attachments through message metadata and existing File rows.
- [DECISION-46] Keep a repeatable Phase 11 Chrome CDP smoke runner for rendered chat verification.

## Verification Pass
| Requirement | Status | Notes |
|---|---|---|
| Cofounder chat works | built | Cofounder tab loads thread list, selected thread, messages, and composer. |
| Task chat works | built | Existing task/session chat remains backed by `ChatThread`/`ChatMessage`; generic chat APIs can create/read task threads. |
| Threads/new conversation | built | `POST /chat/threads` creates new threads; UI exposes New conversation. |
| Department mentions | built | Composer inserts department mentions; server resolves `@engineering` and similar slugs to department metadata. |
| File attachments | built | Composer file picker sends attachment names; API creates File rows and stores attachment metadata on the message. |
| Async/streaming response UI | built | Composer shows typing/streaming state while the request is pending; API metadata is SSE-ready. |
| Agent/system action logs display | built | Send flow writes action-log messages such as "Writing to workspace", "Saving workspace files", and "Ran 2 actions"; renderer gives them a log treatment. |
| Markdown/thinking/code/copy | built | Chat message renderer handles thinking tags, code fences, links, timestamps, and copy buttons. |
| Empty/loading/error/retry states | built | Thread list, selected thread, message list, loading, error, and retry states are explicit. |
| Schema freeze respected | built | No schema changes or migrations were introduced in Phase 11. |

## Commands Run
- `pnpm typecheck` pass
- `pnpm lint` pass
- `pnpm verify` pass
- `pnpm build` pass
- API smoke via local dev server pass:
  - sandbox login
  - list chat threads
  - create Cofounder thread
  - send message with `@engineering`
  - persist attachment `phase11-brief.md`
  - verify action-log and AI response messages
  - fetch ordered messages
  - rename thread
- Browser smoke via `node artifacts/phase11-browser-smoke.cjs` pass:
  - opened `/org/:orgId/canvas?tab=cofounder`
  - rendered seeded Cofounder thread
  - rendered attachment, action logs, thinking block, and messages
  - screenshot: `artifacts/phase11-chat.png`
  - console errors: none

## Deviations From Plan
- Live websocket/SSE streaming was not added because no transport/provider is specified; the UI uses optimistic streaming state and the API returns SSE-ready metadata.
- Chat attachment persistence uses metadata and File rows because the frozen schema has no message/file join table.
- Browser verification used a Chrome CDP runner because the Browser plugin runtime remained unavailable in this session.

## Open Questions Raised
- [QUESTION-24] Chat requires file attachments, but the frozen schema has no chat-message/file join table.

## Next Phase Depends On
- Re-read `implementation-plan.md`, `SCRATCHPAD.md`, all checkpoint files, `OPEN-QUESTIONS.md`, and the Files & Library section of `docs/product-spec.md`.
- Continue with Phase 12: Files & Library, paying attention to the chat attachment metadata behavior introduced here.
