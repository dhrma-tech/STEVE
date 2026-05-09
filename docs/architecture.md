# Architecture

## Architecture Decision
Use a single Next.js application repository with TypeScript. The source notes point to a Next/React product, and the cloned repository is empty; a single app keeps delivery practical while supporting public marketing routes, authenticated app routes, API route handlers, and shared components in one codebase.

## Technical Stack
- Framework: Next.js App Router with React and TypeScript.
- Styling: Tailwind CSS plus CSS custom properties for the documented token system.
- Components: local component library, Radix UI primitives for dialogs/popovers/tabs/accordion/menus, lucide-react icons.
- Motion: Framer Motion for routed and component motion; CSS keyframes for verified marketing animations.
- Canvas: React Flow for orbital canvas and agent workspace graph elements.
- Forms: React Hook Form with Zod validation.
- Data fetching: TanStack Query for client-side server state.
- Server API: Next.js route handlers under `/api`.
- Database: relational schema implemented through Prisma migrations.
- Local database: SQLite for credential-free local development.
- Production database target: PostgreSQL/Supabase-compatible relational model.
- Auth: Auth.js/NextAuth GitHub provider when credentials exist; sandbox adapter in local development when credentials are absent.
- Files: local filesystem/S3-compatible adapter abstraction.
- Background work: in-process queue for local development, provider adapter interface for production workers.
- Testing: Vitest, Testing Library, Playwright.

## Decision Rationale
- Single repo avoids monorepo overhead for an empty project.
- App Router covers both marketing and app surfaces.
- React Flow matches verified DOM evidence for the canvas.
- Route handlers make API behavior explicit for `docs/api-spec.md`.
- Prisma gives schema/migration discipline after Phase 1.
- SQLite enables local verification without requiring the user to install Postgres. The documented schema remains relational and portable.

## Runtime Modes

### Sandbox Mode
Default when external credentials are missing.
- GitHub OAuth button creates a local GitHub-style sandbox session.
- GitHub repo provisioning creates provider records and sandbox URLs.
- Vercel provisioning creates deployment records and deterministic fake links.
- Supabase provisioning creates managed DB records.
- Stripe/Postiz/Apify/domain/email integrations save configuration/status locally.
- Agent execution uses deterministic simulated actions and logs.

### Provider Mode
Enabled by environment variables.
- Real GitHub OAuth and repo integration.
- Real provider adapters for Vercel, Supabase, Stripe, Postiz, Apify, email/domain services.
- Provider errors surface in app error states.

Provider mode is architecture-ready, but Phase 1 schema and API must support both modes without silent schema drift.

## Folder Structure
Planned structure after Execution Phase 1:

```text
STEVE/
  docs/
  prisma/
    schema.prisma
    migrations/
    seed.ts
  public/
    assets/
      pixel/
      app-mockups/
  src/
    app/
      (marketing)/
        page.tsx
        pricing/
        resources/
        how-to/
        privacy-policy/
        terms/
        terms-of-service/
        docs/
      (auth)/
        login/
        onboarding/
      org/
        [orgId]/
          onboarding/
          canvas/
          settings/
          integrations/
      api/
        auth/
        onboarding/
        orgs/
        departments/
        roadmap/
        tasks/
        agents/
        chat/
        files/
        settings/
        billing/
        integrations/
    components/
      marketing/
      app-shell/
      canvas/
      departments/
      roadmap/
      tasks/
      agents/
      chat/
      files/
      settings/
      ui/
    data/
      seed/
      roadmap.ts
      departments.ts
      marketing-content.ts
    lib/
      auth/
      db/
      providers/
      queue/
      roadmap/
      tasks/
      files/
      validation/
      utils/
    styles/
      globals.css
      tokens.css
      motion.css
    test/
      fixtures/
      e2e/
```

## Rendering Strategy
- Marketing pages: mostly static/server-rendered with client islands for hero notifications, calculator, accordions, carousels, wordsearch, and mobile menu.
- App pages: authenticated server shell plus client-side interactive surfaces.
- Canvas/React Flow: client-only component.
- Roadmap modal: client-side overlay backed by API data.
- Settings forms: server-loaded data, client mutations.
- Agent workspace: client component with polling/SSE-ready update layer.

## State Management
- Server state: TanStack Query.
- Local UI state: React state and lightweight Zustand stores for canvas viewport, panel tabs, modal state, command palette, and temporary composer input.
- Persistent user/org state: database.
- Session state: Auth.js session plus last org slug stored in cookie/local state.
- Roadmap unlock state: computed from roadmap item completions and persisted status.

## Data Fetching Pattern
- API route handlers return JSON envelopes:
  - `data` on success.
  - `error` with code/message/details on failure.
- Client hooks live beside feature modules.
- Mutations use optimistic updates only where rollback is safe: task status toggles, comments, file archive, UI preferences.
- Destructive mutations require explicit confirmation and no optimistic delete unless restorable.

## Auth Architecture
- User-facing auth method: GitHub only.
- Session stores user id and active org/member roles.
- Guards:
  - Public: marketing/legal/resources.
  - Authenticated: onboarding.
  - Org member: canvas, tasks, files, chat.
  - Org admin: settings organization, integrations, advanced, billing.
  - Billing owner/admin: plan changes.
- Sandbox auth is explicitly marked in UI and provider records.

## Authorization Model
- Organization role enum: owner, admin, member, billing.
- Object ownership is org-scoped.
- Task/agent/file actions require organization membership.
- Provider secret values are write-only and never returned after save.
- Dangerous actions require approval records.

## Background Jobs
Local queue capabilities:
- Company provisioning.
- Business plan generation.
- Brand kit generation.
- Agent task execution.
- File processing/versioning.
- Usage rollups.

Each job writes `agent_actions`, `task_sessions`, or `integration_events` records so UI can show progress.

## Provider Adapters
Interfaces:
- `AuthProvider`
- `GitHubProvider`
- `VercelProvider`
- `SupabaseProvider`
- `StripeProvider`
- `PostizProvider`
- `ApifyProvider`
- `EmailDomainProvider`
- `AnalyticsProvider`
- `SupportProvider`
- `AIProvider`

All adapters expose:
- `mode`: `sandbox` or `provider`.
- `status`: connected, needs_config, error.
- `lastCheckedAt`.
- structured errors.

## Deployment Assumptions
- Primary deployment target: Vercel-compatible Next.js hosting.
- Database: PostgreSQL-compatible in production.
- File storage: S3-compatible in production.
- Workers can be split out later without schema change because jobs/actions are persisted.

## Environment Variables
Expected but optional in sandbox:
- `AUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VERCEL_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POSTIZ_API_KEY`
- `APIFY_TOKEN`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

## Error Handling
- Route handlers map known failures to API error codes.
- Provider errors are stored and shown on integration surfaces.
- Client boundaries catch page-level failures.
- Empty/loading/error components are part of the component registry after Execution Phase 2.

## Schema Freeze Rule
`docs/database-schema.md` is frozen after this planning phase. Any future schema change must:
- Add a migration file.
- Add a DECISIONS.md entry.
- Update API spec if request/response shapes change.
- Note the drift in SCRATCHPAD.md and the relevant checkpoint.

