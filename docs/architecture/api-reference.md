# API Specification

## API Style
- REST JSON route handlers under `/api`.
- Every response returns one of:

```json
{ "data": {} }
```

```json
{ "error": { "code": "ERROR_CODE", "message": "Human readable message", "details": {} } }
```

## Auth Guards
- `public`: no session required.
- `auth`: authenticated user required.
- `org_member`: authenticated organization member.
- `org_admin`: organization owner/admin.
- `billing_admin`: owner/admin/billing role.

## Standard Error Codes
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`
- `RATE_LIMITED`
- `PROVIDER_NOT_CONFIGURED`
- `PROVIDER_ERROR`
- `SANDBOX_MODE`
- `APPROVAL_REQUIRED`
- `TASK_NOT_ACTIONABLE`
- `UPLOAD_FAILED`
- `BILLING_ERROR`
- `INTERNAL_ERROR`

## Auth

### GET `/api/auth/session`
Guard: public

Response:
```json
{
  "data": {
    "user": {
      "id": "usr_...",
      "email": "founder@example.com",
      "preferredName": "Ada",
      "avatarUrl": null,
      "onboardingStatus": "complete",
      "isSandbox": true
    },
    "organizations": [
      { "id": "org_...", "name": "DSTACK", "slug": "dstack-b29488", "role": "owner" }
    ],
    "activeOrgId": "org_..."
  }
}
```

### POST `/api/auth/sandbox-login`
Guard: public

Purpose: local development fallback when GitHub OAuth credentials are absent.

Request:
```json
{ "displayName": "Founder", "email": "founder@example.com" }
```

Response: same session shape.

### POST `/api/auth/logout`
Guard: auth

Response:
```json
{ "data": { "ok": true } }
```

GitHub OAuth routes are provided by the auth framework and must remain GitHub-only in UI.

## Personal Onboarding

### GET `/api/onboarding/profile`
Guard: auth

Response:
```json
{
  "data": {
    "status": "in_progress",
    "preferredName": "Ada",
    "technicalExperience": "writes_code",
    "primaryRole": "Founder / Executive",
    "companyStage": "idea"
  }
}
```

### PUT `/api/onboarding/profile`
Guard: auth

Request:
```json
{
  "preferredName": "Ada",
  "technicalExperience": "writes_code",
  "primaryRole": "Founder / Executive",
  "companyStage": "idea"
}
```

Response:
```json
{ "data": { "status": "complete" } }
```

### PATCH `/api/onboarding/profile`
Guard: auth

Purpose: persist partial progress between personal onboarding steps without marking onboarding complete.

Request: any non-empty subset of `preferredName`, `technicalExperience`, `primaryRole`, and `companyStage`.

Response:
```json
{
  "data": {
    "status": "in_progress",
    "preferredName": "Ada",
    "technicalExperience": "writes_code",
    "primaryRole": null,
    "companyStage": null
  }
}
```

## Organizations And Company Onboarding

### POST `/api/orgs`
Guard: auth

Request:
```json
{ "name": "DSTACK" }
```

Response:
```json
{
  "data": {
    "organization": {
      "id": "org_...",
      "name": "DSTACK",
      "slug": "dstack-b29488",
      "status": "onboarding"
    }
  }
}
```

### GET `/api/orgs/:orgId`
Guard: org_member

Response includes organization, membership role, onboarding status, billing summary, and integration summaries.

### PATCH `/api/orgs/:orgId`
Guard: org_admin

Request:
```json
{ "name": "DSTACK Labs", "description": "..." }
```

Response: updated organization.

### POST `/api/orgs/:orgId/describe`
Guard: org_member

Purpose: submit company description and create onboarding AI question set.

Request:
```json
{ "description": "We are building..." }
```

Response:
```json
{
  "data": {
    "questions": [
      {
        "key": "customer_segment",
        "text": "Who is the primary customer segment?",
        "options": [
          { "id": "founders", "label": "Early-stage founders", "recommended": true }
        ],
        "allowsFreeText": true
      }
    ],
    "actions": [
      { "label": "Generated company questions", "status": "succeeded" }
    ]
  }
}
```

### POST `/api/orgs/:orgId/questions/:questionKey/answer`
Guard: org_member

Request:
```json
{ "selectedOption": "founders", "freeText": null, "aiDecided": false }
```

Response: saved answer and remaining count.

### POST `/api/orgs/:orgId/questions/decide-all`
Guard: org_member

Response: all unanswered recommended answers saved.

### POST `/api/orgs/:orgId/business-plan`
Guard: org_member

Purpose: generate business plan from description and answers.

Response:
```json
{
  "data": {
    "file": { "id": "file_...", "name": "Business Plan.md" },
    "plan": {
      "productOrService": "...",
      "icp": "..."
    },
    "actions": [
      { "label": "Writing to workspace", "status": "succeeded" },
      { "label": "Saving workspace files", "status": "succeeded" }
    ]
  }
}
```

### POST `/api/orgs/:orgId/activate-departments`
Guard: org_member

Response:
```json
{
  "data": {
    "departments": [],
    "integrations": [],
    "nextRoute": "/org/org_.../canvas?design_setup=1"
  }
}
```

## Design Onboarding

### GET `/api/orgs/:orgId/design-onboarding`
Guard: org_member

Response: current step, selected vibe, references, generated brand kit if any.

### POST `/api/orgs/:orgId/design-onboarding/vibe`
Guard: org_member

Request:
```json
{ "vibe": "saturated_tech" }
```

### POST `/api/orgs/:orgId/design-onboarding/references`
Guard: org_member

Multipart:
- `files[]` up to 6 PNG/JPG/WebP.
- `description` optional text.

Response: uploaded reference files.

### POST `/api/orgs/:orgId/design-onboarding/generate`
Guard: org_member

Response: generation job/session with status chips.

### POST `/api/orgs/:orgId/design-onboarding/approve`
Guard: org_member

Request:
```json
{ "approved": true, "feedback": null }
```

### POST `/api/orgs/:orgId/design-onboarding/skip`
Guard: org_member

Request:
```json
{ "confirmedRisk": true }
```

## Canvas

### GET `/api/orgs/:orgId/canvas`
Guard: org_member

Response:
```json
{
  "data": {
    "organization": {},
    "departments": [],
    "nodes": [],
    "edges": [],
    "activeTasks": [],
    "suggestedTasks": [],
    "roadmapProgress": 11,
    "viewState": { "x": 0, "y": 0, "zoom": 1, "panelWidth": 456 }
  }
}
```

### PUT `/api/orgs/:orgId/canvas/view-state`
Guard: org_member

Request:
```json
{ "viewport": { "x": 0, "y": 0, "zoom": 1 }, "selectedNodeId": "department:engineering", "activeTab": "home" }
```

### GET `/api/orgs/:orgId/canvas/view-state`
Guard: org_member

Response: persisted viewport, selected node, and active side-panel tab for the current user/org pair.

## Departments

### GET `/api/orgs/:orgId/departments`
Guard: org_member

Response: all 8 departments with counts.

### GET `/api/orgs/:orgId/departments/:departmentId`
Guard: org_member

Response: department detail, agents, tasks, files, context, roadmap strip.

### PATCH `/api/orgs/:orgId/departments/:departmentId/context`
Guard: org_admin

Request:
```json
{ "contextJson": { "voice": "..." } }
```

## Roadmap

### GET `/api/orgs/:orgId/roadmap`
Guard: org_member

Response: stages, items, dependencies, progress.

### GET `/api/orgs/:orgId/roadmap/items/:itemId`
Guard: org_member

Response: item detail panel fields and dependency/unlock info.

### POST `/api/orgs/:orgId/roadmap/items/:itemId/launch`
Guard: org_member

Request:
```json
{ "input": null, "agentId": "agent_..." }
```

Response: created task or required input/approval error.

### POST `/api/orgs/:orgId/roadmap/items/:itemId/complete`
Guard: org_member

Request:
```json
{ "taskId": "task_..." }
```

Response: updated item and newly unlocked item ids.

## Tasks

### GET `/api/orgs/:orgId/tasks`
Guard: org_member

Query:
- `status`
- `departmentId`
- `agentId`
- `assigneeId`
- `view=list|board|calendar`
- `q`

Response: tasks plus grouping data.

### POST `/api/orgs/:orgId/tasks`
Guard: org_member

Request:
```json
{
  "title": "Build marketing website",
  "description": "Describe a task for your agent...",
  "departmentId": "dept_...",
  "agentId": "agent_...",
  "type": "agent_task",
  "executeMode": "now",
  "autoAssign": true,
  "appTarget": "staging",
  "fileIds": []
}
```

Response: created task.

### GET `/api/orgs/:orgId/tasks/:taskId`
Guard: org_member

Response: task, subtasks, comments, attachments, session.

### PATCH `/api/orgs/:orgId/tasks/:taskId`
Guard: org_member

Request: partial update of title, description, status, assignment, dueAt, priority.

### POST `/api/orgs/:orgId/tasks/:taskId/subtasks`
Guard: org_member

Request:
```json
{ "title": "Set up auth redirect" }
```

### POST `/api/orgs/:orgId/tasks/:taskId/comments`
Guard: org_member

Request:
```json
{ "body": "Looks good", "fileIds": [] }
```

### POST `/api/orgs/:orgId/tasks/:taskId/attachments`
Guard: org_member

Request:
```json
{ "fileIds": [], "attachmentNames": ["brief.pdf"] }
```

Response: updated task with attachments.

### POST `/api/orgs/:orgId/tasks/:taskId/start`
Guard: org_member

Response: task session.

### POST `/api/orgs/:orgId/tasks/:taskId/cancel`
Guard: org_member

Response: updated task/session.

### POST `/api/orgs/:orgId/tasks/:taskId/approvals`
Guard: org_member

Request:
```json
{ "title": "Approve production deploy", "description": "Review before execution", "riskLevel": "medium" }
```

Response: updated task with pending approval.

### PATCH `/api/orgs/:orgId/tasks/:taskId/approvals/:approvalId`
Guard: org_member

Request:
```json
{ "status": "approved" }
```

Response: updated task.

## Agents

### GET `/api/orgs/:orgId/agents`
Guard: org_member

Query: `departmentId`, `status`, `q`.

### POST `/api/orgs/:orgId/agents`
Guard: org_admin

Request:
```json
{
  "departmentId": "dept_...",
  "name": "Growth Agent",
  "model": "claude-sonnet",
  "prompt": "...",
  "toolsJson": {}
}
```

### GET `/api/orgs/:orgId/agents/:agentId`
Guard: org_member

Response: agent config, tasks, inbox, recent sessions.

### PATCH `/api/orgs/:orgId/agents/:agentId`
Guard: org_admin

Request: partial config update.

### POST `/api/orgs/:orgId/agents/:agentId/launch`
Guard: org_member

Request:
```json
{ "taskId": "task_...", "message": "Start this task" }
```

Response: task session.

## Agent Sessions

### GET `/api/orgs/:orgId/sessions/:sessionId`
Guard: org_member

Response: session, task, agent, browser URL, replay state, scratchpad, actions.

### GET `/api/orgs/:orgId/sessions/:sessionId/actions`
Guard: org_member

Response: action log.

### POST `/api/orgs/:orgId/sessions/:sessionId/actions`
Guard: org_member

Request:
```json
{ "finish": false }
```

Response: updated session after a deterministic sandbox action step.

### PATCH `/api/orgs/:orgId/sessions/:sessionId/scratchpad`
Guard: org_member

Request:
```json
{ "scratchpad": "..." }
```

## Chat

### GET `/api/orgs/:orgId/chat/threads`
Guard: org_member

Query: `kind`, `taskId`, `agentId`.

### POST `/api/orgs/:orgId/chat/threads`
Guard: org_member

Request:
```json
{ "kind": "cofounder", "title": "New conversation", "taskId": null, "agentId": null }
```

### GET `/api/orgs/:orgId/chat/threads/:threadId`
Guard: org_member

Response: thread detail with ordered messages.

### PATCH `/api/orgs/:orgId/chat/threads/:threadId`
Guard: org_member

Request:
```json
{ "title": "Renamed thread", "archived": false }
```

### GET `/api/orgs/:orgId/chat/threads/:threadId/messages`
Guard: org_member

Response: ordered messages.

### POST `/api/orgs/:orgId/chat/threads/:threadId/messages`
Guard: org_member

Request:
```json
{ "body": "Ask Cofounder anything...", "fileIds": [], "attachmentNames": [], "mentions": ["engineering"] }
```

Response: user message plus queued/streaming agent response metadata.

## Files And Library

### GET `/api/orgs/:orgId/folders`
Guard: org_member

Query: `folderId`, `departmentId`, `q`.

Response: folder list, total library stats, and `generalFolderId`.

### POST `/api/orgs/:orgId/folders`
Guard: org_member

Request:
```json
{ "name": "General", "parentFolderId": null, "departmentId": null }
```

### PATCH `/api/orgs/:orgId/folders/:folderId`
Guard: org_member

Request:
```json
{ "name": "Research", "parentFolderId": null, "departmentId": null, "archived": false }
```

### GET `/api/orgs/:orgId/files`
Guard: org_member

Query: `folderId`, `departmentId`, `taskId`, `q`, `includeArchived=1`.

Response: folders, files with previews/versions, catalog, stats, General folder id, Business Plan file id.

### POST `/api/orgs/:orgId/files`
Guard: org_member

Local JSON upload payload:
```json
{
  "name": "notes.md",
  "mimeType": "text/markdown",
  "sizeBytes": 1200,
  "folderId": "folder_...",
  "departmentId": null,
  "taskId": null,
  "visibility": "organization",
  "content": "# Optional safe preview text"
}
```

Response: created file with first version.

### GET `/api/orgs/:orgId/files/:fileId`
Guard: org_member

Response: metadata and preview URL/content where safe.

### PATCH `/api/orgs/:orgId/files/:fileId`
Guard: org_member

Request:
```json
{ "name": "notes.md", "folderId": "folder_...", "departmentId": null, "taskId": null, "visibility": "shared" }
```

### POST `/api/orgs/:orgId/files/:fileId/versions`
Guard: org_member

Local JSON version payload:
```json
{ "name": "notes-v2.md", "mimeType": "text/markdown", "sizeBytes": 1800, "content": "# Optional preview text" }
```

Response: updated file with current version and complete version history.

### POST `/api/orgs/:orgId/files/:fileId/archive`
Guard: org_member

Response: archived file.

### GET `/api/orgs/:orgId/files/:fileId/preview`
Guard: org_member

Response: preview payload and file versions.

## Settings

### GET `/api/orgs/:orgId/settings/preferences`
Guard: org_member

Response: user preferences plus profile info.

### PATCH `/api/orgs/:orgId/settings/preferences`
Guard: org_member

Request includes preferredName, timezone, theme, shadowsEnabled.

### POST `/api/orgs/:orgId/settings/preferences/avatar`
Guard: org_member

Local JSON WebP upload metadata, max 5MB; target 256x256:
```json
{ "name": "avatar.webp", "mimeType": "image/webp", "sizeBytes": 1024, "dataUrl": "data:image/webp;base64,..." }
```

### GET `/api/orgs/:orgId/settings/ai`
Guard: org_member

Response: suggested tasks toggle, queue messages toggle, review bot mode, prompt personalization, AI model.

### PATCH `/api/orgs/:orgId/settings/ai`
Guard: org_member

Validation: prompt personalization max 2000 chars.

### GET `/api/orgs/:orgId/settings/env-files`
Guard: org_admin

Response: env file metadata and Vercel export links/status.

### POST `/api/orgs/:orgId/settings/env-files`
Guard: org_admin

Local JSON `.env` upload:
```json
{ "fileName": ".env", "content": "KEY=value", "environment": "staging", "pushToVercel": true }
```

Response returns parsed secret metadata only; raw values are never returned.

### POST `/api/orgs/:orgId/settings/secrets`
Guard: org_admin

Request:
```json
{ "key": "STRIPE_SECRET_KEY", "value": "sk_test_...", "environment": "test", "pushToVercel": true }
```

Response: secret metadata only.

### GET `/api/orgs/:orgId/settings/organization`
Guard: org_admin

Response: company name, context imports, members.

### PATCH `/api/orgs/:orgId/settings/organization`
Guard: org_admin

### POST `/api/orgs/:orgId/settings/organization/context-import`
Guard: org_admin

Request:
```json
{ "source": "Claude", "content": "..." }
```

### GET `/api/orgs/:orgId/settings/inbox`
Guard: org_admin

Response: domains and agent inboxes.

### POST `/api/orgs/:orgId/settings/inbox/domains`
Guard: org_admin

Request:
```json
{ "domain": "example.com" }
```

### POST `/api/orgs/:orgId/settings/inbox/agent-addresses`
Guard: org_admin

Request:
```json
{ "agentId": "agent_...", "address": "engineer@example.com" }
```

### GET `/api/orgs/:orgId/settings/notifications`
Guard: org_member

### PATCH `/api/orgs/:orgId/settings/notifications`
Guard: org_member

### GET `/api/orgs/:orgId/settings/support`
Guard: org_member

Response: support widget/status.

### GET `/api/orgs/:orgId/settings/advanced`
Guard: org_admin

Response: managed repo/Supabase current state.

### POST `/api/orgs/:orgId/settings/advanced/import-supabase`
Guard: org_admin

Requires confirmation.

### POST `/api/orgs/:orgId/settings/advanced/switch-repo`
Guard: org_admin

Requires destructive confirmation.

## Billing

### GET `/api/orgs/:orgId/billing`
Guard: billing_admin

Response: plan, subscription, included usage, usage records, billing dashboard link.

### POST `/api/orgs/:orgId/billing/upgrade`
Guard: billing_admin

Request:
```json
{ "plan": "pro", "confirmed": true }
```

Response: updated billing account or checkout URL.

### GET `/api/orgs/:orgId/billing/usage`
Guard: billing_admin

Query: date range.

### POST `/api/pricing/calculate`
Guard: public

Request:
```json
{ "plan": "pro", "businessSize": "micro" }
```

Response: public estimate with categories.

## Integrations

### GET `/api/orgs/:orgId/integrations`
Guard: org_admin

Response: all providers and statuses.

### GET `/api/orgs/:orgId/integrations/:provider`
Guard: org_admin

### POST `/api/orgs/:orgId/integrations/:provider/connect`
Guard: org_admin

Provider-specific config. Secrets write-only.

### POST `/api/orgs/:orgId/integrations/:provider/disconnect`
Guard: org_admin

### POST `/api/orgs/:orgId/integrations/:provider/check`
Guard: org_admin

Response: updated status.

### GET `/api/orgs/:orgId/integrations/postiz`
Guard: org_admin

Response: social channels and publishing status.

### POST `/api/orgs/:orgId/integrations/postiz/channels`
Guard: org_admin

Request:
```json
{ "channelType": "x", "displayName": "Company X" }
```

## Approvals

### GET `/api/orgs/:orgId/approvals`
Guard: org_member

Query: `status`, `taskId`.

### POST `/api/orgs/:orgId/approvals/:approvalId/approve`
Guard: org_member

### POST `/api/orgs/:orgId/approvals/:approvalId/reject`
Guard: org_member

Request:
```json
{ "reason": "Not safe yet" }
```

## Search And Command Palette

### GET `/api/orgs/:orgId/search`
Guard: org_member

Query: `q`, `types=tasks,agents,files,departments,roadmap`.

Response: grouped search results for command palette/global search.

## Notifications / Inbox

### GET `/api/orgs/:orgId/inbox`
Guard: org_member

Response: notification items, empty state status.

### POST `/api/orgs/:orgId/inbox/:notificationId/read`
Guard: org_member

### POST `/api/orgs/:orgId/inbox/read-all`
Guard: org_member
