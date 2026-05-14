import {
  BadgeCheck,
  Bot,
  Brain,
  BriefcaseBusiness,
  Building2,
  Code2,
  CreditCard,
  Database,
  FileText,
  GitBranch,
  Globe2,
  Handshake,
  LifeBuoy,
  Megaphone,
  PenTool,
  Rocket,
  Scale,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TerminalSquare,
  Users,
  Workflow,
  Zap
} from "lucide-react";

export const marketingNav = {
  howTo: [
    { label: "Start", href: "/how-to/start" },
    { label: "Build", href: "/how-to/build" },
    { label: "Sell", href: "/how-to/sell" },
    { label: "Scale", href: "/how-to/scale" }
  ],
  primary: [
    { label: "Resources", href: "/resources" },
    { label: "Pricing", href: "/pricing" }
  ]
};

export const chapters = [
  {
    slug: "start",
    title: "Start",
    href: "/how-to/start",
    label: "01",
    description: "Choose the wedge, name the company, and take the first step with enough context for agents to help."
  },
  {
    slug: "build",
    title: "Build",
    href: "/how-to/build",
    label: "02",
    description: "Turn a spec into a repository, deployment, backend, frontend, tests, and production workflow."
  },
  {
    slug: "sell",
    title: "Sell",
    href: "/how-to/sell",
    label: "03",
    description: "Define ICP, competitors, sales motion, outbound process, marketing, and the story around the product."
  },
  {
    slug: "scale",
    title: "Scale",
    href: "/how-to/scale",
    label: "04",
    description: "Add analytics, support, unit economics, expansion loops, and systems that keep the company moving."
  }
];

export const valueProps = [
  {
    title: "Agentic departments",
    description: "Engineering, Marketing, Sales, Design, Support, Operations, Finance, and Legal exist as first-class company systems.",
    icon: Building2
  },
  {
    title: "Human in the loop",
    description: "Dangerous actions, approvals, roadmap unlocks, and review steps keep the founder in control.",
    icon: ShieldCheck
  },
  {
    title: "Fully extensible",
    description: "Managed integrations can graduate to founder-owned GitHub, Supabase, and Vercel assets.",
    icon: Workflow
  }
];

export const departmentNodes = [
  { name: "Engineering", icon: Code2, color: "#9d8aff" },
  { name: "Marketing", icon: Megaphone, color: "#f7b267" },
  { name: "Sales", icon: Handshake, color: "#7dd3fc" },
  { name: "Design", icon: PenTool, color: "#f0abfc" },
  { name: "Support", icon: LifeBuoy, color: "#86efac" },
  { name: "Operations", icon: Settings2, color: "#fde68a" },
  { name: "Finance", icon: CreditCard, color: "#93c5fd" },
  { name: "Legal", icon: Scale, color: "#c4b5fd" }
];

export const roadmapPreview = [
  { stage: "Idea", task: "Initial idea", type: "Needs your input", status: "Complete" },
  { stage: "Initial", task: "Prepare repository", type: "Agent can do this", status: "Available" },
  { stage: "Identity", task: "Buy domain", type: "Needs approval", status: "Available" },
  { stage: "Build", task: "Add auth", type: "Agent can do this", status: "Locked" },
  { stage: "Launch", task: "Deploy", type: "Needs earlier steps first", status: "Locked" }
];

export const demos = [
  {
    eyebrow: "Engineering",
    title: "Code, terminal, and task progress in one run",
    description: "The engineering demo shows a task moving through repository work, command output, and review-ready progress.",
    icon: TerminalSquare,
    bullets: ["Prepare repository", "Scaffold backend", "Run tests", "Open review"]
  },
  {
    eyebrow: "Sales and marketing",
    title: "Outbound and content systems stay visible",
    description: "Email previews, campaign reporting, ICP work, and content loops live beside task state instead of disappearing into tools.",
    icon: Target,
    bullets: ["ICP and prospects", "Cold outreach", "Campaign report", "Story and channels"]
  },
  {
    eyebrow: "Scale",
    title: "Analytics, Stripe, and support move into operations",
    description: "The scale surface brings unit economics, payments, support workflows, and monitoring into the same company map.",
    icon: CreditCard,
    bullets: ["Add billing", "Setup support agent", "Optimize SEO", "Close deals"]
  }
];

export const toolSystems = [
  { label: "GitHub", detail: "Managed repository", icon: GitBranch, status: "Ready" },
  { label: "Supabase", detail: "Managed database", icon: Database, status: "Ready" },
  { label: "Vercel", detail: "Production + staging", icon: Globe2, status: "Ready" },
  { label: "Stripe", detail: "Payments surface", icon: CreditCard, status: "Setup" },
  { label: "Postiz", detail: "Social publishing", icon: Megaphone, status: "Connect" },
  { label: "Support", detail: "Inbox and agent", icon: LifeBuoy, status: "Soon" }
];

