export type PlanId = "trial" | "pro" | "team";

export type PricingPlan = {
  id: PlanId;
  name: string;
  price: string;
  period?: string;
  description: string;
  usageIncluded: string;
  cta: string;
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
    highlighted: true,
    features: ["8 department system", "Agent tasks and approvals", "Roadmap and tech tree", "Managed integrations with sandbox fallback"]
  },
  {
    id: "team",
    name: "Team Plan",
    price: "50",
    period: "/month",
    description: "A collaboration plan for teams. The source notes mark this plan as coming soon.",
    usageIncluded: "Coming soon",
    cta: "Join waitlist",
    comingSoon: true,
    features: ["Team members", "Shared billing", "Role-aware organization settings", "Coming soon state"]
  }
];

export const pricingFaq = [
  {
    question: "How does the trial work?",
    answer: "The Free Trial lasts 7 days and includes $15 of usage so a founder can run the onboarding and first task loops before upgrading."
  },
  {
    question: "What does Pro cost?",
    answer: "Cofounder Pro starts at $20 per month plus usage. Usage is shown by category so token, compute, database, support, ad spend, and data purchasing remain visible."
  },
  {
    question: "What are managed services?",
    answer: "Managed services represent the workspace's GitHub, Supabase, Vercel, Stripe, Postiz, email, and provider surfaces. Local development uses sandbox adapters until real credentials are supplied."
  },
  {
    question: "Can I graduate my data?",
    answer: "Yes. The notes require a data graduation path for managed GitHub, Supabase, and Vercel assets so founders can own and move their infrastructure."
  },
  {
    question: "How is Team different from Pro?",
    answer: "Team is priced at $50/month and marked coming soon in the source notes. It is represented as a visible plan without active checkout."
  },
  {
    question: "What use cases fit Cofounder?",
    answer: "The product is built around creating and operating a company with AI departments for engineering, marketing, sales, design, support, operations, finance, and legal."
  },
  {
    question: "Does it help with sales and marketing?",
    answer: "Yes. The public site and app specs include social publishing, outbound email, prospects, campaign reports, ICP work, and content systems."
  },
  {
    question: "Can I use existing codebases or BYOK?",
    answer: "Existing repo and Supabase import appear as advanced settings. BYOK is not surfaced unless explicitly marked as not supported."
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

