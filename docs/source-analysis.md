# Source Analysis

## Source Files Read
- `# Cofounder.co - Complete Developer.txt` - developer-ready report; ends abruptly at line 594.
- `# Cofounder.co - Complete UIUX Desi.txt` - UI/UX design system report; ends abruptly at line 661.
- `Cofounder.co - Full Product Teardow.txt` - product teardown and backend/API report; ends abruptly at line 1356.
- `Cofounder.co - Precision Gap-Fill A.txt` - DevTools-verified token, DOM, animation, and asset extraction; complete through line 972.

## Evidence Model
The notes label claims as [VERIFIED], [OBSERVED], [INFERRED], and [UNKNOWN]. This build uses the following precedence:

1. [VERIFIED]
2. [OBSERVED]
3. [INFERRED]
4. [UNKNOWN]

When the precision gap-fill explicitly corrects earlier reports, its [VERIFIED] details win.

## Product Essence
Cofounder.co is an AI agent orchestration platform for founders. It presents a company as an operating system with 8 departments: Engineering, Marketing, Sales, Design, Operations, Finance, Legal, and Support. Each department can contain agents, tasks, files, context, and roadmap items. The central "Cofounder" agent coordinates company context, roadmap progress, and suggested next work.

The primary loop is:

1. Visitor reads the public site and starts the app.
2. User authenticates through GitHub OAuth.
3. User completes personal onboarding.
4. User creates a company and describes the idea.
5. AI asks 5 contextual business questions.
6. AI creates a business plan and ICP.
7. User accepts the plan.
8. Departments activate and infrastructure is provisioned.
9. User completes design onboarding or explicitly skips with risk acknowledgment.
10. User works from the orbital canvas, roadmap, department views, tasks, agents, chat, and library.

## Public Website Extraction

### Routes
- `/` homepage.
- `/pricing`.
- `/resources`.
- `/resources/introducing-cofounder-2`.
- `/how-to/start`.
- `/how-to/build`.
- `/how-to/sell`.
- `/how-to/scale`.
- `/privacy-policy`.
- `/terms` and/or `/terms-of-service` conflict. See `OPEN-QUESTIONS.md`.
- `/docs` and/or external `https://docs.cofounder.co/` conflict. See `OPEN-QUESTIONS.md`.

### Homepage Sections
- Fixed/sticky navbar with logo, How To dropdown, Start/Build/Sell/Scale links, Resources, Pricing, Log in, Run a company.
- Full viewport animated pixel-art hero with headline, subtitle, primary CTA, secondary launch CTA, floating task notification pills, and pixel grass transition.
- Product preview / platform overview with orbital department visual and AI chat panel.
- Three value propositions: Agentic departments, Human in the loop, Fully extensible.
- Four how-to chapter cards: Start, Build, Sell, Scale.
- Roadmap / company-building feature section with stage/task cards.
- Engineering demo with code/terminal/task preview.
- Sales and marketing demo with email preview and campaign report.
- Scale demo with analytics, Stripe/payments, and support.
- Tools/systems carousel with agent status cards.
- Industry word-search section.
- Footer with CTA, nav links, social links, SOC 2 security copy, copyright, design credit, and pixel-art decoration.

### Pricing
- Plans: Free Trial, Cofounder Pro, Team Plan.
- Free Trial: 7 days, $15 included usage.
- Pro: starting at $20/month plus usage.
- Team: $50/month, coming soon.
- Cost calculator: plan selector, business size slider, usage cost breakdown.
- Feature comparison matrix.
- Data graduation note for managed GitHub, Supabase, and Vercel assets.
- FAQ with 8 questions.

### Resources And Guides
- Resources page: featured launch post plus blog grid.
- Blog posts observed:
  - Announcing Cofounder 2: Run an entire company with agents - 05/03/2026.
  - An Update on Cofounder 1 - 04/29/2026.
  - Agent-Native Engineering - 02/05/2026.
  - Announcing Cofounder 1.5 and our $8.7 Million Seed Round - 12/08/2025.
  - A Day in the Life of the World's Most AI Forward Company - 09/18/2025.
- How-to guide pages share a two-column sticky TOC plus article layout.
- TOC topics:
  - Start: Introduction, Should You Start, Ideas, Evaluate, Wedge Market, Name/Domain, Take the Leap.
  - Build: Introduction, Spec, Repository, Deployment, Secrets, Scaffold, Backend, Frontend, Production, Testing, Debugging, Infrastructure, Next.
  - Sell: Introduction, Brand, Website, First User, ICP, Competitors, Sales Motion, Workflow, Process, Improve, Marketing, Story.
  - Scale: Introduction, Scaling Loop, Analytics, Support, Unit Economics, Expand, Next.

## App Extraction

### Routes And Surfaces
- `/` or app root: auth redirect/login.
- `/login`: verified centered GitHub login layout.
- `/onboarding`: 5-step personal onboarding.
- `/org/:orgId/onboarding`: company onboarding with AI chat/questions/business plan.
- `/org/:orgId/canvas`: main canvas.
- `/org/:orgId/canvas?open_tech_tree=1`: roadmap modal.
- `/org/:orgId/canvas?session=:sessionId`: agent task workspace.
- `/org/:orgId/settings/...`: preferences, AI settings, env files, notifications, organization, inbox, support, Stripe/payments, billing, advanced.
- `/org/:orgId/integrations/postiz`: Postiz integration.
- Additional modal/menu routes from product teardown: domains, skills, integrations, billing, database, referrals.

### Auth And Onboarding
- GitHub OAuth only; no email/password flow in notes.
- Supabase Auth is verified on the real app, with split Supabase cookies.
- Onboarding collects:
  - Preferred name.
  - Technical experience: writes code, manages engineers, not technical.
  - Role: Product, Engineering, Design, Marketing, Sales, Operations, Founder/Executive, Other.
  - Company stage: Pre-idea, Idea, Pre-MVP, MVP, Customers, Revenue, Public.
  - Company name.
