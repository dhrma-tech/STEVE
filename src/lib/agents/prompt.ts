import { prisma } from "@/lib/db/client";

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

// ── Brand Kit extraction — runs after design agent completes brand_identity ───

export async function maybeExtractAndSaveBrandKit(
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

