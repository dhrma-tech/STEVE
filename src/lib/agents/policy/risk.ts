/**
 * Risk classification for agent tools.
 *
 * Kept as one central table (not spread over the tool files) so the whole surface can be
 * audited at a glance. A test asserts every registered tool has an entry; a tool that is
 * missing from the table is treated as `external_write`, so an unclassified tool asks for
 * approval instead of running silently.
 */

export type ToolRisk =
  | "read" //             no side effects
  | "write_internal" //   changes STEVE data only, reversible
  | "destructive" //      irreversible inside STEVE
  | "external_write" //   changes a third-party system
  | "external_comms" //   contacts people or publishes publicly
  | "spend" //            costs money or ships to production
  | "delegate"; //        starts another agent

export const TOOL_RISK: Record<string, ToolRisk> = {
  // Research and reads
  web_search: "read",
  read_file: "read",
  list_files: "read",
  memory_retrieve: "read",
  memory_list: "read",
  github_list_repos: "read",
  github_read_file: "read",
  vercel_list_deployments: "read",
  vercel_get_deployment: "read",
  stripe_list_products: "read",
  supabase_list_tables: "read",
  posthog_get_events: "read",
  sentry_list_issues: "read",
  postiz_list_posts: "read",
  email_list_sent: "read",
  support_list_threads: "read",

  // Internal, reversible writes
  write_file: "write_internal",
  memory_store: "write_internal",
  create_task: "write_internal",
  update_task: "write_internal",
  assign_task: "write_internal",

  // Irreversible inside STEVE
  delete_file: "destructive",

  // Third-party writes
  github_create_branch: "external_write",
  github_push_file: "external_write",
  github_create_pr: "external_write",
  supabase_create_bucket: "external_write",
  postiz_create_post: "external_write", // draft only
  apify_search_prospects: "external_write", // consumes Apify credits
  apify_run_actor: "external_write",

  // Reaches real people or the public
  email_send: "external_comms",
  support_create_thread: "external_comms",
  support_reply_to_thread: "external_comms",
  postiz_schedule_post: "external_comms",

  // Money and production
  stripe_create_product: "spend",
  stripe_create_price: "spend",
  stripe_create_payment_link: "spend",
  vercel_trigger_deploy: "spend",

  // Orchestration (carried out by the run engine, bounded by the run tree's limits)
  delegate_agent: "delegate",
  delegate_many: "delegate",
  ask_agent: "delegate",
  // Pausing to ask the founder and handing back a result have no effect outside the run.
  ask_user: "read",
  finish_run: "read",
  // Records the Chief of Staff's plan on its Plan row; nothing runs until the founder approves it.
  propose_plan: "write_internal"
};

/** Risks that can never be pre-approved for a run or an agent: every use needs a fresh human decision. */
export const ALWAYS_ASK_RISKS: ReadonlySet<ToolRisk> = new Set<ToolRisk>(["external_comms", "spend"]);

const READ_ONLY_SQL = /^\s*(?:with\b[\s\S]*?\bselect\b|select\b|explain\b|show\b)/i;
const WRITING_SQL = /\b(?:insert|update|delete|drop|alter|truncate|create|grant|revoke|merge|copy|call|do)\b/i;

/** Read-only, single-statement SQL. Anything else is treated as a write. */
export function isReadOnlySql(sql: string): boolean {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (!READ_ONLY_SQL.test(trimmed)) return false;
  if (trimmed.includes(";")) return false; // multiple statements
  return !WRITING_SQL.test(trimmed);
}

/** Risk of one concrete call. Most tools have a fixed risk; SQL depends on the statement. */
export function classifyToolCall(toolName: string, input: Record<string, unknown> = {}): ToolRisk {
  if (toolName === "supabase_run_query") {
    return typeof input.sql === "string" && isReadOnlySql(input.sql) ? "read" : "external_write";
  }
  return TOOL_RISK[toolName] ?? "external_write";
}

export function isClassified(toolName: string): boolean {
  return toolName === "supabase_run_query" || toolName in TOOL_RISK;
}

/** One-line, human-readable description of a call for the approval card. Never includes long bodies. */
export function summarizeToolCall(toolName: string, input: Record<string, unknown>): string {
  const short = (value: unknown, max = 80) => {
    const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
    return text.length > max ? `${text.slice(0, max)}…` : text;
  };
  switch (toolName) {
    case "email_send":
      return `Send an email to ${short(input.to)} with subject "${short(input.subject)}"`;
    case "support_reply_to_thread":
      return `Reply to support thread ${short(input.threadId)}`;
    case "support_create_thread":
      return `Open a support thread for ${short(input.customerEmail)}: "${short(input.title)}"`;
    case "postiz_schedule_post":
      return `Publish post ${short(input.postId)} at ${short(input.scheduledAt)}`;
    case "postiz_create_post":
      return `Create a social post draft: "${short(input.content)}"`;
    case "stripe_create_product":
      return `Create a Stripe product "${short(input.name)}"`;
    case "stripe_create_price":
      return `Create a Stripe price for product ${short(input.productId)}`;
    case "stripe_create_payment_link":
      return `Create a Stripe payment link`;
    case "vercel_trigger_deploy":
      return `Trigger a Vercel deployment`;
    case "github_push_file":
      return `Push ${short(input.path)} to branch ${short(input.branch)}`;
    case "github_create_pr":
      return `Open a pull request: "${short(input.title)}"`;
    case "github_create_branch":
      return `Create branch ${short(input.branch)}`;
    case "supabase_run_query":
      return `Run SQL: ${short(input.sql, 120)}`;
    case "supabase_create_bucket":
      return `Create storage bucket ${short(input.name)}`;
    case "delete_file":
      return `Delete file ${short(input.fileId ?? input.name ?? input.path)}`;
    default:
      return `${toolName}(${short(input, 100)})`;
  }
}
