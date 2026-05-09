import type { LucideIcon } from "lucide-react";
import { BriefcaseBusiness, Code2, CreditCard, Handshake, LifeBuoy, Megaphone, PenTool, Scale, Settings2 } from "lucide-react";

export const technicalExperienceOptions = [
  { value: "writes_code", label: "Writes code" },
  { value: "manages_engineers", label: "Manages engineers" },
  { value: "not_technical", label: "Not technical" }
] as const;

export const roleOptions = [
  "Product",
  "Engineering",
  "Design",
  "Marketing",
  "Sales",
  "Operations",
  "Founder / Executive",
  "Other"
] as const;

export const companyStageOptions = [
  "Pre-idea",
  "Idea",
  "Pre-MVP",
  "MVP",
  "Customers",
  "Revenue",
  "Public"
] as const;

export type DepartmentDefinition = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  availability: "active" | "coming_soon";
  lucideIcon: LucideIcon;
};

export const departmentDefinitions: DepartmentDefinition[] = [
  {
    slug: "engineering",
    name: "Engineering",
    description: "Builds products, infrastructure, deployments, and technical systems.",
    icon: "circuit",
    color: "#3b82f6",
    availability: "active",
    lucideIcon: Code2
  },
  {
    slug: "marketing",
    name: "Marketing",
    description: "Creates positioning, content engines, SEO, social publishing, and campaign signals.",
    icon: "grid",
    color: "#f87171",
    availability: "active",
    lucideIcon: Megaphone
  },
  {
    slug: "sales",
    name: "Sales",
    description: "Finds prospects, builds outbound workflows, and qualifies opportunities.",
    icon: "growth",
    color: "#22c55e",
    availability: "active",
    lucideIcon: Handshake
  },
  {
    slug: "design",
    name: "Design",
    description: "Creates the brand kit, visual identity, product UI, and creative assets.",
    icon: "palette",
    color: "#60a5fa",
    availability: "active",
    lucideIcon: PenTool
  },
  {
    slug: "support",
    name: "Support",
    description: "Handles support workflows, inboxes, and customer response systems.",
    icon: "lifebuoy",
    color: "#a78bfa",
    availability: "coming_soon",
    lucideIcon: LifeBuoy
  },
  {
    slug: "operations",
    name: "Operations",
    description: "Maintains systems, processes, handoffs, and operating cadence.",
    icon: "workflow",
    color: "#818cf8",
    availability: "coming_soon",
    lucideIcon: Settings2
  },
  {
    slug: "finance",
    name: "Finance",
    description: "Tracks bookkeeping, unit economics, billing readiness, and finance workflows.",
    icon: "ledger",
    color: "#eab308",
    availability: "coming_soon",
    lucideIcon: CreditCard
  },
  {
    slug: "legal",
    name: "Legal",
    description: "Guides incorporation, terms, compliance, and legal operating tasks.",
    icon: "scale",
    color: "#9ca3af",
    availability: "coming_soon",
    lucideIcon: Scale
  }
];

