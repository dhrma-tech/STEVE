# Product Specification

## Product Goal
Build a complete Cofounder.co-style company operating system where a founder can create a company, activate 8 AI departments, manage roadmap progress, create and monitor tasks, work with agents, chat with the central Cofounder agent, manage files, and configure settings, billing, and integrations.

## User Roles
- Visitor: unauthenticated public website viewer.
- Authenticated founder: GitHub-authenticated user who owns an organization.
- Organization member: invited collaborator with access to company workspace.
- Organization admin: can manage organization, billing, integrations, members, and destructive actions.
- Agent: system actor attached to a department and task session.
- Billing owner: admin with plan and usage authority.

## Global Product Rules
- GitHub OAuth is the only user-facing auth method.
- A user can create an organization/company after personal onboarding.
- Company onboarding must produce a business plan and ICP before department activation.
- All 8 departments must exist as entities.
- Dangerous/destructive actions require explicit human approval.
- External services must be surfaced as managed integrations with status.
- If real credentials are absent, provider adapters must run in sandbox mode and label that status clearly.

## Public Website

### Global Marketing Layout
- Fixed/sticky navbar, height about 91px.
- Logo text left.
- Center nav: How to dropdown, Start, Build, Sell, Scale, Resources, Pricing.
- Right nav: Log in, Run a company.
- Mobile nav: hamburger opens full-screen menu with animated entry.
- Footer on every marketing page with CTA, legal links, docs link, social links, SOC 2 security copy, copyright/design credit, and original pixel-art decoration.

### Homepage `/`
Required sections:
- Hero with original animated pixel-art style scene, H1, subtitle, Run a company CTA, Check out the launch CTA, floating task notification pills, and pixel grass transition.
- Product/platform preview with orbital department mockup and Cofounder chat mockup.
- Three value props: Agentic departments, Human in the loop, Fully extensible.
- How-to chapter grid with Start, Build, Sell, Scale cards.
- Roadmap/company-building feature preview with task types.
- Engineering demo showing code/terminal/task progress.
- Sales/marketing demo showing email preview and campaign report.
- Scale demo showing analytics, Stripe/payments, support.
- Tools/systems carousel with agent status cards.
- Industry wordsearch animation with observed industry terms.
- Footer CTA.

Interactions:
- Hero notification pills rotate.
- How To dropdown opens on hover/click and is keyboard reachable.
- CTAs route to app login or launch post.
- Mobile menu opens/closes and preserves focus.

States:
- Reduced motion disables continuous animations.
- Loading hero image uses stable layout.

### Pricing `/pricing`
Required sections:
- Header: "Start simple. Grow without limits." style, with subtitle.
- Three pricing cards:
  - Free Trial: free, 7 days, $15 usage included.
  - Cofounder Pro: starting at $20/month plus usage.
  - Team Plan: $50/month, coming soon.
- Cost calculator:
  - Plan segmented control.
  - Business size slider.
  - Breakdown: included usage, number of agents, token cost, compute cost, database cost, customer support, ad spend, data purchasing, total monthly cost.
- Feature comparison table.
- Data graduation note for GitHub/Supabase/Vercel ownership.
- FAQ accordion with 8 topics: trial, pricing, managed services, graduation, team vs pro, use cases, sales/marketing, existing codebases/BYOK.
- Plan CTAs.

### Resources `/resources`
Required sections:
- Featured post card.
- Blog grid with observed posts.
- Each card includes category/date/title/excerpt/read link.

### Blog Post `/resources/introducing-cofounder-2`
Required sections:
- Blog article shell.
- Title, date, category, hero media, body sections, related posts.
- Launch CTA.

### How-To Guides
Routes:
- `/how-to/start`
- `/how-to/build`
- `/how-to/sell`
- `/how-to/scale`

Shared requirements:
- Sticky left TOC on desktop.
- Mobile TOC becomes drawer or collapsible section.
- Article body with intro, section anchors, feature callout boxes, chapter art, and download guide button.
- Progress indicator for active section.

