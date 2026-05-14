import { departmentVisuals } from "@/data/departments";

export const agentStatusOptions = [
  { value: "idle", label: "Idle" },
  { value: "running", label: "Running" },
  { value: "paused", label: "Paused" },
  { value: "error", label: "Error" },
  { value: "archived", label: "Archived" }
] as const;

export const agentModelOptions = [
  { value: "claude-sonnet-sandbox", label: "Claude Sonnet 4.6" },
  { value: "gpt-5.4-sandbox", label: "GPT-5.4" },
  { value: "gpt-5.4-mini-sandbox", label: "GPT-5.4 Mini" }
] as const;

export const permissionModeOptions = [
  { value: "review_required", label: "Review dangerous actions" },
  { value: "sandbox_only", label: "Read-only preview" },
  { value: "trusted", label: "Trusted workspace" }
] as const;

export const agentSkillCatalog = [
  ...departmentVisuals.flatMap((department) =>
    department.contextTabs.flatMap((tab) =>
      tab.bullets.slice(0, 2).map((bullet, index) => ({
        key: `${department.slug}-${tab.id}-${index + 1}`,
        departmentSlug: department.slug,
        category: tab.label,
        name: bullet,
        description: `${department.launchPrompt.replace("Launch ", "").replace("Prepare ", "")} capability for ${tab.title.toLowerCase()}.`
      }))
    )
  ),
  {
    key: "github-repository",
    departmentSlug: "engineering",
    category: "Integration",
    name: "Repository work",
    description: "Read repository context, produce changes, and keep work reviewable."
  },
  {
    key: "vercel-preview",
    departmentSlug: "engineering",
    category: "Integration",
    name: "Preview deployment",
    description: "Track staging URLs, preview health, and deployment notes."
  },
  {
    key: "stripe-billing",
    departmentSlug: "finance",
    category: "Integration",
    name: "Billing review",
    description: "Prepare billing actions and pause money movement for approval."
  },
  {
    key: "postiz-social",
    departmentSlug: "marketing",
    category: "Integration",
    name: "Social scheduling",
    description: "Draft social content and queue scheduling actions for approval."
  },
  {
    key: "support-inbox",
    departmentSlug: "support",
    category: "Inbox",
    name: "Support inbox triage",
    description: "Route customer messages and prepare response drafts."
  }
] as const;

export type AgentSkillKey = (typeof agentSkillCatalog)[number]["key"];

export function skillsForDepartment(slug: string) {
  return agentSkillCatalog.filter((skill) => skill.departmentSlug === slug || skill.category === "Integration").slice(0, 10);
}

export function normalizeSkillKeys(keys: string[] | undefined, departmentSlug: string) {
  const allowed = new Set(agentSkillCatalog.map((skill) => skill.key));
  const defaults = skillsForDepartment(departmentSlug).slice(0, 4).map((skill) => skill.key);
  const selected = (keys ?? []).filter((key) => allowed.has(key));
  return selected.length ? Array.from(new Set(selected)) : defaults;
}

