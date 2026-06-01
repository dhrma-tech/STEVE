import { prisma } from "@/lib/db/client";
import { OLLAMA_OFFLINE_MESSAGE } from "@/lib/ai/ollama";
import { callModel } from "@/lib/ai/model-router";

const json = (value: unknown) => JSON.stringify(value);

// ── Org-level context loader (Business Plan + Brand Kit) ──────────────────────

export async function loadOrgContext(orgId: string): Promise<{ businessPlan: string; brandKit: string }> {
  const files = await prisma.file.findMany({
    where: {
      organizationId: orgId,
      archivedAt: null,
      name: { in: ["Business Plan.md", "Brand Kit.json"] }
    },
    select: { name: true, metadataJson: true }
  });

  let businessPlan = "";
  let brandKit = "";

  for (const file of files) {
    if (!file.metadataJson) continue;
    try {
      const meta = JSON.parse(file.metadataJson) as { previewText?: string };
      const text = meta.previewText ?? "";
      if (file.name === "Business Plan.md") businessPlan = text;
      if (file.name === "Brand Kit.json") brandKit = formatBrandKit(text);
    } catch { /* ignore */ }
  }

  return { businessPlan, brandKit };
}

function formatBrandKit(raw: string): string {
  if (!raw) return "";
  try {
    const kit = JSON.parse(raw) as {
      companyName?: string;
      theme?: string;
      colorPalette?: { name?: string; primary?: string; secondary?: string; accent?: string };
      typography?: { heading?: string; body?: string };
      brandStyle?: string;
    };
    return [
      kit.companyName  ? `Company name: ${kit.companyName}` : "",
      kit.theme        ? `Visual theme: ${kit.theme}` : "",
      kit.brandStyle   ? `Brand personality: ${kit.brandStyle}` : "",
      kit.colorPalette ? `Colors: primary ${kit.colorPalette.primary ?? ""}, secondary ${kit.colorPalette.secondary ?? ""}, accent ${kit.colorPalette.accent ?? ""} (palette: ${kit.colorPalette.name ?? ""})` : "",
      kit.typography   ? `Typography: ${kit.typography.heading ?? ""} (headings) / ${kit.typography.body ?? ""} (body)` : ""
    ].filter(Boolean).join("\n");
  } catch { return ""; }
}

// ── Department-specific action plans ─────────────────────────────────────────

type ActionStep = { actionType: string; label: string; detail: string };

const ACTION_PLANS: Record<string, ActionStep[]> = {
  engineering: [
    { actionType: "context.load",   label: "Loading task context",    detail: "Fetched task description, department context, and attached files." },
    { actionType: "code.plan",      label: "Planning implementation", detail: "Mapped affected components, dependencies, and technical approach." },
    { actionType: "code.write",     label: "Writing implementation",  detail: "Drafted code changes, integration points, and configuration updates." },
    { actionType: "tests.verify",   label: "Verifying quality",       detail: "Reviewed edge cases, type safety, error paths, and test coverage." },
    { actionType: "review.prepare", label: "Preparing for review",    detail: "Summarised changes, flagged blockers, and noted deployment steps." }
  ],
  marketing: [
    { actionType: "context.load",   label: "Loading campaign context", detail: "Fetched task, audience, and brand context." },
    { actionType: "content.draft",  label: "Drafting content",         detail: "Wrote initial copy aligned to campaign goals." },
    { actionType: "content.review", label: "Reviewing output",         detail: "Checked tone, brand alignment, and channel fit." },
    { actionType: "review.prepare", label: "Preparing for approval",   detail: "Summarised deliverables and flagged follow-up actions." }
  ],
  design: [
    { actionType: "context.load",   label: "Loading design context",   detail: "Fetched task, brand kit, and visual references." },
    { actionType: "design.plan",    label: "Planning design work",     detail: "Outlined components, layout, and design decisions." },
    { actionType: "design.execute", label: "Executing design",         detail: "Produced design specifications and asset notes." },
    { actionType: "review.prepare", label: "Preparing for review",     detail: "Summarised design decisions and open feedback items." }
  ],
  sales: [
    { actionType: "context.load",   label: "Loading sales context",    detail: "Fetched prospect, pipeline, and product context." },
    { actionType: "outreach.draft", label: "Drafting outreach",        detail: "Prepared messaging, value propositions, and follow-up steps." },
    { actionType: "review.prepare", label: "Preparing for review",     detail: "Summarised actions and noted pipeline updates." }
  ]
};

