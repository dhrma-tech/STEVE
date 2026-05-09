export type DepartmentVisual = {
  slug: string;
  coverAsset: string;
  cover: {
    background: string;
    gridColor: string;
    accent: string;
    motif: string;
  };
  statusLabel: string;
  availabilityLabel: string;
  spotlightBadge?: string;
  setupPrompt: string;
  launchPrompt: string;
  contextTabs: Array<{
    id: "company" | "department" | "attachments";
    label: string;
    title: string;
    body: string;
    bullets: string[];
  }>;
};

export const departmentVisuals = [
  {
    slug: "engineering",
    coverAsset: "generated:department-cover:engineering",
    cover: {
      background:
        "radial-gradient(circle at 18% 24%, rgba(96,165,250,0.46), transparent 30%), linear-gradient(135deg, #10213d 0%, #16233a 42%, #111216 100%)",
      gridColor: "rgba(147,197,253,0.22)",
      accent: "#60a5fa",
      motif: "</>"
    },
    statusLabel: "Active",
    availabilityLabel: "Build system live",
    setupPrompt: "Define the next build objective, repository context, constraints, and acceptance checks for Engineering.",
    launchPrompt: "Launch Engineering Agent",
    contextTabs: [
      {
        id: "company",
        label: "Company",
        title: "Company build context",
        body: "Product direction, current company stage, and business-plan facts that Engineering should preserve.",
        bullets: ["Scope product increments", "Keep deployment readiness visible", "Use roadmap dependencies before task creation"]
      },
      {
        id: "department",
        label: "Engineering",
        title: "Technical operating context",
        body: "Repository, architecture, deployment, and acceptance details for product and infrastructure work.",
        bullets: ["Ship small verified changes", "Track blockers as tasks", "Keep agent actions reviewable"]
      },
      {
        id: "attachments",
        label: "Attachments",
        title: "Build references",
        body: "Specs, screenshots, data files, and generated artifacts linked to engineering work.",
        bullets: ["Business Plan.md", "Architecture notes", "Implementation checkpoints"]
      }
    ]
  },
  {
    slug: "marketing",
    coverAsset: "generated:department-cover:marketing",
    cover: {
      background:
        "radial-gradient(circle at 78% 22%, rgba(248,113,113,0.44), transparent 32%), linear-gradient(135deg, #31171b 0%, #2d2434 46%, #141416 100%)",
      gridColor: "rgba(248,113,113,0.22)",
      accent: "#f87171",
      motif: "SEO"
    },
    statusLabel: "Active",
    availabilityLabel: "Content engine live",
    setupPrompt: "Choose the campaign goal, audience signal, channel, and proof points Marketing should turn into output.",
    launchPrompt: "Launch Marketing Agent",
    contextTabs: [
      {
        id: "company",
        label: "Company",
        title: "Positioning context",
        body: "Company description, primary customer, market angle, and brand-kit constraints.",
        bullets: ["Use founder answers", "Respect brand tone", "Connect output to roadmap stage"]
      },
      {
        id: "department",
        label: "Marketing",
        title: "Channel context",
        body: "Content, SEO, social publishing, campaign experiments, and distribution notes.",
        bullets: ["Prefer repeatable channels", "Track campaign tasks", "Surface approval needs"]
      },
      {
        id: "attachments",
        label: "Attachments",
        title: "Marketing references",
        body: "Campaign briefs, brand assets, positioning drafts, and generated content files.",
        bullets: ["Brand kit", "Business Plan.md", "Content drafts"]
      }
    ]
  },
  {
    slug: "sales",
    coverAsset: "generated:department-cover:sales",
    cover: {
      background:
        "radial-gradient(circle at 28% 76%, rgba(34,197,94,0.46), transparent 30%), linear-gradient(135deg, #102d1f 0%, #1e2c24 48%, #111414 100%)",
      gridColor: "rgba(74,222,128,0.2)",
      accent: "#22c55e",
      motif: "+1"
    },
    statusLabel: "Active",
    availabilityLabel: "Outbound ready",
    spotlightBadge: "+1",
    setupPrompt: "Describe the ICP, prospect source, offer, and handoff rule Sales should use for the next opportunity loop.",
    launchPrompt: "Launch Sales Agent",
    contextTabs: [
      {
        id: "company",
        label: "Company",
        title: "Customer context",
        body: "Ideal customer, switching trigger, pricing posture, and first-100-customer plan.",
        bullets: ["Use onboarding answers", "Avoid unsupported claims", "Prioritize qualified opportunities"]
      },
      {
        id: "department",
        label: "Sales",
        title: "Pipeline context",
        body: "Prospects, outbound workflows, opportunity qualification, and approval points.",
        bullets: ["Track next action", "Keep outreach auditable", "Escalate approvals"]
      },
      {
        id: "attachments",
        label: "Attachments",
        title: "Sales references",
        body: "Prospect lists, call notes, outreach drafts, and opportunity files.",
        bullets: ["Prospect CSVs", "Outbound scripts", "Deal notes"]
      }
    ]
  },
  {
    slug: "design",
    coverAsset: "generated:department-cover:design",
    cover: {
      background:
        "radial-gradient(circle at 70% 70%, rgba(251,191,36,0.26), transparent 30%), radial-gradient(circle at 18% 22%, rgba(96,165,250,0.42), transparent 34%), linear-gradient(135deg, #142239 0%, #282035 52%, #111216 100%)",
      gridColor: "rgba(191,219,254,0.2)",
      accent: "#93c5fd",
      motif: "UI"
    },
    statusLabel: "Active",
    availabilityLabel: "Brand kit live",
    setupPrompt: "Select the brand or interface objective, references, constraints, and output format for Design.",
    launchPrompt: "Launch Design Agent",
    contextTabs: [
      {
        id: "company",
        label: "Company",
        title: "Brand context",
        body: "Approved design onboarding choices, visual references, company voice, and market category.",
        bullets: ["Use approved kit", "Respect accessibility", "Keep original assets"]
      },
      {
        id: "department",
        label: "Design",
        title: "Creative context",
        body: "Brand identity, product UI, generated assets, and visual QA notes.",
        bullets: ["Design for app workflows", "Use generated/original art", "Preserve responsive behavior"]
      },
      {
        id: "attachments",
        label: "Attachments",
        title: "Design references",
        body: "Uploaded references, brand kit output, screenshots, and asset files.",
        bullets: ["Reference uploads", "Brand kit", "UI screenshots"]
      }
    ]
  },
  {
    slug: "support",
    coverAsset: "generated:department-cover:support",
    cover: {
      background:
        "radial-gradient(circle at 76% 24%, rgba(167,139,250,0.4), transparent 34%), linear-gradient(135deg, #221a39 0%, #252233 48%, #141416 100%)",
      gridColor: "rgba(196,181,253,0.18)",
      accent: "#a78bfa",
      motif: "?"
    },
    statusLabel: "Coming soon",
    availabilityLabel: "Unlocks with support readiness",
    setupPrompt: "Capture the support channel, response promise, escalation path, and help-center material Support will need.",
    launchPrompt: "Prepare Support Agent",
    contextTabs: [
      {
        id: "company",
        label: "Company",
        title: "Customer promise",
        body: "Support expectations, product maturity, and customer segments that shape response workflows.",
        bullets: ["Map customer touchpoints", "Define escalation owner", "Connect to launch stage"]
      },
      {
        id: "department",
        label: "Support",
        title: "Support context",
        body: "Inbox routing, help content, response patterns, and unresolved-customer workflows.",
        bullets: ["Draft support macros", "Track unresolved issues", "Protect customer context"]
      },
      {
        id: "attachments",
        label: "Attachments",
        title: "Support references",
        body: "Help articles, support logs, customer files, and escalation references.",
        bullets: ["Help docs", "Support exports", "Issue examples"]
      }
    ]
  },
  {
    slug: "operations",
    coverAsset: "generated:department-cover:operations",
    cover: {
      background:
        "radial-gradient(circle at 20% 78%, rgba(129,140,248,0.4), transparent 32%), linear-gradient(135deg, #171b35 0%, #222637 50%, #111214 100%)",
      gridColor: "rgba(165,180,252,0.18)",
      accent: "#818cf8",
      motif: "OPS"
    },
    statusLabel: "Coming soon",
    availabilityLabel: "Unlocks with operating cadence",
    setupPrompt: "Describe the operating rhythm, owner, handoff, and review cadence Operations should stabilize.",
    launchPrompt: "Prepare Operations Agent",
    contextTabs: [
      {
        id: "company",
        label: "Company",
        title: "Operating context",
        body: "Company stage, recurring workflows, owner map, and systems that need coordination.",
        bullets: ["Clarify owners", "Document cadence", "Reduce handoff loss"]
      },
      {
        id: "department",
        label: "Operations",
        title: "Process context",
        body: "Internal systems, SOPs, cross-functional handoffs, and operating cadence.",
        bullets: ["Track recurring work", "Surface blocked processes", "Codify repeatable playbooks"]
      },
      {
        id: "attachments",
        label: "Attachments",
        title: "Operations references",
        body: "Process docs, checklists, workspace exports, and operating reports.",
        bullets: ["SOPs", "Checklists", "Weekly reviews"]
      }
    ]
  },
  {
    slug: "finance",
    coverAsset: "generated:department-cover:finance",
    cover: {
      background:
        "radial-gradient(circle at 72% 72%, rgba(234,179,8,0.38), transparent 32%), linear-gradient(135deg, #2b2814 0%, #272619 44%, #131414 100%)",
      gridColor: "rgba(250,204,21,0.18)",
      accent: "#eab308",
      motif: "$"
    },
    statusLabel: "Coming soon",
    availabilityLabel: "Unlocks with billing/bookkeeping",
    setupPrompt: "Summarize the billing model, bookkeeping state, unit-economic question, and approval boundary for Finance.",
    launchPrompt: "Prepare Finance Agent",
    contextTabs: [
      {
        id: "company",
        label: "Company",
        title: "Business model context",
        body: "Pricing, revenue stage, cost assumptions, and financial readiness signals.",
        bullets: ["Keep sandbox math labeled", "Track approvals", "Connect to billing roadmap"]
      },
      {
        id: "department",
        label: "Finance",
        title: "Finance context",
        body: "Bookkeeping, billing readiness, unit economics, bank/accounting tasks, and financial approvals.",
        bullets: ["Never imply live provider access", "Separate estimates from actuals", "Escalate money movement"]
      },
      {
        id: "attachments",
        label: "Attachments",
        title: "Finance references",
        body: "Invoices, pricing notes, usage reports, and accounting exports.",
        bullets: ["Billing reports", "Pricing model", "Bookkeeping exports"]
      }
    ]
  },
  {
    slug: "legal",
    coverAsset: "generated:department-cover:legal",
    cover: {
      background:
        "radial-gradient(circle at 18% 20%, rgba(209,213,219,0.34), transparent 30%), linear-gradient(135deg, #232527 0%, #1d2427 48%, #121314 100%)",
      gridColor: "rgba(229,231,235,0.16)",
      accent: "#d1d5db",
      motif: "LAW"
    },
    statusLabel: "Coming soon",
    availabilityLabel: "Unlocks with incorporation/compliance",
    setupPrompt: "List the legal task, jurisdiction context, approval need, and documents Legal should prepare for review.",
    launchPrompt: "Prepare Legal Agent",
    contextTabs: [
      {
        id: "company",
        label: "Company",
        title: "Company legal context",
        body: "Formation status, compliance constraints, terms/privacy surfaces, and founder approval points.",
        bullets: ["Flag human review", "Preserve source limitations", "Separate drafts from advice"]
      },
      {
        id: "department",
        label: "Legal",
        title: "Legal workflow context",
        body: "Incorporation, terms, compliance tasks, documents, and approval gates.",
        bullets: ["Require approval for filing", "Track jurisdiction assumptions", "Keep drafts auditable"]
      },
      {
        id: "attachments",
        label: "Attachments",
        title: "Legal references",
        body: "Draft terms, privacy docs, incorporation files, and compliance notes.",
        bullets: ["Terms draft", "Privacy draft", "Incorporation docs"]
      }
    ]
  }
] as const satisfies DepartmentVisual[];

