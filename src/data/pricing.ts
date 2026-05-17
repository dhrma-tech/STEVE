export type PlanId = "trial" | "pro" | "team";

export type PricingPlan = {
  id: PlanId;
  name: string;
  price: string;
  period?: string;
  description: string;
  usageIncluded: string;
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
  comingSoon?: boolean;
  features: string[];
};

export const pricingPlans: PricingPlan[] = [
  {
    id: "trial",
    name: "Free Trial",
    price: "0",
    period: "7 days",
    description: "Start with a managed company workspace and enough included usage to evaluate the operating loop.",
    usageIncluded: "$15 usage included",
    cta: "Start free trial",
    ctaHref: "/login",
    features: ["7 day trial", "$15 included usage", "Managed agent workspace", "GitHub, Supabase, and Vercel graduation path"]
  },
  {
    id: "pro",
    name: "Cofounder Pro",
    price: "20",
    period: "/month + usage",
    description: "Run the full founder workspace with active departments, tasks, files, and managed integrations.",
    usageIncluded: "Usage billed separately",
    cta: "Run a company",
    ctaHref: "/login",
    highlighted: true,
    features: ["8 department system", "Agent tasks and approvals", "Roadmap and tech tree", "All managed integrations included"]
  },
  {
    id: "team",
    name: "Team Plan",
    price: "50",
    period: "/month",
    description: "Multiplayer, shared billing, and SOC 2 for teams ready to run together. Coming soon.",
    usageIncluded: "Coming soon",
    cta: "Join waitlist",
    ctaHref: "/login?plan=team",
    comingSoon: true,
    features: ["Team members", "Shared billing", "Role-aware organization settings", "Coming soon state"]
  }
];

export const pricingFaq = [
  {
    question: "How does the trial work?",
    answer: "The Free Trial lasts 7 days and includes $15 of usage so you can run onboarding, activate departments, and complete your first agent task before deciding to upgrade."
  },
  {
    question: "What does Pro cost?",
    answer: "Cofounder Pro starts at $20 per month plus usage. We show usage by category — tokens, compute, database, support, ad spend, data purchasing — so you always know what you're paying for."
  },
  {
    question: "What are managed services?",
    answer: "We provision and operate your GitHub repo, Supabase database, Vercel deployments, Stripe billing, Postiz publishing, email, and other providers on your behalf. You don't need accounts of your own to ship — but you can connect or graduate to your own at any time."
  },
  {
    question: "Can I graduate my data?",
    answer: "Yes. From Settings → Advanced you can switch your workspace to your own GitHub repo, import your own Supabase project, and move every managed asset into accounts you control."
  },
  {
    question: "How is Team different from Pro?",
    answer: "Team adds multiplayer for shared organizations, SOC 2-compliant infrastructure, priority support, and consolidated billing. It is launching soon — join the waitlist from the pricing page."
  },
  {
    question: "What use cases fit Cofounder?",
    answer: "Solo founders and small teams who want to build, launch, and run a company without hiring a full staff. Cofounder ships agents for engineering, marketing, sales, design, support, operations, finance, and legal."
  },
  {
    question: "Does it help with sales and marketing?",
    answer: "Yes. Connect Postiz for social publishing, send outbound email from agent inboxes, enrich and qualify prospects, run campaigns, and track open rates inside the workspace."
  },
  {
    question: "Can I use my own repo?",
    answer: "Yes. Bring your own GitHub repository and Supabase project from Settings → Advanced. We do not currently support bring-your-own-key (BYOK) for AI models — usage runs through our metered Claude tier."
  }
];

export const featureComparison = [
  { feature: "Company onboarding", trial: "Included", pro: "Included", team: "Included" },
  { feature: "8 department entities", trial: "Included", pro: "Included", team: "Included" },
  { feature: "Agent task sessions", trial: "Limited by usage", pro: "Usage based", team: "Usage based" },
  { feature: "Files and business plan", trial: "Included", pro: "Included", team: "Included" },
  { feature: "Managed integrations", trial: "Sandbox/managed", pro: "Managed + graduation", team: "Managed + graduation" },
  { feature: "Team members", trial: "Not included", pro: "Single founder", team: "Coming soon" },
  { feature: "Billing dashboard", trial: "Trial usage", pro: "Plan + usage", team: "Coming soon" }
];