const DEFAULT_ACTION_PLAN: ActionStep[] = [
  { actionType: "context.load",     label: "Read context",     detail: "Pulled organisation, department, and task details." },
  { actionType: "workspace.write",  label: "Working on it",    detail: "Prepared workspace changes and notes for review." },
  { actionType: "verification.run", label: "Verified output",  detail: "Checked output against acceptance context." },
  { actionType: "review.prepare",   label: "Wrapped up",       detail: "Summarised the run, blockers, and follow-up actions." }
];

function getActionPlan(deptSlug?: string | null): ActionStep[] {
  return ACTION_PLANS[deptSlug ?? ""] ?? DEFAULT_ACTION_PLAN;
}

// ── Prompt builder ────────────────────────────────────────────────────────────

export function buildPrompt(ctx: {
  agentName: string;
  orgName: string;
  deptName: string;
  deptSlug: string;
  deptContext: string;
  skillNames: string[];
  taskTitle: string;
  taskDescription: string | null;
  subtasks: Array<{ title: string; status: string }>;
  fileNames: string[];
  message: string | null;
  hasGithub: boolean;
  hasVercel: boolean;
  businessPlan: string;
  brandKit: string;
}): { system: string; user: string } {
  const {
    agentName, orgName, deptName, deptSlug, deptContext,
    skillNames, taskTitle, taskDescription, subtasks,
    fileNames, message, hasGithub, hasVercel,
    businessPlan, brandKit
  } = ctx;

  const capabilitiesLine = skillNames.length
    ? `Your active capabilities: ${skillNames.join(", ")}.`
    : "";

  const contextLine = deptContext
    ? `\nDepartment context:\n${deptContext}`
    : "";

  // Shared org knowledge injected into every agent's system prompt
  const orgKnowledge = [
    businessPlan
      ? `\n--- Business Plan (authoritative reference) ---\n${businessPlan.slice(0, 2000)}${businessPlan.length > 2000 ? "\n[truncated]" : ""}\n---`
      : "",
    brandKit
      ? `\n--- Brand Kit ---\n${brandKit}\n---`
      : ""
  ].filter(Boolean).join("\n");

  if (deptSlug === "engineering") {
    const system = [
      `You are ${agentName}, an AI Engineering Agent at ${orgName} in the ${deptName} department.`,
      capabilitiesLine,
      contextLine,
      orgKnowledge,
      "",
      "All implementation decisions must align with the Business Plan and Brand Kit above.",
      "Produce a detailed, actionable engineering response using markdown.",
      "Be specific about file names, function names, and implementation steps.",
      "Respond in under 650 words."
    ].filter(Boolean).join("\n");

    const userLines: string[] = [
      `Task: ${taskTitle}`,
      taskDescription ? `Description: ${taskDescription}` : "",
      message?.trim() ? `Note: ${message.trim()}` : "",
      subtasks.length
        ? `\nSubtasks:\n${subtasks.map((s) => `- [${s.status === "completed" ? "x" : " "}] ${s.title}`).join("\n")}`
        : "",
      fileNames.length
        ? `\nAttached files:\n${fileNames.map((f) => `- ${f}`).join("\n")}`
        : "",
      hasGithub ? "\nGitHub integration: connected — include branch name, PR title, and commit message suggestions." : "",
      hasVercel ? "\nVercel integration: connected — include deployment environment notes (staging/production)." : "",
      "",
      "Respond with these sections:",
      "## Technical Approach",
      "Briefly analyse the problem and your chosen solution strategy.",
      "",
      "## Implementation Plan",
      "Numbered list of specific code changes — include file names, functions to create/modify, and logic.",
      "",
      "## Testing Checklist",
      "What to test, how to test it, and which edge cases or error paths to cover.",
      ...(hasGithub || hasVercel ? [
        "",
        "## Integration & Deployment",
        hasGithub ? "PR title, branch name, commit message." : "",
        hasVercel ? "Target environment, preview URL pattern, env vars to set." : ""
      ] : []),
      "",
      "## Blockers & Follow-ups",
      "Any dependencies, risks, or child tasks to create."
    ];

    return { system, user: userLines.filter((l) => l !== null && l !== undefined).join("\n") };
  }

  // ── Generic prompt for all other departments ──────────────────────────────
  const system = [
    `You are ${agentName}, an AI agent working in the ${deptName} department at ${orgName}.`,
    capabilitiesLine,
    contextLine,
    orgKnowledge,
    "",
    "All output must align with the Business Plan and Brand Kit above.",
    "Analyse the task and produce clear, actionable output using markdown headers.",
    "Be practical and concise (under 450 words).",
    deptSlug === "design" ? `\nCRITICAL OUTPUT REQUIREMENT — BRAND KIT JSON\n\nAt the very end of your response, you MUST include a valid JSON block in this exact format:\n\n{\n  "companyName": "<company name>",\n  "visualTheme": "<e.g. modern, minimal, bold, playful, corporate>",\n  "personality": "<3-word brand personality summary>",\n  "colors": {\n    "primary": "#hex",\n    "secondary": "#hex",\n    "accent": "#hex",\n    "neutral": "#hex",\n    "palette": "<palette name>"\n  },\n  "typography": {\n    "heading": "<font name>",\n    "body": "<font name>"\n  }\n}\n\nRules for the JSON block:\n- All hex values must be valid 6-digit hex codes starting with #\n- Colors must meet WCAG AA contrast ratio (4.5:1 minimum)\n- Font names must be real Google Fonts or system fonts\n- palette name should be 1-2 words describing the color scheme\n- Do not wrap the JSON in markdown code fences — output it as raw JSON after your ## Output section\n- This JSON will be automatically extracted and saved as Brand Kit.json for the entire organization` : ""
  ].filter(Boolean).join("\n");

  const userLines: string[] = [
    `Task: ${taskTitle}`,
    taskDescription ? `Description: ${taskDescription}` : "",
    message?.trim() ? `Note: ${message.trim()}` : "",
    subtasks.length
      ? `\nSubtasks:\n${subtasks.map((s) => `- [${s.status === "completed" ? "x" : " "}] ${s.title}`).join("\n")}`
      : "",
    fileNames.length
      ? `\nAttached files:\n${fileNames.map((f) => `- ${f}`).join("\n")}`
      : "",
    `\nDepartment: ${deptName}`,
    "",
    "Provide output in these sections:",
    "## Approach",
    "## Key Steps",
    "## Output / Deliverables",
    "## Blockers & Next Actions"
  ];

  return { system, user: userLines.filter((l) => l !== null && l !== undefined).join("\n") };
}