- Company onboarding asks for company description, generates 5 business questions, lets user answer each or "Decide all", writes a business plan, and offers "Accept & activate departments".

### Design Onboarding
- Triggered after department activation.
- 5 steps:
  1. Intro and choose vibe / skip setup.
  2. Vibe picker with 5 presets plus "None of these".
  3. Optional references upload up to 6 images and description.
  4. Brand kit generation loading screen with progress and status chips.
  5. Brand kit review with approval or iteration.
- Skip flow requires warning modal with output risk, missing/affects text, and "not recommended" copy.

### Canvas And Side Panel
- Left: React Flow style infinite canvas with dark background, pan, zoom, department nodes, central Cofounder node, dashed connectors, workspace preview cards, top controls, bottom-left inbox and new-task FAB.
- Right: side panel with tabs:
  - Home: greeting, roadmap progress card, active tasks, suggested next tasks, Cofounder input.
  - Cofounder: chat thread.
  - Company: stack status, links, agents.
  - Tasks: task list and suggested next.
  - Library: file browser, search, upload, folders.
- Department panel includes cover image, description, Agents, Tasks, Files, Context.
- Department board includes setup prompt, company/department context tabs, attachments, launch agent CTA, and roadmap strip.
- Agent workspace includes embedded browser, scratchpad, replay loading state, task chat, message copying, attachments, and composer.

### Roadmap / Tech Tree
- Stages:
  - Idea: Initial idea.
  - Initial: Pick company name, Prepare repository, Incorporate LLC.
  - Identity: Brand identity, Buy domain, Setup social presence, Define positioning, Open bank account.
  - Build: Build app, Add auth, Set up transactional email, Build marketing website, Setup outbound email, Connect Postiz, Gather prospects, Setup bookkeeping.
  - GTM: Write blog posts, Grow social presence, Send cold outreach, Run paid acquisition.
  - Launch: Deploy, Expand content engine, Launch website, Qualify opportunities.
  - Scale: Add monitoring, Optimize SEO, Start community, Close deals, Onboard accounts, Add billing, Setup support agent.
  - Mature appears in one source but has no item list. Treat as open gap.
- Card states: complete, available, locked.
- Work type labels: Agent can do this, Needs your input, Needs approval, Needs earlier steps first.
- Detail panel sections: what becomes true, how to move forward, required first, completing this unlocks, launch agent.

## Design Extraction

### Marketing System
- Warm off-white background `#f5f5f2`.
- Primary foreground `#171717`.
- Surface `#fbfbf8`.
- Hero blue `#1a6fd1`.
- Sub-pixel `0.8px` borders.
- Rounded radii: 6, 8, 12, 16, 24px.
- Typography: Neoris in source; use Plus Jakarta Sans as open alternative. Departure Mono and IBM Plex Mono are allowed alternatives.
- Hero is a high-res animated pixel-art GIF/WebM style, not a flat gradient.
- Do not copy exact artwork, layout compositions, licensed font, or wordmark.

### App System
- Canvas bg verified as `#1e1e23`.
- Side panel bg verified as `#25252b`.
- Secondary surfaces `#29292e`, `#1d1d22`.
- Text uses white opacity scale.
- App font verified as Figtree; use Figtree or Plus Jakarta Sans.
- React Flow classes and custom node types are verified in notes.

### Motion
- Hero entrance: 0.6s, cubic-bezier(0.23, 1, 0.32, 1), opacity-only in verified source.
- Notification wheel: slide/pop/wheel keyframes with blur and translate.
- Task rows: fade/blur/translate.
- Wordsearch: stroke-dashoffset draw.
- Carousels: linear infinite.
- Footer tilt: CSS vars with holographic overlays.
- Respect `prefers-reduced-motion`.

## Backend Extraction
- Auth: GitHub OAuth; Supabase Auth verified in production.
- Org tracking: org slug/current org.
- Core entities: users, organizations, memberships, onboarding state, departments, agents, tasks, task sessions, messages, files, folders, roadmap stages/items/dependencies, settings, integrations, billing, usage, secrets, inbox domains, agent inboxes.
- External providers: GitHub, Vercel, Supabase, Stripe, Postiz, Apify, domain registrar, email hosting, PostHog, Sentry, DataDog, support widget.
- Business logic: onboarding state machine, company provisioning, agent task queue, roadmap unlock engine, business plan generation, brand kit generation, billing and usage metering.

## Contradictions And Resolutions
- Legal route: `/terms` vs `/terms-of-service`; implement both with canonical `/terms`.
- Docs route: external docs vs `/docs`; implement internal `/docs` and structure links so external docs can be configured later.
- Auth layout: split screen vs centered; precision gap-fill verified centered login, so centered wins.
- Hero badge background: dark-green vs white translucent; precision gap-fill verified white translucent, so white translucent wins.
- Navbar CTA color: dark vs light; precision gap-fill verified light navbar CTA, so light wins.
- Marketing font weights: earlier 460 vs precision nav 410; precision wins.
- App background: `#0d0d0d` vs `#1e1e23`; developer-ready verification wins for main canvas.
- Department availability: all 8 departments are product core, but some observed coming soon. Build all 8 as entities with availability states.
- Mature stage: listed in product loop but no tasks listed. Keep stage as a stage with empty/locked default and log source gap.

## Verification Implications
Every phase must verify against:
- This source analysis.
- `docs/product-spec.md`.
- `OPEN-QUESTIONS.md`.
- `DECISIONS.md`.

No app code can start until all Phase 1 docs and `checkpoint-1.md` exist.