Chapter topics:
- Start: Introduction, Should You Start, Startup Ideas, Evaluate Ideas, Wedge Market, Name and Domain, Take the Leap.
- Build: Introduction, Spec, Repository, Deployment, Secrets, Scaffold, Backend, Frontend, Production, Testing, Debugging, Infrastructure, Next.
- Sell: Introduction, Brand, Website, First User, ICP, Competitors, Sales Motion, Workflow, Process, Improve, Marketing, Story.
- Scale: Introduction, Scaling Loop, Analytics, Support, Unit Economics, Expand, Next.

### Legal And Docs
- `/privacy-policy`: privacy content shell.
- `/terms`: canonical terms content shell.
- `/terms-of-service`: alias to terms.
- `/docs`: documentation landing page with product docs sections.

## App: Auth And Onboarding

### Login `/login`
Requirements:
- Centered full-screen layout over original pixel sky image that fades to warm surface.
- Cofounder title/logotype treatment without copying proprietary wordmark art.
- Subtitle: run an entire company with agents.
- GitHub continue button.
- Legal links.
- If authenticated but incomplete onboarding, route to `/onboarding`.
- If authenticated and onboarded, route to last organization canvas.

### Personal Onboarding `/onboarding`
Five steps:
- Name input.
- Technical experience single select: writes code, manages engineers, not technical.
- Role single select: Product, Engineering, Design, Marketing, Sales, Operations, Founder / Executive, Other.
- Company stage slider: Pre-idea, Idea, Pre-MVP, MVP, Customers, Revenue, Public.
- Company creation with company name input.

Interactions:
- Back/continue navigation.
- Step validation.
- Resume partially completed onboarding.
- Persist progress.

### Company Onboarding `/org/:orgId/onboarding`
Requirements:
- Split workspace: left activation canvas, right AI chat.
- User submits company description.
- AI generates 5 questions:
  - Primary customer segment.
  - Primary switching reason from competitors.
  - Monetization plan.
  - First 100 customers acquisition channel.
  - Current stage.
- Question modal includes pagination, 4-5 options, recommended badge, free text, Decide this one, Decide all.
- AI action logs show background work.
- Business plan document generated with Product/Service and ICP sections.
- Answered questions expandable card.
- Accept & activate departments CTA.
- Activation creates departments, default agents, roadmap seed, general library folder, business plan file, and managed integration records.

### Design Onboarding
Requirements:
- Trigger immediately after department activation unless already completed/skipped.
- Step 1 intro and choose vibe / skip setup.
- Skip warning modal with output risk, missing/affects, not recommended warning, keep setup, skip anyway.
- Step 2 vibe picker: Editorial calm, Saturated tech, Soft pop, Brutalist grid, Pastel utility, None of these.
- Step 3 optional references upload up to 6 PNG/JPG/WebP and description.
- Step 4 loading screen with progress, estimated time, COMPOSING BOARD, BALANCING PALETTE, SETTING TYPE.
- Step 5 brand kit review with palette, typography, layout examples, approve, iterate.

## App Shell
Required:
- Dark canvas app shell.
- Top-left org avatar and company selector.
- Breadcrumb that updates as user drills into department, agent, task.
- Top-right search and hamburger/action menu.
- Bottom-left inbox button and new-task FAB.
- Right side panel with tab navigation.
- Command palette or global search.
- Notification/inbox panel.
- Upgrade modal.
- Responsive behavior for mobile/tablet.

## Canvas And Dashboard
Required:
- Central Cofounder node.
- 8 department nodes orbiting in a circle.
- Dashed orbit connector and department-to-center connectors.
- Active task/agent connector lines.
- Pan and zoom interactions.
- Department selection switches side panel to department detail.
- Double-click/drill action opens department board.
- Session query opens agent workspace.
- Roadmap query opens tech tree modal.
- Workspace preview cards around active departments.