// ── Phase 1: Create session as "running" — returned to client immediately ────

export async function startAgentSession({
  orgId,
  taskId,
  agentId,
  message
}: {
  orgId: string;
  taskId: string;
  agentId: string | null;
  message?: string | null;
}) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: orgId, archivedAt: null },
    include: { department: true, agent: true }
  });
  if (!task) return null;

  const agentName = task.agent?.name ?? "Agent";
  const deptName = task.department?.name ?? "company";
  const now = new Date();

  const session = await prisma.taskSession.create({
    data: {
      organizationId: orgId,
      taskId,
      agentId,
      status: "running",
      startedAt: now,
      browserUrl: `/org/${orgId}/canvas?task=${taskId}`,
      scratchpad: [
        `# ${agentName} — Running`,
        "",
        `**Task:** ${task.title}`,
        `**Department:** ${deptName}`,
        message?.trim() ? `**Note:** ${message.trim()}` : null,
        "",
        "_Working on it…_"
      ].filter(Boolean).join("\n")
    }
  });

  await prisma.agentAction.create({
    data: {
      organizationId: orgId,
      sessionId: session.id,
      agentId,
      label: "Session started",
      actionType: "session.start",
      status: "running",
      payloadJson: json({ taskId, message: message?.trim() ?? null })
    }
  });

  if (agentId) {
    await prisma.agent.updateMany({ where: { id: agentId }, data: { status: "running" } });
  }

  return session;
}

