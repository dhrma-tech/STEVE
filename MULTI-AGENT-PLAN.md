# STEVE — Multi-AI Agent System: Implementation Plan

> Created: 2026-05-27
> Status: Phase 1 not started
> Goal: Convert the single-LLM prompt runner into a real multi-agent system

---

## What the system is today (baseline)

- One Ollama (mistral:latest) call per session — model picker on UI does nothing
- Action plan steps are created post-completion with backdated timestamps (pure simulation)
- Skills/tools are stored as JSON strings only — no actual API calls
- Approvals exist in DB but never block execution
- Agents are completely isolated — cannot delegate to each other
- Fire-and-forget execution with no real-time streaming to UI

---

## Architecture Target

```
                    ┌─────────────────────────────────────────┐
                    │         ORCHESTRATION LAYER              │
                    │  AgentRunner (src/lib/agents/runner.ts)  │
                    │  • resolves model → provider             │
                    │  • tool_use loop (max 20 turns)          │
                    │  • streams AgentEvent via SSE            │
                    │  • delegates sub-tasks to child agents   │
                    └────────────┬────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────────┐  ┌──────────────────┐
│  MODEL LAYER    │   │   TOOL LAYER         │  │  APPROVAL LAYER  │
│  Claude API     │   │  github.ts           │  │  approval-gate.ts│
│  OpenAI API     │   │  vercel.ts           │  │  SSE pause/resume│
│  Ollama (local) │   │  web-search.ts       │  └──────────────────┘
└─────────────────┘   │  file-ops.ts         │
                      │  postiz.ts           │
                      │  delegate-agent.ts   │
                      │  memory.ts           │
                      │  create-task.ts      │
                      └─────────────────────┘
```

---

## Phase 1 — Model Router
**Status:** [x] Done — 2026-06-01
**Estimate:** 1–2 days
**Unlock:** Real Claude/GPT calls instead of always using Ollama

### Files to create
- `src/lib/ai/model-router.ts` — maps agent model slug → { provider, modelId, supportsTools }
- `src/lib/ai/anthropic-client.ts` — Anthropic SDK wrapper with streamWithTools()
- `src/lib/ai/openai-client.ts` — OpenAI SDK wrapper with same interface

### Model map
| UI slug | Provider | Real model ID |
|---|---|---|
| claude-sonnet-sandbox | anthropic | claude-sonnet-4-6 |
| gpt-5.4-sandbox | openai | gpt-4o |
| gpt-5.4-mini-sandbox | openai | gpt-4o-mini |
| local | ollama | mistral:latest |