export const roadmapDefinitions = [
  { key: "idea", name: "IDEA STAGE", items: [["initial_idea", "Initial idea", "complete", "user"]] },
  {
    key: "initial",
    name: "INITIAL STAGE",
    items: [
      ["pick_company_name", "Pick company name", "complete", "user"],
      ["prepare_repository", "Prepare repository", "available", "agent"],
      ["incorporate_llc", "Incorporate LLC", "available", "approval"]
    ]
  },
  {
    key: "identity",
    name: "IDENTITY STAGE",
    items: [
      ["brand_identity", "Brand identity", "available", "agent"],
      ["buy_domain", "Buy domain", "locked", "approval"],
      ["setup_social_presence", "Setup social presence", "locked", "agent"],
      ["define_positioning", "Define positioning", "locked", "user"],
      ["open_bank_account", "Open bank account", "locked", "approval"]
    ]
  },
  {
    key: "build",
    name: "BUILD STAGE",
    items: [
      ["build_app", "Build app", "locked", "agent"],
      ["add_auth", "Add auth", "locked", "agent"],
      ["transactional_email", "Set up transactional email", "locked", "agent"],
      ["marketing_website", "Build marketing website", "locked", "agent"],
      ["outbound_email", "Setup outbound email", "locked", "agent"],
      ["connect_postiz", "Connect Postiz", "locked", "approval"],
      ["gather_prospects", "Gather prospects", "locked", "agent"],
      ["setup_bookkeeping", "Setup bookkeeping", "locked", "approval"]
    ]
  },
  {
    key: "gtm",
    name: "GTM STAGE",
    items: [
      ["write_blog_posts", "Write blog posts", "locked", "agent"],
      ["grow_social_presence", "Grow social presence", "locked", "agent"],
      ["send_cold_outreach", "Send cold outreach", "locked", "approval"],
      ["run_paid_acquisition", "Run paid acquisition", "locked", "approval"]
    ]
  },
  {
    key: "launch",
    name: "LAUNCH STAGE",
    items: [
      ["deploy", "Deploy", "locked", "agent"],
      ["expand_content_engine", "Expand content engine", "locked", "agent"],
      ["launch_website", "Launch website", "locked", "agent"],
      ["qualify_opportunities", "Qualify opportunities", "locked", "agent"]
    ]
  },
  {
    key: "scale",
    name: "SCALE STAGE",
    items: [
      ["add_monitoring", "Add monitoring", "locked", "agent"],
      ["optimize_seo", "Optimize SEO", "locked", "agent"],
      ["start_community", "Start community", "locked", "user"],
      ["close_deals", "Close deals", "locked", "user"],
      ["onboard_accounts", "Onboard accounts", "locked", "agent"],
      ["add_billing", "Add billing", "locked", "approval"],
      ["setup_support_agent", "Setup support agent", "locked", "agent"]
    ]
  },
  { key: "mature", name: "MATURE STAGE", items: [] }
] as const;

export const integrationProviders = [
  "github",
  "vercel",
  "supabase",
  "stripe",
  "postiz",
  "apify",
  "domain",
  "email",
  "posthog",
  "sentry",
  "datadog",
  "support"
] as const;

export type CompanyQuestion = {
  key: string;
  text: string;
  options: Array<{ id: string; label: string; recommended?: boolean }>;
  allowsFreeText: boolean;
};

export const companyQuestions: CompanyQuestion[] = [
  {
    key: "customer_segment",
    text: "Who is the primary customer segment?",
    options: [
      { id: "early_stage_founders", label: "Early-stage founders", recommended: true },
      { id: "solo_operators", label: "Solo operators" },
      { id: "small_teams", label: "Small teams" },
      { id: "enterprise_innovators", label: "Enterprise innovation teams" }
    ],
    allowsFreeText: true
  },
  {
    key: "switching_reason",
    text: "Why would they switch from competitors or existing workflows?",
    options: [
      { id: "speed", label: "They need faster execution", recommended: true },
      { id: "cost", label: "They need lower operating cost" },
      { id: "coordination", label: "They need less coordination overhead" },
      { id: "visibility", label: "They need clearer progress visibility" }
    ],
    allowsFreeText: true
  },
  {
    key: "monetization",
    text: "What is the monetization plan?",
    options: [
      { id: "subscription", label: "Subscription", recommended: true },
      { id: "usage_based", label: "Usage-based" },
      { id: "services", label: "Services plus software" },
      { id: "marketplace", label: "Marketplace take rate" }
    ],
    allowsFreeText: true
  },
  {
    key: "first_100_customers",
    text: "How will you reach the first 100 customers?",
    options: [
      { id: "founder_outbound", label: "Founder-led outbound", recommended: true },
      { id: "content_seo", label: "Content and SEO" },
      { id: "community", label: "Community and partnerships" },
      { id: "paid_tests", label: "Small paid acquisition tests" }
    ],
    allowsFreeText: true
  },
  {
    key: "current_stage",
    text: "What is the current company stage?",
    options: [
      { id: "idea", label: "Idea", recommended: true },
      { id: "pre_mvp", label: "Pre-MVP" },
      { id: "mvp", label: "MVP" },
      { id: "customers", label: "Customers" },
      { id: "revenue", label: "Revenue" }
    ],
    allowsFreeText: true
  }
];

export const designVibes = [
  { value: "editorial_calm", label: "Editorial calm" },
  { value: "saturated_tech", label: "Saturated tech" },
  { value: "soft_pop", label: "Soft pop" },
  { value: "brutalist_grid", label: "Brutalist grid" },
  { value: "pastel_utility", label: "Pastel utility" },
  { value: "none_of_these", label: "None of these" }
] as const;

export const onboardingIcon = BriefcaseBusiness;