// ── Phase 2: Background completion — load context, call Ollama, finalise ─────

export async function completeAgentSession({
  orgId,
  sessionId,
  taskId,
  agentId,
  message,
  agentName,
  deptName,
  taskTitle,
  taskDescription
}: {
  orgId: string;
  sessionId: string;
  taskId: string;
  agentId: string | null;
  message?: string | null;
  agentName: string;
  deptName: string;
  taskTitle: string;
  taskDescription?: string | null;
}) {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  // Load full context for rich prompt building
  const [task, organization, session, orgContext] = await Promise.all([
    prisma.task.findFirst({
      where: { id: taskId, organizationId: orgId },
      include: {
        department: true,
        agent: true,
        subtasks: { orderBy: { sortOrder: "asc" } },
        files: { where: { archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 8 }
      }
    }),
    prisma.organization.findFirst({ where: { id: orgId } }),
    prisma.taskSession.findUnique({
      where: { id: sessionId },
      include: { actions: true }
    }),
    loadOrgContext(orgId)
  ]);

  const deptSlug = task?.department?.slug ?? "";
  const orgName = organization?.name ?? "your company";

  // Parse agent skills from toolsJson
  let skillNames: string[] = [];
  if (task?.agent?.toolsJson) {
    try {
      const tools = JSON.parse(task.agent.toolsJson) as { skillKeys?: string[] };
      skillNames = tools.skillKeys ?? [];
    } catch { /* ignore */ }
  }

  const hasGithub = skillNames.includes("github-repository");
  const hasVercel = skillNames.includes("vercel-preview");

  // Parse department context
  let deptContext = "";
  if (task?.department?.contextJson) {
    try {
      const ctx = JSON.parse(task.department.contextJson) as Record<string, unknown>;
      // Flatten to readable text
      deptContext = Object.entries(ctx)
        .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join("\n");
    } catch { /* ignore */ }
  }

  const fileNames = (task?.files ?? []).map((f) => f.name);
  const subtasks = task?.subtasks ?? [];

  const { system, user } = buildPrompt({
    agentName,
    orgName,
    deptName,
    deptSlug,
    deptContext,
    skillNames,
    taskTitle,
    taskDescription: taskDescription ?? null,
    subtasks,
    fileNames,
    message: message ?? null,
    hasGithub,
    hasVercel,
    businessPlan: orgContext.businessPlan,
    brandKit: orgContext.brandKit
  });

  const aiOutput = await callModel({ agentModel: task?.agent?.model, system, user });

  const actionPlan = getActionPlan(deptSlug);
  const now = new Date();
  const runningAction = session?.actions.find((a) => a.status === "running");
  const startedAt = session?.startedAt ?? now;
  const elapsedMs = Math.max(1200, now.getTime() - startedAt.getTime());

  // Build scratchpad with richer structure
  const scratchpadParts = [
    `# ${agentName} — Completed`,
    "",
    `**Task:** ${taskTitle}`,
    `**Department:** ${deptName}`,
    skillNames.length ? `**Capabilities:** ${skillNames.join(", ")}` : null,
    message?.trim() ? `**Note:** ${message.trim()}` : null,
    subtasks.length
      ? `\n**Subtasks:**\n${subtasks.map((s) => `- [${s.status === "completed" ? "x" : " "}] ${s.title}`).join("\n")}`
      : null,
    fileNames.length
      ? `\n**Files:**\n${fileNames.map((f) => `- ${f}`).join("\n")}`
      : null,
    "",
    "---",
    "",
    aiOutput || OLLAMA_OFFLINE_MESSAGE
  ].filter((l) => l !== null);

  const scratchpad = scratchpadParts.join("\n");
  const replayUrl = `/org/${orgId}/canvas?session=${sessionId}&replay=1`;

  await prisma.$transaction([
    ...(runningAction
      ? [prisma.agentAction.update({
          where: { id: runningAction.id },
          data: { status: "completed", completedAt: new Date(now.getTime() - 3600) }
        })]
      : []),
    ...actionPlan.map((plan, i) =>
      prisma.agentAction.create({
        data: {
          organizationId: orgId,
          sessionId,
          agentId,
          label: plan.label,
          actionType: plan.actionType,
          status: "completed",
          payloadJson: json({ detail: plan.detail }),
          completedAt: new Date(now.getTime() - (actionPlan.length - i) * 1200)
        }
      })
    ),
    prisma.taskSession.update({
      where: { id: sessionId },
      data: { status: "completed", finishedAt: now, elapsedMs, scratchpad, replayUrl }
    }),
    prisma.task.update({
      where: { id: taskId },
      data: { status: "ready_to_review" }
    }),
    ...(agentId
      ? [prisma.agent.updateMany({ where: { id: agentId }, data: { status: "idle" } })]
      : [])
  ]);

  await postAgentOutput({ orgId, taskId, agentId, agentName, aiOutput });
  await maybeExtractAndSaveBrandKit(aiOutput, orgId, sessionId, deptSlug, task?.metadataJson ?? null);
}

// ── Post output to task chat thread ──────────────────────────────────────────

async function postAgentOutput({
  orgId,
  taskId,
  agentId,
  agentName,
  aiOutput
}: {
  orgId: string;
  taskId: string;
  agentId: string | null;
  agentName: string;
  aiOutput: string;
}) {
  const thread =
    (await prisma.chatThread.findFirst({
      where: { organizationId: orgId, taskId, kind: "task", archivedAt: null }
    })) ??
    (await prisma.chatThread.create({
      data: { organizationId: orgId, taskId, agentId, kind: "task", title: "Task chat" }
    }));

  await prisma.chatMessage.createMany({
    data: [
      {
        organizationId: orgId,
        threadId: thread.id,
        senderType: "system",
        senderAgentId: agentId,
        body: `${agentName} finished and prepared this task for review.`,
        metadataJson: json({ kind: "agent_action_log", completed: true })
      },
      ...(aiOutput
        ? [
            {
              organizationId: orgId,
              threadId: thread.id,
              senderType: "agent" as const,
              senderAgentId: agentId,
              body: aiOutput,
              metadataJson: json({ kind: "agent_output" })
            }
          ]
        : [])
    ]
  });
}

// ── Brand Kit extraction — runs after design agent completes brand_identity ───

async function maybeExtractAndSaveBrandKit(
  aiOutput: string,
  orgId: string,
  sessionId: string,
  deptSlug: string,
  taskMetadataJson: string | null
): Promise<void> {
  if (deptSlug !== "design") return;

  try {
    const meta = JSON.parse(taskMetadataJson ?? "{}") as { itemKey?: string };
    if (meta.itemKey !== "brand_identity") return;
  } catch {
    return;
  }

  try {
    // Find the last occurrence of "companyName" then walk back to its opening brace
    const keyIdx = aiOutput.lastIndexOf('"companyName"');
    if (keyIdx === -1) {
      console.log(`Brand Kit extraction failed for session ${sessionId}: "companyName" key not found`);
      return;
    }

    let braceStart = keyIdx;
    while (braceStart > 0 && aiOutput[braceStart] !== "{") braceStart--;
    if (aiOutput[braceStart] !== "{") {
      console.log(`Brand Kit extraction failed for session ${sessionId}: opening brace not found`);
      return;
    }

    // Count braces to find the matching closing brace (handles nested objects)
    let depth = 0;
    let braceEnd = -1;
    for (let i = braceStart; i < aiOutput.length; i++) {
      if (aiOutput[i] === "{") depth++;
      else if (aiOutput[i] === "}") {
        depth--;
        if (depth === 0) { braceEnd = i; break; }
      }
    }
    if (braceEnd === -1) {
      console.log(`Brand Kit extraction failed for session ${sessionId}: closing brace not found`);
      return;
    }

    const parsed = JSON.parse(aiOutput.slice(braceStart, braceEnd + 1)) as {
      companyName?: unknown;
      colors?: { primary?: unknown };
      typography?: { heading?: unknown };
    };

    if (
      typeof parsed.companyName !== "string" ||
      typeof parsed.colors?.primary !== "string" ||
      !parsed.colors.primary.startsWith("#") ||
      typeof parsed.typography?.heading !== "string"
    ) {
      console.log(`Brand Kit extraction failed for session ${sessionId}: required fields missing or invalid`);
      return;
    }

    const content = JSON.stringify(parsed, null, 2);
    const existing = await prisma.file.findFirst({
      where: { organizationId: orgId, name: "Brand Kit.json", archivedAt: null }
    });

    if (existing) {
      await prisma.file.update({
        where: { id: existing.id },
        data: { metadataJson: json({ previewText: content, source: "agent-generated" }) }
      });
    } else {
      await prisma.file.create({
        data: {
          organizationId: orgId,
          name: "Brand Kit.json",
          mimeType: "application/json",
          sizeBytes: content.length,
          storageKey: `agent-generated:brand-kit:${orgId}`,
          visibility: "org",
          metadataJson: json({ previewText: content, source: "agent-generated" })
        }
      });
    }

    console.log(`Brand Kit.json saved for org ${orgId}`);
  } catch (err) {
    console.log(`Brand Kit extraction failed for session ${sessionId}:`, err);
  }
}

// ── Replay / step-through advance ────────────────────────────────────────────

export async function advanceSandboxSession({
  orgId,
  sessionId,
  finish = false
}: {
  orgId: string;
  sessionId: string;
  finish?: boolean;
}) {
  const session = await prisma.taskSession.findFirst({
    where: { id: sessionId, organizationId: orgId },
    include: {
      task: { include: { department: true } },
      agent: true,
      actions: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!session) return null;
  if (session.status === "completed" || session.status === "canceled") return session;

  const deptSlug = session.task?.department?.slug ?? "";
  const actionPlan = getActionPlan(deptSlug);

  const now = new Date();
  const runningAction = session.actions.find((a) => a.status === "running");
  const currentIndex = runningAction
    ? actionPlan.findIndex((p) => p.actionType === runningAction.actionType)
    : -1;
  const nextPlan = finish ? null : actionPlan[currentIndex + 1] ?? null;
  const elapsedMs = session.startedAt
    ? Math.max(1000, now.getTime() - session.startedAt.getTime())
    : 1000;

  const updates = [];

  if (runningAction) {
    updates.push(
      prisma.agentAction.update({
        where: { id: runningAction.id },
        data: { status: "completed", completedAt: now }
      })
    );
  }

  if (nextPlan) {
    updates.push(
      prisma.agentAction.create({
        data: {
          organizationId: orgId,
          sessionId,
          agentId: session.agentId,
          label: nextPlan.label,
          actionType: nextPlan.actionType,
          status: "running",
          payloadJson: json({ detail: nextPlan.detail })
        }
      }),
      prisma.taskSession.update({ where: { id: sessionId }, data: { elapsedMs } })
    );
  } else {
    updates.push(
      prisma.taskSession.update({
        where: { id: sessionId },
        data: {
          status: "completed",
          elapsedMs,
          finishedAt: now,
          replayUrl: `/org/${orgId}/canvas?session=${sessionId}&replay=1`
        }
      }),
      prisma.task.update({ where: { id: session.taskId }, data: { status: "ready_to_review" } }),
      ...(session.agentId
        ? [prisma.agent.update({ where: { id: session.agentId }, data: { status: "idle" } })]
        : [])
    );
  }

  await prisma.$transaction(updates);

  return prisma.taskSession.findFirst({
    where: { id: sessionId },
    include: { actions: { orderBy: { createdAt: "asc" } } }
  });
}