### Env vars to add to `.env`
```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

### First real change
Replace the `ollamaChatSafe()` call in `src/lib/queue/sandbox-execution.ts` with a call through the model router. Everything else stays the same — just proves the routing works.

---

## Phase 2 — Tool Definitions
**Status:** [x] Done — 2026-06-01
**Estimate:** 2–3 days
**Unlock:** LLM has real callable capabilities

### Directory to create: `src/lib/agents/tools/`

Each file exports `definition` (JSON schema for LLM) + `execute(input, context)` (real handler).

| File | Tools | Skill required |
|---|---|---|
| `web-search.ts` | `web_search` | always available |
| `github.ts` | `github_list_repos`, `github_read_file`, `github_create_branch`, `github_create_pr`, `github_push_file` | github-repository skill |
| `vercel.ts` | `vercel_list_deployments`, `vercel_get_deployment`, `vercel_trigger_deploy` | vercel-preview skill |
| `file-ops.ts` | `read_file`, `write_file`, `list_files`, `delete_file` | always (sandboxed to /tmp/steve-sessions/{sessionId}/) |
| `postiz.ts` | `postiz_create_post`, `postiz_schedule_post`, `postiz_list_posts` | postiz-social skill |
| `delegate-agent.ts` | `delegate_agent` | always available (multi-agent key tool) |
| `memory.ts` | `memory_store`, `memory_retrieve`, `memory_list` | always available |
| `create-task.ts` | `create_task`, `update_task`, `assign_task` | always available |

### Registry file: `src/lib/agents/tools/registry.ts`
Builds the tools array to send to LLM based on agent's skillKeys + permission mode + active integrations.

---

## Phase 3 — Agent Runner (Core Engine)
**Status:** [ ] Not started
**Estimate:** 3–4 days
**Unlock:** Real tool-use loop replaces single LLM call

### File to create: `src/lib/agents/runner.ts`

```typescript
export async function runAgent(opts: {
  sessionId: string
  agentId: string
  orgId: string
  task: string
  parentSessionId?: string
  onEvent: (event: AgentEvent) => void
}): Promise<AgentRunResult>
```

### Execution loop (max 20 iterations)
1. Load agent config, skills, org context, memory
2. Build system prompt (reuse existing logic from sandbox-execution.ts)
3. Build toolset from registry
4. Resolve model → provider (Phase 1)
5. LOOP:
   - Call LLM with messages + tools
   - Emit streaming events as they arrive
   - If tool_use blocks in response:
     - If tool is delegate_agent AND review_required mode → emit approval_required, pause
     - Execute tool handler
     - Append tool_result to messages
     - Continue loop
   - If text-only response → DONE
6. Write final output to ChatMessage
7. Update TaskSession (completed, scratchpad, elapsedMs)
8. Update Task status

### AgentEvent types
```typescript
type AgentEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_call"; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool: string; output: string; success: boolean }
  | { type: "approval_required"; tool: string; input: unknown; approvalId: string }
  | { type: "delegate_start"; childAgentSlug: string; childSessionId: string }
  | { type: "delegate_done"; childAgentSlug: string; output: string }
  | { type: "done"; output: string }
  | { type: "error"; message: string }
```

Each event is written to AgentAction in DB (for replay) AND streamed to client simultaneously.

---

## Phase 4 — Streaming API
**Status:** [ ] Not started
**Estimate:** 1–2 days
**Unlock:** Real-time UI instead of polling

### File to create: `src/app/api/orgs/[orgId]/agents/[agentId]/sessions/[sessionId]/stream/route.ts`
GET endpoint — opens SSE connection. Client receives AgentEvent stream as `data: {...}\n\n`.

### Pub/sub bridge
In-process `EventEmitter` map (`Map<sessionId, EventEmitter>`) bridges runner → SSE subscribers.
Upgrade path: swap for Redis pub/sub when going multi-process.

### Modified: `src/app/api/orgs/[orgId]/agents/[agentId]/launch/route.ts`
Phase 2 becomes: call `runAgent()` in background → it emits events picked up by SSE endpoint.
Remove `void completeAgentSession()` call.

---

## Phase 5 — Approval Gate
**Status:** [ ] Not started
**Estimate:** 1 day
**Unlock:** review_required permission mode actually works

### File to create: `src/app/api/orgs/[orgId]/agents/[agentId]/sessions/[sessionId]/approve/route.ts`
```
POST { action: "approve" | "deny", approvalId: string }
```

Runner loop holds a `pausedApprovals: Map<sessionId, { resolve, reject }>`.
- approve → resolve() → loop continues
- deny → reject() → session marked canceled

### UI change: `src/components/agents/agent-workspace-dialog.tsx`
When SSE fires `approval_required`:
- Show blocking "Approve / Deny" banner in session panel
- Disabled until user acts
- On click → POST to approve endpoint

---

## Phase 6 — Multi-Agent Orchestration
**Status:** [ ] Not started
**Estimate:** 2–3 days
**Unlock:** Agents can spawn and wait on child agents

### DB schema additions (`prisma/schema.prisma`)
```prisma
model TaskSession {
  // ... existing fields
  parentSessionId  String?
  parentSession    TaskSession?  @relation("SessionTree", fields: [parentSessionId], references: [id])
  childSessions    TaskSession[] @relation("SessionTree")
}