const departmentVisualMap: Map<string, DepartmentVisual> = new Map(departmentVisuals.map((department) => [department.slug, department]));

export function getDepartmentVisual(slug: string): DepartmentVisual {
  return (
    departmentVisualMap.get(slug) ?? {
      slug,
      coverAsset: `generated:department-cover:${slug}`,
      cover: {
        background: "linear-gradient(135deg, #242428 0%, #17171a 100%)",
        gridColor: "rgba(255,255,255,0.14)",
        accent: "#eeeee8",
        motif: slug.slice(0, 3).toUpperCase()
      },
      statusLabel: "Active",
      availabilityLabel: "Department available",
      setupPrompt: "Provide the department objective, available context, constraints, and acceptance checks.",
      launchPrompt: "Launch Agent",
      contextTabs: [
        {
          id: "company",
          label: "Company",
          title: "Company context",
          body: "Company facts and founder inputs that should guide this department.",
          bullets: ["Use current organization context", "Connect work to roadmap", "Track assumptions"]
        },
        {
          id: "department",
          label: "Department",
          title: "Department context",
          body: "Department-specific notes, goals, and constraints.",
          bullets: ["Capture instructions", "Track open work", "Review outputs"]
        },
        {
          id: "attachments",
          label: "Attachments",
          title: "Department references",
          body: "Files and generated artifacts connected to this department.",
          bullets: ["Reference files", "Generated assets", "Review notes"]
        }
      ]
    }
  );
}

export function initialDepartmentContext(slug: string) {
  const visual = getDepartmentVisual(slug);
  return {
    source: "activation",
    slug,
    setupPrompt: visual.setupPrompt,
    contextTabs: visual.contextTabs.map((tab) => tab.id),
    updatedAt: null
  };
}

export function resolveDepartmentCoverAsset(slug: string, storedCoverAsset: string | null | undefined) {
  if (storedCoverAsset && !storedCoverAsset.startsWith("/assets/departments/")) {
    return storedCoverAsset;
  }

  return getDepartmentVisual(slug).coverAsset;
}