export const industryTerms = [
  "SaaS",
  "Devtools",
  "Marketplaces",
  "AI apps",
  "Healthcare",
  "Fintech",
  "Education",
  "Creator tools",
  "B2B services",
  "Consumer"
];

export const resourcesPosts = [
  {
    slug: "introducing-cofounder-2",
    title: "Announcing Cofounder 2: Run an entire company with agents",
    date: "05/03/2026",
    category: "Launch",
    excerpt: "A new company operating system organized around departments, roadmap progress, agents, files, and founder approval.",
    featured: true
  },
  {
    slug: "cofounder-1-update",
    title: "An Update on Cofounder 1",
    date: "04/29/2026",
    category: "Company",
    excerpt: "A product progress note about the first generation and the operating lessons that shaped the next version."
  },
  {
    slug: "agent-native-engineering",
    title: "Agent-Native Engineering",
    date: "02/05/2026",
    category: "Engineering",
    excerpt: "A look at engineering workflows designed around task sessions, logs, branches, and human review."
  },
  {
    slug: "cofounder-1-5-seed",
    title: "Announcing Cofounder 1.5 and our $8.7 Million Seed Round",
    date: "12/08/2025",
    category: "Company",
    excerpt: "A company milestone post from the observed resources list."
  },
  {
    slug: "ai-forward-company",
    title: "A Day in the Life of the World's Most AI Forward Company",
    date: "09/18/2025",
    category: "Operations",
    excerpt: "A day-in-the-life article about operating with AI-native workflows."
  }
];

export const docsSections = [
  { title: "Getting started", icon: Rocket, links: ["Create an account", "Complete onboarding", "Activate departments"] },
  { title: "Departments", icon: Bot, links: ["Engineering", "Marketing", "Sales", "Design", "Support", "Operations", "Finance", "Legal"] },
  { title: "Roadmap and tasks", icon: BadgeCheck, links: ["Tech tree", "Task types", "Approvals", "Agent sessions"] },
  { title: "Files and settings", icon: FileText, links: ["Library", "Integrations", "Billing", "Secrets"] },
  { title: "Security", icon: ShieldCheck, links: ["SOC 2 copy", "Managed services", "Graduation path"] },
  { title: "AI behavior", icon: Brain, links: ["Cofounder chat", "Suggested tasks", "Prompt personalization"] }
];

export const footerLinks = [
  { label: "Privacy", href: "/privacy-policy" },
  { label: "Terms", href: "/terms" },
  { label: "Docs", href: "/docs" },
  { label: "Resources", href: "/resources" },
  { label: "Pricing", href: "/pricing" }
];

export const heroNotifications = [
  { title: "Engineer agent finished", detail: "Prepared repository setup", status: "Ready", icon: Code2 },
  { title: "Marketing drafted ICP", detail: "3 channel bets queued", status: "Review", icon: Sparkles },
  { title: "Roadmap unlocked", detail: "Identity stage is available", status: "Next", icon: Zap },
  { title: "Support workflow staged", detail: "Scale dependency tracked", status: "Soon", icon: LifeBuoy }
];

export const legalShellSections = [
  "Account, organization, and onboarding data",
  "Company context, files, and generated business plan",
  "Managed integration status",
  "Billing, usage, and plan information",
  "Security, data graduation, and destructive action approvals"
];

export const launchArticleSections = [
  {
    heading: "A company as an operating system",
    body: "Cofounder treats your business the way a real company is treated: departments, tasks, roadmap progress, files, and chat all live in one workspace so the founder can see — and direct — every part of the operation."
  },
  {
    heading: "Eight departments, one central Cofounder",
    body: "Engineering, Marketing, Sales, Design, Support, Operations, Finance, and Legal each ship as a first-class department with its own agents and context, orbiting a central Cofounder agent that keeps everything coherent."
  },
  {
    heading: "Roadmap before random work",
    body: "The roadmap and tech tree turn company-building into a structured sequence: stages, dependencies, approval points, and agent-launchable work. You always know what to do next — and what it unlocks."
  },
  {
    heading: "Managed services with a graduation path",
    body: "We provision and run GitHub, Supabase, Vercel, Stripe, Postiz, domains, and email on your behalf so you can ship from day one. When you outgrow managed, graduate every asset into accounts you own — without lock-in."
  }
];

export const originalAssetDecision = {
  method: "CSS pixel-art and interface mockups built from original geometry, gradients, and data-driven cards.",
  basis: "The notes require original assets inspired by Cofounder patterns without copying proprietary art or wordmarks."
};

export const companyStats = [
  { label: "Departments", value: "8", icon: BriefcaseBusiness },
  { label: "Roadmap stages", value: "9", icon: Workflow },
  { label: "Core surfaces", value: "17", icon: Building2 },
  { label: "Human approvals", value: "Always", icon: Users }
];

