export type RoadmapStatus = "complete" | "available" | "locked";
export type RoadmapWorkType = "agent" | "user" | "approval";

export const roadmapWorkTypeMeta: Record<RoadmapWorkType, { label: string; actionLabel: string; description: string }> = {
  agent: {
    label: "Agent can do this",
    actionLabel: "Launch agent",
    description: "Cofounder can create a task for the default department agent."
  },
  user: {
    label: "Needs your input",
    actionLabel: "Provide input",
    description: "Founder input is required before this milestone can move forward."
  },
  approval: {
    label: "Needs approval",
    actionLabel: "Request approval",
    description: "This milestone needs an explicit approval trail before execution."
  }
};

export const roadmapStatusMeta: Record<RoadmapStatus, { label: string; description: string }> = {
  complete: {
    label: "Complete",
    description: "This milestone has been completed."
  },
  available: {
    label: "Available",
    description: "All required earlier milestones are complete."
  },
  locked: {
    label: "Needs earlier steps first",
    description: "Required dependencies must be completed before this item can launch."
  }
};

export const roadmapStageDescriptions: Record<string, string> = {
  idea: "Founder idea and initial company context.",
  initial: "Name, repository, and incorporation setup.",
  identity: "Brand, domain, positioning, and finance readiness.",
  build: "Product, infrastructure, marketing website, outbound, and bookkeeping setup.",
  gtm: "Content, social, outreach, and acquisition experiments.",
  launch: "Deployment, launch website, expanded content, and opportunity qualification.",
  scale: "Monitoring, SEO, community, deals, accounts, billing, and support readiness.",
  mature: "Long-term company operations — coming as your company grows past launch."
};

export const roadmapDependencyPairs = [
  ["pick_company_name", "initial_idea"],
  ["prepare_repository", "pick_company_name"],
  ["incorporate_llc", "pick_company_name"],
  ["brand_identity", "prepare_repository"],
  ["buy_domain", "brand_identity"],
  ["setup_social_presence", "buy_domain"],
  ["define_positioning", "brand_identity"],
  ["open_bank_account", "incorporate_llc"],
  ["build_app", "prepare_repository"],
  ["build_app", "brand_identity"],
  ["add_auth", "build_app"],
  ["transactional_email", "add_auth"],
  ["transactional_email", "buy_domain"],
  ["marketing_website", "brand_identity"],
  ["marketing_website", "prepare_repository"],
  ["outbound_email", "buy_domain"],
  ["outbound_email", "define_positioning"],
  ["connect_postiz", "setup_social_presence"],
  ["gather_prospects", "define_positioning"],
  ["setup_bookkeeping", "open_bank_account"],
  ["write_blog_posts", "marketing_website"],
  ["grow_social_presence", "setup_social_presence"],
  ["send_cold_outreach", "outbound_email"],
  ["send_cold_outreach", "gather_prospects"],
  ["run_paid_acquisition", "define_positioning"],
  ["run_paid_acquisition", "marketing_website"],
  ["deploy", "build_app"],
  ["deploy", "add_auth"],
  ["expand_content_engine", "write_blog_posts"],
  ["launch_website", "deploy"],
  ["launch_website", "marketing_website"],
  ["qualify_opportunities", "gather_prospects"],
  ["qualify_opportunities", "send_cold_outreach"],
  ["add_monitoring", "deploy"],
  ["optimize_seo", "launch_website"],
  ["optimize_seo", "write_blog_posts"],
  ["start_community", "grow_social_presence"],
  ["close_deals", "qualify_opportunities"],
  ["setup_support_agent", "launch_website"],
  ["onboard_accounts", "close_deals"],
  ["onboard_accounts", "setup_support_agent"],
  ["add_billing", "open_bank_account"],
  ["add_billing", "add_auth"]
] as const satisfies ReadonlyArray<readonly [string, string]>;

export function workTypeFor(value: string): RoadmapWorkType {
  return value === "user" || value === "approval" ? value : "agent";
}

export function roadmapActionLabel(status: string, workType: string) {
  if (status === "complete") return "Completed";
  if (status === "locked") return roadmapStatusMeta.locked.label;
  return roadmapWorkTypeMeta[workTypeFor(workType)].actionLabel;
}