model AgentMemory {
  id           String   @id @default(cuid())
  agentId      String
  key          String
  value        String
  updatedAt    DateTime @updatedAt
  agent        Agent    @relation(fields: [agentId], references: [id])
  @@unique([agentId, key])
}
```

### delegate-agent tool flow
1. LLM calls `delegate_agent({ agentSlug, task })`
2. Look up target agent by slug in same org
3. Create a Task for it
4. Call `runAgent()` recursively with `parentSessionId` set
5. Parent waits synchronously for child to complete
6. Return child's final output as tool_result

Example: PM agent → delegates to Engineer agent → delegates to Designer agent.

---

## Phase 7 — Real-Time UI
**Status:** [ ] Not started
**Estimate:** 2 days
**Unlock:** Live execution feed in the workspace dialog

### Modified: `src/components/agents/agent-workspace-dialog.tsx`
After launching, open SSE connection to `/stream`. Render live `ExecutionFeed` component.

Event → UI mapping:
- `text_delta` → append to scratchpad display
- `tool_call` → show "Using: github_create_pr" with spinner
- `tool_result` → show result inline, mark step done/failed
- `approval_required` → show blocking approval banner
- `delegate_start` → show child agent card expanding
- `delegate_done` → collapse child card, show output summary
- `done` → mark session complete, stop SSE

### New component: `src/components/agents/execution-feed.tsx`
Timeline of AgentEvents rendered as visual steps:
- Tool calls = expandable cards (input / output)
- Text = markdown rendered inline
- Delegations = nested agent cards
- Approvals = sticky blocking banner at top

---

## Phase 8 — Agent Memory
**Status:** [ ] Not started
**Estimate:** 1 day
**Unlock:** Agents remember facts across sessions

### Tools (from Phase 2 memory.ts)
- `memory_store(key, value)` — LLM stores a fact
- `memory_retrieve(key)` — fetch specific key
- `memory_list()` — see all stored keys

### Memory injection
At session start, all stored memories injected into system prompt:
```
## Your Memory
- brand_primary_color: #FF3B30
- preferred_stack: Next.js + Prisma + TypeScript
- github_repo: github.com/acme/api
```

Agents stop needing the user to re-explain context on every run.

---

## Full Roadmap

| Phase | What | Days | Status |
|---|---|---|---|
| 1 | Model Router | 1–2 | [x] Done 2026-06-01 |
| 2 | Tool Definitions | 2–3 | [x] Done 2026-06-01 |
| 3 | Agent Runner | 3–4 | [ ] |
| 4 | Streaming API | 1–2 | [ ] |
| 5 | Approval Gate | 1 | [ ] |
| 6 | Multi-Agent Orchestration | 2–3 | [ ] |
| 7 | Real-Time UI | 2 | [ ] |
| 8 | Agent Memory | 1 | [ ] |
| **Total** | | **~15–18 days** | |

---

## What to touch vs. not touch

### Keep as-is
- All DB schema except parentSessionId + AgentMemory additions
- System prompt building logic in sandbox-execution.ts (move it, don't rewrite it)
- startAgentSession() function signature
- UI structure of agent-workspace-dialog.tsx — add to it, don't rebuild

### Replace
- completeAgentSession() in sandbox-execution.ts → replaced by runAgent() in runner.ts
- ollamaChatSafe() direct call → replaced by model-router + tool loop
- Hardcoded action plan arrays → replaced by real tool events

### Extend
- AgentAction table — written in real-time as events stream, not backdated post-run
- Launch route — add SSE bridge call after session creation
- agent-workspace-dialog.tsx — add SSE subscription + ExecutionFeed component

---

## Key files (current system)

| File | Role |
|---|---|
| `src/lib/agents/data.ts` | Agent CRUD, session creation |
| `src/lib/ai/ollama.ts` | Current LLM client (to be supplemented) |
| `src/lib/queue/sandbox-execution.ts` | Current execution engine (to be replaced) |
| `src/components/agents/agent-workspace-dialog.tsx` | Main agent UI |
| `src/data/agents.ts` | Model list, skill catalog, permission modes |
| `prisma/schema.prisma` | DB schema |

---

## Resume instructions (daily)

1. Check this file — find the first `[ ] Not started` phase
2. Read the phase section fully before writing any code
3. Implement the phase completely
4. Run `pnpm typecheck` — must exit 0
5. Mark the phase `[x] Done` and add a completion date
6. Stop and review before moving to the next phase
