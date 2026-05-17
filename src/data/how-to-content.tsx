import * as React from "react";

export type HowToChapterSlug = "start" | "build" | "sell" | "scale" | "resources";

export type HowToSection = {
  id: string;
  title: string;
  body: React.ReactNode;
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

function section(title: string, body: React.ReactNode, callout?: string): HowToSection {
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
    intro: "The initial phase of the startup lifecycle involves transitioning a conceptual hypothesis into a validated market reality while systematically mitigating personal and financial risk. This stage demands a rigorous evaluation of initial target markets, the discovery of acute pain points, and the structural establishment of the corporate entity.",
    downloadLabel: "Download start guide",
    sections: [
      section("Core Frameworks & Strategies", 
        <>
          <p><strong>The Pre-Resignation Validation Protocol:</strong> A pervasive and destructive myth within the startup ecosystem is the necessity of the "bold leap"—the idea that a founder must quit their employment and max out credit cards to build a successful company. Empirical data reveals that entrepreneurs who retain their primary employment while launching their ventures are 33% less likely to fail. The modern framework dictates a "start before you quit" approach, utilizing asynchronous hours to test independent problems and collect first-customer evidence prior to assuming total financial exposure.</p>
          <p><strong>Uncomfortably Narrow Market Wedges:</strong> Securing initial market traction requires identifying and penetrating a "killer wedge"—a strategic focal point targeting a specific product feature, use case, or highly constrained demographic. By targeting a severely underserved niche, startups can iterate rapidly, establish a monopoly over a micro-market, and generate the kinetic energy required to expand.</p>
          <ul>
            <li><strong>Rapid Feedback Wedge:</strong> Target highly accessible decision-makers to accelerate the product iteration cycle.</li>
            <li><strong>Instant Liquidity Wedge:</strong> Resolve severe cash-flow bottlenecks and capital constraints in slow-moving ecosystems.</li>
            <li><strong>10x ROI / Labor Replacement:</strong> Instantly increase gross margins or significantly cut operational expenditures for the client.</li>
            <li><strong>Compliance Wedge:</strong> Alleviate extreme customer anxieties regarding complex regulations and severe legal penalties.</li>
          </ul>
          <p><strong>The Founder-to-CEO Transition Mindset:</strong> The cognitive transition from a tactical individual contributor to a strategic executive must commence earlier than traditionally advised. Successful corporate maturation requires shifting from intuition-driven actions to data-driven decision-making and structuring intentional organizational designs.</p>
        </>
      ),
      section("Step-by-Step Execution Plan",
        <>
          <ul>
            <li><strong>Execute Minimum Viable Validation (MVV):</strong> Initiate systematic market testing without writing extensive, monolithic production code. Identify a target user, define their core job-to-be-done, and measure the frequency and severity of the pain point through targeted landing pages and deep user interviews.</li>
            <li><strong>Define and Penetrate the Core Market Wedge:</strong> Engineering and go-to-market efforts must be ruthlessly constrained to solving one specific problem exceptionally well. Deploy a Minimum Viable Product designed exclusively for that narrow cohort.</li>
            <li><strong>Structure the Initial Capital Vehicle and Cap Table:</strong> Utilize standardized, frictionless financial instruments like Simple Agreements for Future Equity (SAFEs) to secure vital operational capital rapidly without exorbitant legal fees.</li>
          </ul>
        </>
      ),
      section("Common Pitfalls & How to Avoid Them",
        <>
          <ul>
            <li><strong>The Bold Leap Fallacy and Financial Burnout:</strong> First-time founders frequently quit their primary employment before establishing undeniable market demand. Mitigation requires strict adherence to the validation protocol, treating current employment as an asset.</li>
            <li><strong>The "Platform" Illusion:</strong> Attempting to architect an all-in-one, horizontal solution dilutes the product's unique value proposition. Startups must aggressively prove dominance in a highly specific niche before expanding.</li>
          </ul>
        </>
      )
    ]
  },
  build: {
    slug: "build",
    title: "Build",
    eyebrow: "Chapter 02",
    intro: "The Build phase dictates the critical transition from conceptual architecture to a resilient, production-ready technology stack. Modern SaaS product development demands a paradigm shift toward intelligent lifecycle management, zero-trust security infrastructure, and high-velocity continuous integration workflows.",
    downloadLabel: "Download build guide",
    sections: [
      section("Core Frameworks & Strategies",
        <>
          <p><strong>Componentized Scaffolding and AI-Assisted Generation:</strong> The modern technical stack relies heavily on managed, serverless infrastructure and modular frontend frameworks. The "Ship in 7 Days" methodology highlights the supremacy of utilizing a Next.js frontend combined with BaaS providers like Supabase. Concurrently, "vibe coding" allows founders to leverage AI to translate requirements into precise specs.</p>
          <p><strong>Zero-Trust Configuration and Centralized Secrets Management:</strong> Hardcoded credentials and fragmented .env files represent critical vulnerabilities. A mature posture requires abandoning localized secrets in favor of centralized, encrypted vaults that inject secrets dynamically into CI/CD pipelines.</p>
          <ul>
            <li><strong>Immediate Mitigation:</strong> Deploy native secrets scanning within CI/CD pipelines.</li>
            <li><strong>Architectural Centralization:</strong> Establish a single, auditable source of truth (e.g., Doppler).</li>
            <li><strong>Dynamic Automation:</strong> Implement programmatic rotation for database and API credentials.</li>
          </ul>
          <p><strong>The 2025 Production Readiness Standard:</strong> Transitioning to a dependable cloud system requires real-world traffic validation and deep system observability. Track the "Four Golden Signals" (latency, traffic, errors, saturation) and establish strict performance baselines.</p>
        </>
      ),
      section("Step-by-Step Execution Plan",
        <>
          <ul>
            <li><strong>Scaffold the Foundational Application Architecture:</strong> Select a tech stack optimized for speed and automated scaling. Deploy a React-based frontend (Next.js) hosted on a global edge network (Vercel), integrated tightly with a managed backend (Supabase).</li>
            <li><strong>Establish the Continuous Deployment Pipeline (CI/CD):</strong> Eradicate manual FTP uploads in favor of automated CI/CD pipelines utilizing platforms like GitHub Actions for declarative YAML workflows.</li>
            <li><strong>Implement Telemetry, Caching, and Incident Response:</strong> Wrap the architecture in a comprehensive observability layer using APM platforms, implement strategic caching, and document operational runbooks.</li>
          </ul>
        </>
      ),
      section("Common Pitfalls & How to Avoid Them",
        <>
          <ul>
            <li><strong>The "Works on My Machine" Fallacy:</strong> Discrepancies between local and remote environments cause catastrophic failures. Mitigation requires strict version pinning, containerization where needed, and reproducible infrastructure.</li>
            <li><strong>Treating Security as an Afterthought:</strong> Delaying security implementations leads to devastating breaches. Mitigation demands immediate deployment of security tools, zero-trust models, MFA, and automated secrets rotation.</li>
          </ul>
        </>
      )
    ]
  },
  sell: {
    slug: "sell",
    title: "Sell",
    eyebrow: "Chapter 03",
    intro: "The Sell phase focuses explicitly on translating a functional, secure product into scalable, repeatable revenue streams. This phase requires the rigid systematization of go-to-market motions, precise definition of buyer personas, and the establishment of automated technical sales infrastructure.",
    downloadLabel: "Download sell guide",
    sections: [
      section("Core Frameworks & Strategies",
        <>
          <p><strong>The Hybrid Product-Led Sales (PLS) Motion:</strong> Modern SaaS growth models reject the binary choice between pure PLG and SLG, opting for a synthesized hybrid architecture. PLS leverages the product for initial acquisition, while using product usage telemetry to identify high-intent Product-Qualified Leads (PQLs) for sales intervention.</p>
          <p><strong>Real-Time Competitor Analysis:</strong> In saturated markets, buyers cross-evaluate continuously. Isolate 5-8 direct competitors and utilize automated tracking software to monitor release cycles, SEO shifts, and pricing adjustments. This feeds directly into rapidly updated sales battlecards.</p>
          <p><strong>High-Deliverability Outbound Architecture:</strong> Cold email remains highly effective if the technical infrastructure is flawless. It requires a signal-based approach—diagnosing a specific pain point—and rigid adherence to email authentication protocols to ensure inbox placement.</p>
        </>
      ),
      section("Step-by-Step Execution Plan",
        <>
          <ul>
            <li><strong>Map the Granular Ideal Customer Profile (ICP):</strong> Discard vague demographic targeting. Identify the exact sub-industry, revenue maturity, and specific daily workflows of both the economic buyer and product champion.</li>
            <li><strong>Configure High-Volume Outbound Infrastructure:</strong> Secure technical networking to prevent domain blacklisting. Configure SPF, DKIM, and DMARC policies, and enforce an automated domain warm-up schedule.</li>
            <li><strong>Establish Value-Driven Content Workflows:</strong> Inbound content and targeted social engagement serve as the foundation for warming up cold outreach. Engage with ICP prospects' content and publish thought leadership.</li>
          </ul>
        </>
      ),
      section("Common Pitfalls & How to Avoid Them",
        <>
          <ul>
            <li><strong>Ignoring Deliverability Infrastructure:</strong> Treating deliverability as copywriting rather than technical infrastructure results in spam placement. Continuously monitor domain reputation and prioritize strict DMARC alignment.</li>
            <li><strong>Premature Channel Diversification:</strong> Activating all channels (SEO, paid ads, outbound, social) simultaneously burns capital without positive ROI. Maintain intense, disciplined focus on one or two primary acquisition channels.</li>
          </ul>
        </>
      )
    ]
  },
  scale: {
    slug: "scale",
    title: "Scale",
    eyebrow: "Chapter 04",
    intro: "The Scale phase represents the transition from initial market traction to exponential growth. Success is dependent on the mathematical health of unit economics and robust internal operational loops, maintaining profit margins while expanding the product into adjacent markets.",
    downloadLabel: "Download scale guide",
    sections: [
      section("Core Frameworks & Strategies",
        <>
          <p><strong>The Unit Economics Architecture:</strong> Pursuing top-line growth without profitability leads to failure. Monitor strict ratios: LTV:CAC (minimum 3:1), CAC Payback Period (under 12-18 months), Gross Margin (70-85%), and Net Revenue Retention (&gt;110%).</p>
          <p><strong>Algorithmic Customer Support and AI-First Service:</strong> Linear increases in support headcount destroy gross margins. Transition to an AI-first architecture using purpose-built agents (e.g., Fin, Zendesk AI) empowered to execute deep backend workflows securely.</p>
          <p><strong>Adjacent Market Expansion Strategy:</strong> As the initial wedge approaches saturation, execute "adjacent innovation" by expanding into closely related markets or demographics that share structural similarities or regulatory needs.</p>
        </>
      ),
      section("Step-by-Step Execution Plan",
        <>
          <ul>
            <li><strong>Audit Infrastructure utilizing the 2x Rule:</strong> Conduct internal stress tests to ensure current processes and architectures can absorb a 100% increase in transaction volume without systemic failure before aggressively injecting capital.</li>
            <li><strong>Implement the 80/20 Automation Framework:</strong> Identify the 20% of repetitive, low-leverage tasks consuming 80% of administrative bandwidth and automate them using API integration platforms and webhook listeners.</li>
            <li><strong>Deploy Fractional-First Organizational Scaling:</strong> Fill highly specialized, strategic leadership gaps using part-time executive talent (e.g., Fractional CRO/CMO) to maintain agility and optimize cash burn.</li>
          </ul>
        </>
      ),
      section("Common Pitfalls & How to Avoid Them",
        <>
          <ul>
            <li><strong>Premature Scaling and Capital Incineration:</strong> Scaling spend before achieving positive unit economics is the primary catalyst for mortality. Accelerate capital deployment only when the LTV:CAC ratio exceeds 3:1.</li>
            <li><strong>Eroding Gross Margins via Infrastructure Costs:</strong> Bloated cloud bills and unoptimized queries erode margins. Implement continuous architectural refactoring, cloud cost-observability tools, and AI agents for support.</li>
          </ul>
        </>
      )
    ]
  },
  resources: {
    slug: "resources",
    title: "Resources",
    eyebrow: "Reference 05",
    intro: "A curated, highly relevant list of top-tier tools, communities, books, and frameworks that founders should utilize in the modern ecosystem to start, build, sell, and scale efficiently.",
    downloadLabel: "Download resource list",
    sections: [
      section("Development & Infrastructure",
        <>
          <ul>
            <li><strong>Vercel:</strong> Essential for high-velocity frontend deployments, providing seamless CI/CD integration, global edge network caching, and highly optimized hosting designed natively for Next.js applications.</li>
            <li><strong>Supabase:</strong> An open-source Backend-as-a-Service delivering a scalable PostgreSQL database, real-time data subscriptions, and robust edge functions required for rapid, full-stack application scaffolding without dedicated DevOps personnel.</li>
            <li><strong>Doppler:</strong> A centralized secrets management platform critical for securely injecting environment variables dynamically across CI/CD pipelines and preventing catastrophic, plaintext credential leaks in public repositories.</li>
            <li><strong>GitHub Actions:</strong> The ubiquitous standard for modern DevOps automation, allowing engineering teams to configure event-triggered testing, complex matrix builds, and continuous deployment workflows directly within the codebase repository.</li>
          </ul>
        </>
      ),
      section("Sales & Marketing Tools",
        <>
          <ul>
            <li><strong>PostHog:</strong> A comprehensive, open-source product analytics platform featuring a generous free tier, vital for tracking granular user behavior, identifying funnel drop-offs, and surfacing high-intent Product-Qualified Leads (PQLs).</li>
            <li><strong>Factors.ai:</strong> A sophisticated B2B marketing attribution and analytics tool necessary for mapping complex, multi-touch buyer journeys and proving exactly which marketing channels are driving tangible pipeline revenue.</li>
            <li><strong>Smartlead / Instantly:</strong> Crucial infrastructure platforms for managing high-volume B2B cold email outreach, offering automated inbox rotation, API limits, and deliverability protection necessary to bypass modern spam filters.</li>
            <li><strong>HubSpot CRM:</strong> A foundational system of record for managing customer relationships, automating early-stage lead scoring workflows, and bridging the critical data gap between marketing initiatives and sales execution.</li>
          </ul>
        </>
      ),
      section("Knowledge & Frameworks",
        <>
          <ul>
            <li><strong>The NFX Killer Wedge Framework:</strong> A mandatory strategic mental model for founders detailing exactly how to evaluate and select uncomfortably narrow initial markets to gain rapid, defensible product traction.</li>
            <li><strong>Crayon State of Competitive Intelligence Report:</strong> A critical analytical baseline providing empirical data and structural frameworks on how to execute real-time competitive analysis and outmaneuver industry rivals effectively.</li>
            <li><strong>The 80/20 Automation Framework:</strong> A highly tactical operational playbook for scaling smartly, teaching founders how to identify and automate the repetitive administrative tasks that drain organizational bandwidth and precipitate burnout.</li>
            <li><strong>SaaS Capital & Bessemer Benchmarks:</strong> The definitive financial guides for understanding acceptable industry standards regarding SaaS unit economics, CAC payback periods, and Rule of 40 growth efficiency metrics.</li>
          </ul>
        </>
      ),
      section("Community & Funding",
        <>
          <ul>
            <li><strong>Y Combinator SAFE Documents:</strong> The undisputed gold standard legal templates for early-stage capital raising, allowing startups to secure funding rapidly with minimal legal friction and standardized, founder-friendly terms.</li>
            <li><strong>Founder Institute (Entrepreneur DNA):</strong> A data-driven program and psychometric framework assisting founders in navigating the psychological and financial timing of their transition from employee to full-time entrepreneur optimally.</li>
            <li><strong>World Economic Forum UpLink:</strong> A valuable global innovation network connecting purpose-driven technology startups with key policymakers and capital allocators to transition solutions from pilot stages into commercial, at-scale operation.</li>
            <li><strong>StartupStage Operations Network:</strong> A community ecosystem providing battle-tested strategies, fractional hiring frameworks, and peer feedback specifically focused on navigating the treacherous $1M to $10M ARR scaling journey without diluting equity unnecessarily.</li>
          </ul>
        </>
      )
    ]
  }
};

export const howToSlugs = Object.keys(howToChapters) as HowToChapterSlug[];