## Side Panel Tabs

### Home
- Time-aware greeting.
- Roadmap progress card.
- Active tasks.
- Suggested next tasks with refresh.
- Cofounder chat input.

### Cofounder
- Cofounder header with avatar/icon.
- Chat history.
- New conversation button.
- Composer with attachments and send.
- Mentions of departments.

### Company
- Company heading.
- Stack statuses: Domain, Email, Payment, Hosting.
- Links: App, Production, Staging, Repository, Vercel.
- Full agent list.

### Tasks
- Heading, list/board/calendar toggles, new task button.
- Suggested next tasks.
- Filters by status, department, assignee, type.
- Task list with status and timestamps.

### Library
- Search files.
- Upload file.
- Folder navigation.
- General folder with Business Plan.
- File details, preview, share/archive/version history.

## Departments

### Shared Department Requirements
Each department has:
- Name, slug, icon, color, status, availability.
- Description in monospace/terminal style.
- Cover image using original or generated assets.
- Default agent.
- Agents collapsible section.
- Tasks collapsible section.
- Files collapsible section.
- Context collapsible section.
- Department board with setup prompt, context tabs, attachments, launch agent CTA, roadmap strip.

### Department List
- Engineering: builds product and infrastructure; active; default Engineer agent.
- Marketing: content, channels, SEO, social; active; default Marketing agent.
- Sales: outbound, ICP, prospects, opportunities; active/has +1 badge in notes; default Sales agent.
- Design: brand kit, visual identity, design assets; active through design onboarding.
- Support: support workflows and support agent; availability may be locked until Scale.
- Operations: systems and processes; availability may be locked.
- Finance: bookkeeping, billing, unit economics; availability may be locked.
- Legal: incorporation, terms, compliance; availability may be locked.

## Roadmap And Tech Tree
Required:
- Full-screen dark modal.
- Horizontal stage board.
- Stage progress counts.
- Card states: complete, available, locked.
- Card type labels: Agent can do this, Needs your input, Needs approval, Needs earlier steps first.
- Detail panel with title/status, what becomes true, how to move forward, required first, unlocks, launch agent.
- Dependency graph controls unlocks.
- Clicking launch creates a task or asks required user input.

Stages and required items:
- Idea: Initial idea.
- Initial: Pick company name, Prepare repository, Incorporate LLC.
- Identity: Brand identity, Buy domain, Setup social presence, Define positioning, Open bank account.
- Build: Build app, Add auth, Set up transactional email, Build marketing website, Setup outbound email, Connect Postiz, Gather prospects, Setup bookkeeping.
- GTM: Write blog posts, Grow social presence, Send cold outreach, Run paid acquisition.
- Launch: Deploy, Expand content engine, Launch website, Qualify opportunities.
- Scale: Add monitoring, Optimize SEO, Start community, Close deals, Onboard accounts, Add billing, Setup support agent.
- Mature: stage shell present; items are unknown in source and must remain flagged.

## Tasks
Required:
- Create task from FAB, side panel, suggested next, roadmap card, department launch CTA.
- New task modal with large textarea, add files, execute dropdown, auto-assign dropdown, app dropdown, create task button.
- Statuses: queued, running, finished turn, ready to review, completed, blocked, canceled.
- Types: agent task, user task, agent requires approval.
- Assignments to departments/agents/members.
- Filters, search, list/board/calendar views.
- Subtasks.
- Comments.
- Attachments.
- Approval requests for dangerous actions.
- Task session for agent execution.

## Agents
Required:
- Default agents per department.
- New Agent button.
- Agent profile/configuration: name, department, model, prompt personalization, tools/skills, status, inbox, permissions.
- Launch task/session.
- Monitor execution status, elapsed time, logs/actions, browser/replay/scratchpad.
- Marketplace/skills if noted by menu.
- Agent inbox email address assignment.

