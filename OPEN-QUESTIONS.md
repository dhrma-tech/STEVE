# OPEN-QUESTIONS.md

## Source Integrity
- [QUESTION-01] `# Cofounder.co - Complete Developer.txt` ends at line 594 with the partial bullet `- Agent`. [ASSUMPTION: the remainder of the agent workspace/chat requirements is unavailable and must be reconstructed only from the other three source notes.]
- [QUESTION-02] `# Cofounder.co - Complete UIUX Desi.txt` ends at line 661 mid-sentence in the pricing Cost Estimator section. [ASSUMPTION: pricing calculator rows are limited to the rows independently listed in the other notes.]
- [QUESTION-03] `Cofounder.co - Full Product Teardow.txt` ends at line 1356 with a dangling backtick after `GET /api/org/:id/departments/:deptId`. [ASSUMPTION: later API lists are unavailable and must be derived from product workflows with explicit labels.]

## Product And Routing
- [QUESTION-04] Public legal route conflict: one source lists `/terms`, another lists `/terms-of-service`. [ASSUMPTION: implement `/terms` and redirect or alias `/terms-of-service` to it.]
- [QUESTION-05] Docs route conflict: one source lists external `https://docs.cofounder.co/`, another lists `/docs`. [ASSUMPTION: implement `/docs` as an internal documentation landing page and expose footer link text compatible with external-docs intent.]
- [QUESTION-06] App settings route conflict: one source lists `/org/[slug]/settings/...`; another lists modal-style `/org/:orgId/domains`, `/skills`, `/integrations`, `/billing`, `/database`, `/referrals`. [ASSUMPTION: implement the verified nested settings pages and account-menu modal routes as separate app surfaces.]

## UI Conflicts
- [QUESTION-07] Auth screen conflict: product teardown says split screen with ASCII art; precision gap-fill verifies centered login over pixel sky. [ASSUMPTION: use the precision gap-fill centered login as primary and include ASCII/pixel brand art in onboarding screens.]
- [QUESTION-08] Hero glass badge conflict: older UI notes say dark-green glass; precision gap-fill verifies white translucent glass gradient. [ASSUMPTION: implement the verified white translucent glass-pill style.]
- [QUESTION-09] Public CTA conflict: product teardown says black CTA in the navbar; precision gap-fill verifies nav "Run a company" is light-surface. [ASSUMPTION: implement verified light-surface navbar/hero CTA and dark gradient CTAs where pricing/footer notes specify.]
- [QUESTION-10] App background conflict: some sources say `#0d0d0d` or `#111`; developer-ready notes verify `#1e1e23` canvas and `#25252b` side panel. [ASSUMPTION: use verified `#1e1e23` / `#25252b` app shell tokens.]
- [QUESTION-13] Departure Mono is required for pricing/estimator numerals, but no licensed local font asset exists in the repo. [ASSUMPTION: keep `Departure Mono` in the CSS stack for future asset insertion and load IBM Plex Mono as the verified local fallback.]
- [QUESTION-14] Pricing calculator category rows are specified, but exact formulas are not included. [ASSUMPTION: implement a transparent sandbox estimator and label it in the UI.]
- [QUESTION-15] Exact legal and documentation copy is not included. [ASSUMPTION: build functional content shells derived from named product surfaces and flag them for human legal/docs review.]

## Feature Scope
- [QUESTION-11] Department availability conflict: all 8 departments are core, but one verified source says Support, Operations, Finance, and Legal show coming-soon states. [ASSUMPTION: build all 8 departments as first-class entities; mark later-stage departments visually "coming soon" until their roadmap unlock conditions are met.]
- [QUESTION-12] External integrations require live provider credentials: GitHub OAuth, Supabase, Vercel, Stripe, Postiz, Apify, email/domain providers, PostHog/Sentry/DataDog. [ASSUMPTION: architecture will define provider adapters; local development will use deterministic sandbox adapters unless real credentials are supplied.]
- [QUESTION-16] GitHub OAuth app credentials and registered callback URL are not present in the repo or environment. [ASSUMPTION: implement provider-mode GitHub OAuth and use the clearly labeled sandbox fallback for local verification until credentials are supplied.]
- [QUESTION-17] Exact AI prompt contracts and generated text for company questions, business plan prose, and brand-kit recommendations are not specified. [ASSUMPTION: deterministic sandbox generators create the required structures and label external-provider gaps for later provider wiring.]
- [QUESTION-18] The frozen schema contains notification preferences but no dedicated notification item table. [ASSUMPTION: derive inbox items from existing workspace records and store user read markers in `AuditLog` until a future migration is explicitly approved.]
- [QUESTION-19] Exact department setup prompt and context-tab wording is not specified in the notes. [ASSUMPTION: use deterministic department-specific copy derived from the documented responsibilities for each department.]
- [QUESTION-20] Exact roadmap dependency edges are not specified item by item. [ASSUMPTION: use the source-listed stage order and documented unlock-chain behavior to define deterministic dependency edges.]
- [QUESTION-21] Mature stage item list is not specified. [ASSUMPTION: render Mature as a named source-gap shell with no items until source notes provide the missing milestones.]
- [QUESTION-22] The new-task app dropdown is named in the notes, but no App entity or exact option list is specified. [ASSUMPTION: implement it as an execution target selector with deterministic options (`staging`, `production`, `repository`, `integration`) until Phase 13 integration surfaces provide live app targets.]
- [QUESTION-23] The agent marketplace/skills surface is required, but the notes do not provide a canonical marketplace catalog or provider source. [ASSUMPTION: expose deterministic skills derived from documented department responsibilities and integration surfaces until a live marketplace/catalog is specified.]
- [QUESTION-24] Chat requires file attachments, but the frozen schema has no chat-message/file join table. [ASSUMPTION: persist attached file IDs and generated upload records inside `ChatMessage.metadataJson` until a later explicit migration adds first-class chat attachments.]
- [QUESTION-25] File upload/storage is required, but the notes do not specify a binary object-storage provider, signed URL format, or document preview renderer. [ASSUMPTION: use existing `File.storageKey`, `FileVersion.storageKey`, and safe preview metadata locally until Phase 13 provider settings define live storage.]
- [QUESTION-26] Settings avatar/env upload storage and real provider credential exchanges are required but no object storage, encryption service, OAuth app list, webhook secrets, or provider account IDs are supplied. [ASSUMPTION: accept local JSON/text metadata, redact secret values, and use sandbox provider states until real adapters are configured.]
