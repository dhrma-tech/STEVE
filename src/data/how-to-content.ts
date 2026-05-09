export type HowToChapterSlug = "start" | "build" | "sell" | "scale";

export type HowToSection = {
  id: string;
  title: string;
  body: string;
  callout?: string;
};

export type HowToChapter = {
  slug: HowToChapterSlug;
  title: string;
  eyebrow: string;
  intro: string;
  downloadLabel: string;
  sections: HowToSection[];
};

function section(title: string, body: string, callout?: string): HowToSection {
  return {
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    title,
    body,
    callout
  };
}

export const howToChapters: Record<HowToChapterSlug, HowToChapter> = {
  start: {
    slug: "start",
    title: "Start",
    eyebrow: "Chapter 01",
    intro: "Start turns a vague company impulse into a named wedge, a clear customer, and a first set of decisions Cofounder can reason about.",
    downloadLabel: "Download start guide",
    sections: [
      section("Introduction", "Begin by describing the company idea in plain language. The app uses that context to ask targeted questions before department activation."),
      section("Should You Start", "Use the decision point to test whether the problem, timing, customer pain, and founder edge are strong enough to pursue."),
      section("Startup Ideas", "Collect candidate ideas and separate the durable customer problem from the first product shape."),
      section("Evaluate Ideas", "Score ideas by customer urgency, wedge size, distribution path, build risk, and ability to learn quickly.", "Keep weak signals visible instead of deleting them; the roadmap can use them as constraints."),
      section("Wedge Market", "Choose the narrow market where the first user can understand the offer and where the company can learn fastest."),
      section("Name and Domain", "Pick a company name, check domain paths, and keep identity decisions ready for the design and legal surfaces."),
      section("Take the Leap", "Move from evaluation into company creation so onboarding can produce a business plan, ICP, roadmap seed, and departments.")
    ]
  },
  build: {
    slug: "build",
    title: "Build",
    eyebrow: "Chapter 02",
    intro: "Build converts the startup wedge into a product system: repository, deployment, secrets, backend, frontend, testing, debugging, and infrastructure.",
    downloadLabel: "Download build guide",
    sections: [
      section("Introduction", "The Build chapter frames engineering work as agent-launchable tasks with human review and visible logs."),
      section("Spec", "Start with a product spec that states the user journey, data model, integrations, edge cases, and acceptance criteria."),
      section("Repository", "Prepare a repository that agents can modify safely, with branch discipline and review links."),
      section("Deployment", "Connect production and staging targets so work can move from local changes to verifiable deployments."),
      section("Secrets", "Keep environment values out of code. The settings surface handles `.env` uploads and managed Vercel export/download flows."),
      section("Scaffold", "Create the app skeleton, route boundaries, state model, and base UI before feature work spreads."),
      section("Backend", "Wire APIs, database reads/writes, validation, auth guards, and provider adapters."),
      section("Frontend", "Compose reusable components into app surfaces with loading, empty, error, and responsive states."),
      section("Production", "Treat production readiness as a checklist: deployment, monitoring, auth, billing, and destructive action guardrails."),
      section("Testing", "Cover critical logic, key integration flows, and E2E paths for auth and billing."),
      section("Debugging", "Expose logs, task sessions, replay, command output, and retry states so failures are inspectable."),
      section("Infrastructure", "Track GitHub, Supabase, Vercel, Stripe, email, domain, analytics, and monitoring as managed integrations."),
      section("Next", "Once the product loop works, return to the roadmap and unlock the next stage rather than inventing disconnected work.")
    ]
  },
  sell: {
    slug: "sell",
    title: "Sell",
    eyebrow: "Chapter 03",
    intro: "Sell builds the customer-facing motion: brand, website, ICP, first user, competitors, sales workflow, marketing, and story.",
    downloadLabel: "Download sell guide",
    sections: [
      section("Introduction", "Sales and marketing work starts from the same company context produced during onboarding."),
      section("Brand", "Use the design onboarding output to keep visual identity, tone, palette, and references consistent."),
      section("Website", "Build the website as a working acquisition surface with pages, CTAs, pricing, resources, and legal links."),
      section("First User", "Define the first person who can feel the problem and respond to a narrow offer."),
      section("ICP", "Write the ideal customer profile with segment, switching reason, pain, trigger, objections, and buying motion."),
      section("Competitors", "Map competitors by the job customers hire them for, not only by feature lists."),
      section("Sales Motion", "Choose an initial motion: founder-led outbound, content-led demand, paid tests, community, or partnerships."),
      section("Workflow", "Turn prospecting, messaging, follow-up, qualification, and handoff into repeatable tasks."),
      section("Process", "Make each step measurable so the agent system can suggest improvements."),
      section("Improve", "Review replies, conversion, channel cost, copy, and customer learning after every loop."),
      section("Marketing", "Connect content, social, SEO, and publishing integrations to the roadmap."),
      section("Story", "Keep the public narrative grounded in customer change, not internal tooling.")
    ]
  },
  scale: {
    slug: "scale",
    title: "Scale",
    eyebrow: "Chapter 04",
    intro: "Scale adds the operating systems that keep a young company running: analytics, support, unit economics, expansion, and next-stage loops.",
    downloadLabel: "Download scale guide",
    sections: [
      section("Introduction", "Scale begins once the company needs repeatability across product, support, finance, sales, and operations."),
      section("Scaling Loop", "Turn every repeated action into a workflow with owners, inputs, outputs, and review points."),
      section("Analytics", "Add the metrics and monitoring needed to see acquisition, activation, revenue, support, and infrastructure health."),
      section("Support", "Create support workflows and a support agent surface so customer issues become visible work."),
      section("Unit Economics", "Track revenue, customer support, ad spend, data purchasing, database, compute, and token cost as live categories."),
      section("Expand", "Use successful segments and channels to unlock more customers without losing review discipline."),
      section("Next", "Move back to the tech tree, resolve locked dependencies, and decide what the next mature operating surface needs.")
    ]
  }
};

export const howToSlugs = Object.keys(howToChapters) as HowToChapterSlug[];