## Agent Workspace
Required:
- Left workspace panel titled Agent Workspace.
- Tabs: Agent Browser, Scratchpad, Replay when finished.
- Embedded browser with staging/local URL.
- Copy link, fullscreen, open in new tab.
- Loading recording state for replay.
- Right task chat with header, info, more options, go back.
- Markdown messages, thinking blocks visible if source data contains them, code blocks, PR links, timestamps, copy message button.
- Composer with mentions, file attach, submit.

## Chat
Required:
- Cofounder chat and task chat.
- Async/streaming response UI.
- Threads/new conversation.
- Department mentions.
- File attachments.
- Action log messages such as "Ran 2 actions", "Writing to workspace", "Saving workspace files".
- Empty, loading, error, and retry states.

## Files And Library
Required:
- Folder tree.
- General folder created automatically.
- Upload files.
- Search.
- Preview common file types.
- Share links/visibility.
- Archive.
- Version history.
- Business Plan saved after onboarding.
- Department files appear in department panels.

## Settings
Required pages:
- Preferences: profile photo upload 256x256 WebP max 5MB, theme Light/System/Dark, shadows toggle, preferred name, read-only email, timezone, Vercel project access info, delete account.
- AI Settings: suggested tasks toggle, queue messages toggle, Cofounder Review Bot mode dropdown, prompt personalization 0/2000 chars, AI model selector with credit usage.
- Env Files & Secrets: upload `.env`, encrypted storage, managed Vercel staging export/download, secrets pushed to Vercel with values never stored, Vercel env links.
- Notifications: notification preferences.
- Organization: company name edit, context import from ChatGPT/Claude/Paperclip/OpenClaw/Other prompts, members, join/create organization.
- Inbox: domains, agent inboxes, domain setup.
- Support: support chat/widget surface.
- Stripe/Payments: test keys, live keys, webhook, status by mode.
- Billing: view billing and usage, plan, usage.
- Advanced: import own Supabase project, switch own GitHub repo, destructive action warnings.

## Integrations
Required:
- Postiz integration page for social publishing channels.
- GitHub managed repo status and graduation.
- Vercel project, production and staging links.
- Supabase managed database and bring-your-own advanced option.
- Stripe test/live keys and webhooks.
- Apify/content signals where marketing requires it.
- Email/domain provider surfaces for inbox/domain setup.
- Analytics/monitoring status placeholders only if backed by provider records.

## Billing
Required:
- Trial, Pro, Team plan model.
- Usage categories: AI tokens, compute, database, customer support, ad spend, data purchasing.
- Upgrade modal from trial to Pro.
- Billing dashboard link.
- Usage estimate calculator public side.
- No BYOK surfaced unless as explicit "not supported".

## Empty, Loading, Error States
Required across every page/surface:
- Loading skeletons for route data, roadmap, tasks, files, agent sessions.
- Empty states for inbox, tasks, files, agents, integrations, search results.
- Error states with retry for failed AI generation, failed provider calls, upload failure, auth failure, billing failure.
- Destructive confirmation dialogs for delete account, own repo switch, own Supabase import, skip design setup.
- No raw crashes or blank screens.

## Responsive Requirements
- Public site fully responsive.
- Mobile navbar menu.
- How-to TOC collapses/drawer.
- Pricing cards stack.
- App desktop split panel.
- Tablet: side panel can overlay or resize.
- Mobile: app uses stacked/drill-in navigation rather than unusable canvas split.
- Text must not overflow buttons/cards.

## Accessibility
- Keyboard navigation for menus, modals, tabs, accordions, sliders, canvas controls.
- Focus management in modals and mobile menu.
- Accessible labels for icon buttons.
- Reduced motion support.
- Contrast must meet readable thresholds.

## Phase Verification Checklist
This spec is the checklist for implementation. A phase is not complete until every relevant requirement above is marked:
- built
- partial
- missing

Partial and missing items must be fixed before moving to the next phase unless explicitly marked post-MVP in the notes. The notes do not mark any requested feature as post-MVP.

