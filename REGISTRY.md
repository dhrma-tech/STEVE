# REGISTRY.md

Created after Execution Phase 2. Every later phase must reference these components before creating a new component.

| Component | File path | Status | Used on which pages |
|---|---|---|---|
| Accordion | `src/components/ui/accordion.tsx` | built | Pricing FAQ, how-to guides, department panels, settings sections |
| AppPanel | `src/components/ui/card.tsx` | built | App shell side panel, dashboard cards, department boards, agent workspace |
| AppSplit | `src/components/ui/container.tsx` | built | App shell, canvas/dashboard layout |
| AppViewport | `src/components/ui/container.tsx` | built | All authenticated app pages |
| Avatar | `src/components/ui/avatar.tsx` | built | Org selector, members, agents, chat messages |
| Badge | `src/components/ui/badge.tsx` | built | Status labels, plan labels, integration states, roadmap card types |
| Button | `src/components/ui/button.tsx` | built | Public CTAs, app actions, dialogs, forms |
| Card | `src/components/ui/card.tsx` | built | Pricing cards, repeated marketing items, app cards where a framed item is appropriate |
| ConfirmationDialog | `src/components/ui/dialog.tsx` | built | Delete account, own repo/Supabase import, skip design setup, destructive approvals |
| Dialog | `src/components/ui/dialog.tsx` | built | Modals, upgrade flow, task creation, roadmap detail modal |
| DropdownMenu | `src/components/ui/dropdown-menu.tsx` | built | Navbar How To menu, app action menus, filters |
| EmptyState | `src/components/ui/empty-state.tsx` | built | Inbox, tasks, files, agents, integrations, search results |
| ErrorState | `src/components/ui/error-state.tsx` | built | Failed AI generation, provider errors, upload/auth/billing failures |
| FeatureCallout | `src/components/ui/card.tsx` | built | How-to guides, public feature callouts, onboarding tips |
| FileUpload | `src/components/ui/file-upload.tsx` | built | Design references, settings profile photo, env upload, library uploads, task attachments |
| HeroNotificationPill | `src/components/ui/hero-notification-pill.tsx` | built | Homepage hero floating task notifications |
| IconButton | `src/components/ui/icon-button.tsx` | built | Topbar tools, canvas controls, agent workspace, card row actions |
| Input | `src/components/ui/input.tsx` | built | Auth/onboarding/settings/task forms |
| LoadingState | `src/components/ui/loading-state.tsx` | built | Route and panel loading states |
| MarketingContainer | `src/components/ui/container.tsx` | built | Public site sections, resources, legal, docs, pricing |
| MarketingNavContainer | `src/components/ui/container.tsx` | built | Public navbar |
| PricingCard | `src/components/ui/card.tsx` | built | Pricing page |
| Progress | `src/components/ui/progress.tsx` | built | Roadmap progress, onboarding generation, usage/billing |
| SegmentedControl | `src/components/ui/segmented-control.tsx` | built | Pricing calculator, task view switcher, settings mode switches |
| SelectField | `src/components/ui/select.tsx` | built | Onboarding selects, model selectors, filters, settings |
| Skeleton | `src/components/ui/skeleton.tsx` | built | Loading skeletons across public and app surfaces |
| SliderField | `src/components/ui/slider.tsx` | built | Pricing calculator, company stage, usage controls |
| StatusBadge | `src/components/ui/badge.tsx` | built | Task status, agent run state, integration health |
| Switch / ToggleField | `src/components/ui/toggle.tsx` | built | Binary settings and preferences |
| Tabs | `src/components/ui/tabs.tsx` | built | Side panel tabs, agent workspace tabs, settings groups |
| Textarea | `src/components/ui/textarea.tsx` | built | Task prompt, onboarding description, prompt personalization, comments |
| ToggleButton | `src/components/ui/toggle.tsx` | built | Icon/text toggles in toolbars and filters |
| Tooltip | `src/components/ui/tooltip.tsx` | built | Icon buttons and non-obvious tools |
| FadeIn | `src/components/motion/fade-in.tsx` | built | Public section entrances, article cards, onboarding transitions |
| PageTransition | `src/components/motion/page-transition.tsx` | built | Route/page transitions where motion is enabled |
| Stagger / StaggerItem | `src/components/motion/stagger.tsx` | built | Hero copy, card grids, notification stacks |
| usePrefersReducedMotion | `src/components/motion/reduced-motion.tsx` | built | Motion-aware components and animation opt-outs |
| MarketingNav | `src/components/marketing/marketing-nav.tsx` | built | All public marketing pages |
| MarketingFooter | `src/components/marketing/marketing-footer.tsx` | built | All public marketing pages |
| HeroPixelScene | `src/components/marketing/pixel-art.tsx` | built | Homepage hero |
| GrassStrip | `src/components/marketing/pixel-art.tsx` | built | Homepage hero transition |
| ChapterArt | `src/components/marketing/pixel-art.tsx` | built | How-to cards and guide pages |
| FooterPixelCard | `src/components/marketing/pixel-art.tsx` | built | Marketing footer |
| NotificationWheel | `src/components/marketing/notification-wheel.tsx` | built | Homepage hero notification rotation |
| OrbitPreview | `src/components/marketing/orbit-preview.tsx` | built | Homepage product/platform preview |
| ChapterGrid | `src/components/marketing/chapter-card.tsx` | built | Homepage how-to chapter section |
| ProductPreviewSection | `src/components/marketing/home-sections.tsx` | built | Homepage |
| ValuePropsSection | `src/components/marketing/home-sections.tsx` | built | Homepage |
| ChaptersSection | `src/components/marketing/home-sections.tsx` | built | Homepage |
| RoadmapPreviewSection | `src/components/marketing/home-sections.tsx` | built | Homepage |
| DemoSections | `src/components/marketing/home-sections.tsx` | built | Homepage engineering, sales/marketing, and scale demos |
| ToolCarouselSection | `src/components/marketing/home-sections.tsx` | built | Homepage tools/systems carousel |
| IndustryWordsearchSection | `src/components/marketing/home-sections.tsx` | built | Homepage industry wordsearch |
| StatsSection | `src/components/marketing/home-sections.tsx` | built | Homepage stats band |
| FooterCtaSection | `src/components/marketing/home-sections.tsx` | built | Homepage footer CTA |
| PricingCalculator | `src/components/marketing/pricing-calculator.tsx` | built | Pricing page and `/api/pricing/calculate` |
| FeatureComparison | `src/components/marketing/feature-comparison.tsx` | built | Pricing page |
| ResourcesGrid | `src/components/marketing/resources-grid.tsx` | built | Resources page |
| HowToRenderer | `src/components/marketing/how-to-renderer.tsx` | built | How-to Start/Build/Sell/Scale guide pages |
| LoginPanel | `src/components/auth/login-panel.tsx` | built | `/login` |
| OnboardingStepper | `src/components/onboarding/stepper.tsx` | built · token-migrated (Slice 14) | `/onboarding` |
| OptionCard | `src/components/onboarding/option-card.tsx` | built · token-migrated (Slice 14) | Personal onboarding, company question modal, design vibe picker |
| PersonalOnboardingWizard | `src/components/onboarding/personal-onboarding-wizard.tsx` | built · token-migrated (Slice 14) | `/onboarding` |
| CompanyOnboardingWorkspace | `src/components/onboarding/company-onboarding-workspace.tsx` | built · token-migrated (Slice 14) | `/org/[orgId]/onboarding` company activation |
| DesignOnboardingWizard | `src/components/onboarding/design-onboarding-wizard.tsx` | built · token-migrated (Slice 14) | `/org/[orgId]/onboarding` design setup |
| BrandKitReview | `src/components/onboarding/design-onboarding-wizard.tsx` | built · token-migrated (Slice 14) | Design onboarding brand-kit review step |
| AppShell | `src/components/app-shell/app-shell.tsx` | built | Authenticated `/org/[orgId]/*` routes |
| CompanySwitcher | `src/components/app-shell/company-switcher.tsx` | built | App shell top-left company selector |
| AppBreadcrumb | `src/components/app-shell/breadcrumb.tsx` | built | App shell topbar breadcrumb |
| SidePanelTabs | `src/components/app-shell/side-panel-tabs.tsx` | built | App shell right side panel |
| CanvasSidePanel | `src/components/side-panel/canvas-side-panel.tsx` | built · token-migrated (Slice 12) | All 5 canvas sidebar tabs: Home, AI, Company, Tasks, Library |
| UpgradeModal | `src/components/app-shell/upgrade-modal.tsx` | built | App shell action menu upgrade flow |
| MobileAppNav | `src/components/app-shell/app-shell.tsx` | built | Authenticated mobile app navigation |
| CommandPalette | `src/components/command-palette/command-palette.tsx` | built · token-migrated (Slice 10) | Global app search and command palette |
| InboxPanel | `src/components/notifications/inbox-panel.tsx` | built · token-migrated (Slice 9) | App shell notification/inbox panel |
| CanvasWorkspace | `src/components/canvas/canvas-workspace.tsx` | built | `/org/[orgId]/canvas` |
| CofounderNode | `src/components/canvas/cofounder-node.tsx` | built | React Flow central canvas node |
| DepartmentNode | `src/components/canvas/department-node.tsx` | built | React Flow department nodes |
| WorkspacePreviewCard | `src/components/canvas/workspace-preview-card.tsx` | built | Canvas active department previews |
| QueryShells | `src/components/canvas/query-shells.tsx` | built | Canvas roadmap and session query shells |
| CanvasSidePanel | `src/components/side-panel/canvas-side-panel.tsx` | built | `/org/[orgId]/canvas` right side panel |
| DepartmentCover | `src/components/departments/department-cover.tsx` | built · token-migrated + pixel-drift (Slice 17) | Department detail panels and department boards |
| DepartmentContextTabs | `src/components/departments/department-context-tabs.tsx` | built · token-migrated (Slice 17) | Department context sections and boards |
| DepartmentRoadmapStrip | `src/components/departments/department-roadmap-strip.tsx` | built · token-migrated (Slice 17) | Department boards |
| DepartmentSections | `src/components/departments/department-sections.tsx` | built · token-migrated (Slice 17) | Department detail panels |
| DepartmentDetailPanel | `src/components/departments/department-detail-panel.tsx` | built · token-migrated (Slice 17) | Canvas department selection side panel |
| DepartmentBoardDialog | `src/components/departments/department-board.tsx` | built · token-migrated (Slice 17) | Department double-click drill-in board |
| RoadmapModal | `src/components/roadmap/roadmap-modal.tsx` | built · token-migrated (Slice 15) | Full-screen roadmap tech tree modal opened from `/canvas?open_tech_tree=1` |
| RoadmapStageBoard | `src/components/roadmap/roadmap-stage-board.tsx` | built · token-migrated (Slice 15) | Roadmap horizontal stage board |
| RoadmapCard | `src/components/roadmap/roadmap-card.tsx` | built · token-migrated (Slice 15) | Roadmap milestone cards |
| RoadmapDetailPanel | `src/components/roadmap/roadmap-detail-panel.tsx` | built · token-migrated (Slice 15) | Roadmap item detail, dependencies, unlocks, launch, and complete actions |
| DependencyMatrix | `src/components/roadmap/roadmap-modal.tsx` | built | Roadmap dependency overview mode |
| TaskWorkspace | `src/components/tasks/task-workspace.tsx` | built · token-migrated (Slice 13) | Canvas Tasks side panel, task filters, suggested next, list/board/calendar views |
| TaskCreateDialog | `src/components/tasks/task-create-dialog.tsx` | built · token-migrated (Slice 13) | App shell FAB, canvas suggested next, side panel new task, department launch defaults |
| TaskList | `src/components/tasks/task-cards.tsx` | built · token-migrated (Slice 13) | Task workspace list view |
| TaskBoard | `src/components/tasks/task-cards.tsx` | built · token-migrated (Slice 13) | Task workspace board view |
| TaskCalendar | `src/components/tasks/task-cards.tsx` | built · token-migrated (Slice 13) | Task workspace calendar view |
| TaskDetailPanel | `src/components/tasks/task-detail-panel.tsx` | built · token-migrated (Slice 13) | Task detail, status, sessions, subtasks, comments, attachments, approvals |
| AgentControlCenter | `src/components/agents/agent-control-center.tsx` | built | Canvas Company/Agents panel, agent filters, marketplace, detail selection |
| AgentList | `src/components/agents/agent-cards.tsx` | built | Agent rows/cards in the agent control center |
| MarketplaceSkills | `src/components/agents/agent-cards.tsx` | built | Agent marketplace/skills panel |
| AgentCreateDialog | `src/components/agents/agent-create-dialog.tsx` | built | New Agent modal |
| AgentConfigPanel | `src/components/agents/agent-config-panel.tsx` | built | Agent profile/config, inbox, launch, tasks, sessions |
| AgentWorkspaceDialog | `src/components/agents/agent-workspace-dialog.tsx` | built | Session workspace with Agent Browser, Scratchpad, Replay, actions, task chat |
| ChatWorkspace | `src/components/chat/chat-workspace.tsx` | built | Canvas Cofounder tab, chat thread list, selected thread, composer |
| ChatThreadList | `src/components/chat/chat-thread-list.tsx` | built | Thread search, selection, and new conversation control |
| MessageList | `src/components/chat/message-renderer.tsx` | built | Ordered chat messages and streaming typing indicator |
| ChatMessageBubble | `src/components/chat/message-renderer.tsx` | built | Markdown/thinking/code/link/action-log chat message rendering |
| ChatComposer | `src/components/chat/chat-composer.tsx` | built | Mentions, attachments, and chat message submission |
| FileLibrary | `src/components/files/file-library.tsx` | built · token-migrated (Slice 16) | Canvas Files tab, library browser, search, stats, upload, folder navigation |
| FolderTree | `src/components/files/folder-tree.tsx` | built · token-migrated (Slice 16) | Library folder tree/list with General folder highlighting |
| FileList | `src/components/files/file-cards.tsx` | built · token-migrated (Slice 16) | Library file list rows with type icons, visibility, department/task badges |
| FileUploadDialog | `src/components/files/upload-dialog.tsx` | built · token-migrated (Slice 16) | Library upload dialog/dropzone with folder, department, task, and visibility selection |
| FilePreviewPanel | `src/components/files/file-preview-panel.tsx` | built · token-migrated (Slice 16) | File detail preview, sharing, folder/department organization, archive, and version history |
| SettingsShell | `src/components/settings/settings-shell.tsx` | built | Settings section layout, navigation, and integrations entry |
| PreferencesSettingsForm | `src/components/settings/settings-sections.tsx` | built | `/settings/preferences` profile, avatar, theme, timezone, Vercel status |
| AiSettingsForm | `src/components/settings/settings-sections.tsx` | built | `/settings/ai` suggested tasks, queue messages, review bot, prompt, model, credits |
| EnvFilesSettingsPanel | `src/components/settings/settings-sections.tsx` | built | `/settings/env-files` env upload, write-only secrets, Vercel export state |
| NotificationSettingsForm | `src/components/settings/settings-sections.tsx` | built | `/settings/notifications` notification preference toggles |
| OrganizationSettingsForm | `src/components/settings/settings-sections.tsx` | built | `/settings/organization` company profile, context imports, members |
| InboxSettingsPanel | `src/components/settings/settings-sections.tsx` | built | `/settings/inbox` domains, DNS records, agent inbox addresses |
| SupportSettingsPanel | `src/components/settings/settings-sections.tsx` | built | `/settings/support` support widget and support agent state |
| PaymentsSettingsPanel | `src/components/settings/settings-sections.tsx` | built | `/settings/payments` Stripe test/live/webhook status and sandbox connect/check/disconnect |
| AdvancedSettingsPanel | `src/components/settings/settings-sections.tsx` | built | `/settings/advanced` own Supabase import and own repo switch confirmations |
| BillingDashboard | `src/components/billing/billing-dashboard.tsx` | built | `/settings/billing` plans, usage, upgrade flow, dashboard link |
| IntegrationCenter | `src/components/integrations/integration-center.tsx` | built · token-migrated (Slice 11) | `/integrations` provider connect/check/disconnect center |
| PostizIntegration | `src/components/integrations/postiz-integration.tsx` | built · token-migrated (Slice 11) | `/integrations/postiz` social publishing channels |

## Registry Rules
- Reuse these primitives before creating page-specific components.
- Page-specific components may compose registry components, but must not duplicate their behavior.
- If a future phase needs a genuinely new component, add it here immediately with status and usage.

## Slice 2 — Token Migration (Sections J / K / N)

The 20 UI primitives below have been migrated from legacy tokens (`--app-*`, `--brand-*`, hardcoded `rgba(255,255,255,...)`) onto Section V tokens (`--foreground-*`, `--border-*`, `--background-*`, `--primary`, `--popover`, `--focused`, `--shadow-*`, etc.). Visual semantics align to Sections J (Button System), K (Card System), and N (Component Library).

| Component | File | Slice 2 status | Notes |
|---|---|---|---|
| Skeleton | `src/components/ui/skeleton.tsx` | re-skinned | Dark surface shimmer now uses `--foreground-5/15`. Light surface unchanged (marketing). |
| LoadingState | `src/components/ui/loading-state.tsx` | re-skinned | Dark border → `--border-10`. |
| Tooltip | `src/components/ui/tooltip.tsx` | re-skinned (Section N) | `bg-popover` → `--background-sidepanel`, 6px radius, `--tt-shadow-elevated-md`. |
| Badge / StatusBadge | `src/components/ui/badge.tsx` | re-skinned (Section N) | All variants use `--success-*`, `--tt-color-text-*`, `--tt-color-text-*-contrast` instead of hardcoded rgba. |
| Button | `src/components/ui/button.tsx` | re-skinned (Section J) | `app` variant → Tier 1 Primary (`--primary` + `--shadow-button-md`); `danger` → Tier 5 destructive (`--destructive` + transparent); `brand` → `--tt-brand-color-500`; focus ring → `--focused`. `light`/`dark`/`ghost` left for marketing/light mode (Slice 3). |
| IconButton | `src/components/ui/icon-button.tsx` | re-skinned (Section J) | Dark `app`/`ghost`/`danger` variants now use `--foreground-*` opacity layers + `--focused` ring. |
| Card / AppPanel | `src/components/ui/card.tsx` | re-skinned (Section K) | `app` → `--background-sidepanel`; `deep` → `--card`; AppPanel uses `--shadow-outset-100`. Marketing/blue variants untouched. |
| EmptyState | `src/components/ui/empty-state.tsx` | re-skinned | Dark surface uses `--foreground-3` bg / `--border-10` / `--foreground-80` text. |
| ErrorState | `src/components/ui/error-state.tsx` | re-skinned | Dark variant uses `--tt-color-text-red-contrast` for both border + bg, `--destructive` for icon and text. |
| DropdownMenu (+items/separator/label/sub) | `src/components/ui/dropdown-menu.tsx` | re-skinned (Section N) | `--popover` bg, `--border-10` border, `--shadow-outset-100` elevation, hover uses `--foreground-8`. |
| Dialog (overlay/content/title/desc/close) | `src/components/ui/dialog.tsx` | re-skinned | `--popover` modal bg, `--shadow-outset-150`, close button uses `--foreground-50`→`--foreground` ramp + `--focused` ring. |
| Input | `src/components/ui/input.tsx` | re-skinned | Dark surface: `--input` border, `--foreground-5` bg, `--foreground-80` text, `--caret`, `--destructive` error, `--focused` ring. |
| Textarea | `src/components/ui/textarea.tsx` | re-skinned | Same migration as Input. |
| Select (trigger/content/item/field) | `src/components/ui/select.tsx` | re-skinned | Dark trigger uses `--input`/`--foreground-5`; content uses `--popover` + `--shadow-outset-100`. |
| Avatar / AvatarFallback | `src/components/ui/avatar.tsx` | re-skinned | `--border-10` border, `--foreground-8` bg, `--foreground` fallback text. |
| Progress / ProgressField | `src/components/ui/progress.tsx` | re-skinned | Track → `--foreground-10`; indicator → `--tt-brand-color-500`. |
| SegmentedControl | `src/components/ui/segmented-control.tsx` | re-skinned | Dark surface: `--border-10`/`--foreground-5` container; active segment → `--primary`/`--primary-foreground`. |
| Tabs / TabsList / TabsTrigger / TabsContent | `src/components/ui/tabs.tsx` | re-skinned | Active tab → `--primary`/`--primary-foreground`; focus ring → `--focused`. |
| Switch / ToggleField / ToggleButton | `src/components/ui/toggle.tsx` | re-skinned (Section I) | Switch on-state → `--success-30` (matches Section I Notifications spec); ToggleButton active → `--primary`. |
| FileUpload | `src/components/ui/file-upload.tsx` | re-skinned | Dark surface uses `--input`/`--foreground-3`; dragging state uses `--focused` + `--tt-color-text-blue-contrast`. |
| AppViewport / AppSplit | `src/components/ui/container.tsx` | re-skinned | Switched to `--background` / `--foreground-80`. |

**Not migrated in Slice 2** (intentionally — light-mode marketing surface, no Section V mapping until light-mode scope lands in Slice 3):
- Accordion (`src/components/ui/accordion.tsx`) — Pricing FAQ, How-to (light) — **migrated in Slice 3**
- Slider / SliderField (`src/components/ui/slider.tsx`) — Pricing calculator (light) — **migrated in Slice 3**
- HeroNotificationPill (`src/components/ui/hero-notification-pill.tsx`) — Hero (over imagery, white-on-image styling) — **audited in Slice 3, no changes required**
- The `light`, `dark`, `ghost` (marketing-light) variants of Button and the `light` variant of IconButton — **migrated in Slice 3**

**Domain components still on legacy tokens** (Slice 2b candidates — out of scope for this slice since each carries multiple component-specific styling decisions that exceed a token-substitution pass): app-shell/, canvas/, side-panel/, agents/, chat/, settings/, integrations/, tasks/, departments/, files/, notifications/, onboarding/, roadmap/, command-palette/, billing/. See `CHANGES.md` for the full list.

## Slice 3 — Light-Mode Dual-Mode System

| Component / File | Slice 3 status | Notes |
|---|---|---|
| `src/middleware.ts` | created | Stamps `x-theme: light` on marketing/auth routes; `x-theme: dark` on all others. Routes: `/`, `/login`, `/onboarding`, `/pricing`, `/resources`, `/how-to/*`, `/privacy-policy`, `/terms`, `/terms-of-service`, `/docs`. |
| `src/app/layout.tsx` | updated | Now `async`; reads `x-theme` header via `next/headers`; applies `light` or `dark` class to `<html>` at SSR time — no flash. |
| `src/styles/tokens.css` | updated | Added `html:not(.dark)` block implementing Section B light-mode palette overrides (background cream, dark ink foreground, dark borders, primary = `rgb(79,79,79)`, focused = `rgb(29,112,217)`, plus proportional foreground-* steps). |
| `src/components/ui/button.tsx` (light, dark, ghost variants) | re-skinned | `light` → `--background-l0` + `--shadows-light-buttons-md`; `dark` → `--primary` + `--shadows-light-buttons-lg`; `ghost` → `--foreground-60` text + `--border-subtle`. All off legacy `--color-*` tokens. |
| `src/components/ui/icon-button.tsx` (light variant) | re-skinned | `light` → `--background-l0` + `--shadows-light-buttons-sm`. |
| `src/components/ui/accordion.tsx` | re-skinned | Border → `--border-10`; trigger text → `--foreground-80`/`--foreground`; content text → `--foreground-60`; focus ring → `--focused`. |
| `src/components/ui/slider.tsx` | re-skinned | Track → `--foreground-10`; range → `--tt-brand-color-500`; thumb border → `--border-10`; focus ring → `--focused`; label text → `--foreground-80/50/40`. |
| `src/components/ui/hero-notification-pill.tsx` | audited — no changes | Uses intentional white-on-dark glassmorphic values for the hero image overlay. No legacy token references present. |

## Slice 3b — Marketing Domain Component Migration

All legacy `--color-ink-*`, `--color-surface-*`, `--color-border-*`, `--hero-blue`, `--brand-300` (focus rings), `--color-feature-*` references removed from the marketing surface. Components now use Section B / Section V tokens active under `html:not(.dark)`.

| File | Slice 3b status | Key changes |
|---|---|---|
| `src/components/marketing/marketing-nav.tsx` | migrated | `--brand-300` focus rings → `--focused`; `--color-ink-strong` → `--foreground-80`; `--color-ink-faint` → `--foreground-50`; `--color-ink-muted` → `--foreground-60` |
| `src/components/marketing/marketing-footer.tsx` | migrated | `--color-ink` → `--foreground`; `--color-ink-muted` → `--foreground-60`; `--color-ink-faint` → `--foreground-50`; `--color-border-card` → `--border-10` |
| `src/components/marketing/home-sections.tsx` | migrated | All `--color-ink-*` → foreground scale; `--hero-blue` → `--tt-color-text-blue`; `--color-border-card` → `--border-10`; `--color-surface-raised` → `--background-l0`; `--color-border-pill` → `--border-subtle`; `--brand-300` → `--focused` |
| `src/components/marketing/pricing-calculator.tsx` | migrated | `--color-ink-faint/muted/strongest` → foreground scale; `--color-border-card` → `--border-10`; `--color-border-pill` → `--border-subtle` |
| `src/components/marketing/chapter-card.tsx` | migrated | `--brand-300` → `--focused`; `--color-border-pill` → `--border-subtle`; `--color-ink-muted` → `--foreground-60` |
| `src/components/marketing/feature-comparison.tsx` | migrated | `--color-border-card` → `--border-10`; `--color-ink-strong` → `--foreground-80`; `--color-ink-muted` → `--foreground-60`; `--color-feature-success` → `--success-100`; `--color-feature-neutral` → `--foreground-40` |
| `src/components/marketing/how-to-renderer.tsx` | migrated | `--color-border-card` + `--color-surface-raised` → `--border-10` + `--background-l0`; `--color-ink-faint/muted` → foreground scale; `--color-surface-darker` → `--foreground-10`; `--brand-500` → `--tt-brand-color-500`; `--brand-300` → `--focused` |
| `src/components/marketing/resources-grid.tsx` | migrated | `--brand-300` → `--focused`; all `--color-ink-*` → foreground scale |
| `src/components/marketing/pixel-art.tsx` (FooterPixelCard) | migrated | `--color-border-card` → `--border-10`; `--color-ink` → `--foreground` |
| `src/app/(marketing)/pricing/page.tsx` | migrated | `--color-ink-faint` → `--foreground-50`; `--color-ink-muted` → `--foreground-60` |
| `src/app/(marketing)/resources/page.tsx` | migrated | Same pattern |
| `src/app/(marketing)/docs/page.tsx` | migrated | Same + `--hero-blue` → `--tt-color-text-blue` |
| `src/app/(marketing)/privacy-policy/page.tsx` | migrated | Same + `--color-border-card` → `--border-10` |
| `src/app/(marketing)/terms/page.tsx` | migrated | Same |
| `src/app/(marketing)/resources/introducing-cofounder-2/page.tsx` | migrated | Same + `--color-border-card` → `--border-10` |

**Audited — no changes needed:**
- `src/app/(marketing)/page.tsx` — no legacy color token refs
- `src/app/(marketing)/layout.tsx` — no legacy color token refs
- `src/app/(marketing)/how-to/[chapter]/page.tsx` — no legacy color token refs
- `src/components/marketing/orbit-preview.tsx` — uses `--app-*` and `--brand-*` intentionally for the dark app-preview widget; no `--color-ink-*` / `--color-surface-*` refs
- `src/components/marketing/notification-wheel.tsx` — no legacy color token refs (uses white-on-dark inline styles over the hero)

## Slice 4 — Settings Cluster Migration (Section I)

| File | Slice 4 status | Key changes |
|---|---|---|
| `src/components/settings/settings-shell.tsx` | migrated | `--app-canvas` → `--background`; `--app-panel` → `--background-sidepanel`; `--app-border` → `--border-10`; `--app-text` → `--foreground-80`; `--app-text-50` → `--foreground-50`; `--app-primary-light` (icon) → `--foreground-80`; `--brand-300` focus rings → `--focused`; active nav lime `rgba(216,255,122,0.13)` → `--foreground-5`; hover `rgba(255,255,255,0.06)` → `--foreground-5` |
| `src/components/settings/settings-sections.tsx` | migrated | `SettingsPanel` border → `--border-8` (Section I: 0.08 opacity); `SettingsPanel` bg → `--background-settings` (new token: `rgb(37,37,43)`); all inner card borders → `--border-10`; subtle bgs `rgba(255,255,255,0.04/.035)` → `--foreground-3`; hover `rgba(255,255,255,0.06)` → `--foreground-5`; `--app-text/50` → `--foreground-80/50`; `--app-primary-light` (StatusLine CheckCircle) → `--success-100`; `--app-primary-light` (ExternalLinkRow) → `--tt-color-text-blue`; destructive confirmation box → `--tt-color-text-red-contrast`; DangerNote → `--destructive`; `text-red-100` → `text-[var(--destructive)]` |
| `src/styles/tokens.css` | updated | Added `--background-settings: rgb(37,37,43)` — Section I settings card bg color; not in Section V variable list; created analogously to `--border-subtle` (DECISION-56) |

## Slice 5 — App-Shell Cluster Migration (Sections D / E / F / S)

| File | Slice 5 status | Key changes |
|---|---|---|
| `src/components/app-shell/app-shell.tsx` | migrated | `--app-canvas` → `--background`; `--app-black-base` (sidebar bg) → `--card`; `--app-border` → `--border-10`; `--app-text/50` → `--foreground-80/50`; `--app-primary-light` → `--foreground-80` (nav icons); `--brand-300` → `--focused`; `rgba(255,255,255,0.06)` → `--foreground-5`; `rgba(255,255,255,0.08)` → `--foreground-8`; `rgba(255,255,255,0.10/0.12)` → `--foreground-10`; topbar `rgba(30,30,35,0.92)` → `--background-l0-85`; mobile nav `rgba(29,29,34,0.94)` → `--background-l0-85`; mobile nav shadow → `--tt-shadow-elevated-md`; `--warning` badge → `--alert`; mobile CTA → `--primary`/`--primary-foreground` |
| `src/components/app-shell/side-panel-tabs.tsx` | migrated | `--app-panel` → `--background-sidepanel`; `--app-border` → `--border-10`; `--app-text/50` → `--foreground-80/50`; `--app-primary-light` → `--foreground-80`; `rgba(255,255,255,0.06)` → `--foreground-5`; `rgba(255,255,255,0.04)` → `--foreground-3` |
| `src/components/app-shell/breadcrumb.tsx` | migrated | `--app-text/50` → `--foreground-80/50` |
| `src/components/app-shell/company-switcher.tsx` | migrated | `--app-border` → `--border-10`; `--app-text/50` → `--foreground-80/50`; `--brand-300` → `--focused`; `rgba(255,255,255,0.06/0.1)` → `--foreground-5/10` |
| `src/components/app-shell/upgrade-modal.tsx` | migrated | `--app-border` → `--border-10`; `--app-text-50` → `--foreground-50`; `--brand-300` → `--focused`; `rgba(255,255,255,0.05)` → `--foreground-5`; `--app-primary-light` → `--foreground-80` |
| `src/lib/z-index.ts` | created | Full Section S z-index architecture as named TypeScript constants. All 17 tiers from `Z_CANVAS_BASE = 0` through `Z_KEYBOARD_SHORTCUTS = 10090`, plus `Z_APP_TOPBAR = 30` and `Z_MOBILE_NAV = 40` for app-shell interior layers. |

## Slice 6a — Canvas Cluster Migration (Sections D / E / H / S)

Animations deferred (Section L — Slice 6b). Token substitution only.

| File | Slice 6a status | Key changes |
|---|---|---|
| `src/components/canvas/canvas-workspace.tsx` | migrated | `--app-canvas` → `--background`; `--app-text` → `--foreground-80`; `--app-border` → `--border-10`; radial gradient rgba → `--foreground-8`; `<Background color>` → `transparent` (Section D: no grid); MiniMap bg → `--background-l0-80`; Panel bg + shadow → `--background-l0-80` + `--shadow-outset-100`; edge `style.stroke` → `var(--border-20)` (CSS style — resolves); edge `labelBgStyle.fill` → `var(--background-l0-80)`; `maskColor` → resolved `--background` RGB at 0.64 opacity (SVG attribute constraint) |
| `src/components/canvas/cofounder-node.tsx` | migrated | Node container border → `--border-30`; bg → `--background-l0-85`; shadow → `--shadow-dept-agent-node-dark` (Section K node shadow); icon badge → `--primary`/`--primary-foreground`; progress track → `--foreground-10`; progress fill → `--tt-brand-color-500`; text → `--foreground-80/50` |
| `src/components/canvas/department-node.tsx` | migrated | Node bg → `--background-l0-85`; shadow → `--shadow-dept-agent-node-dark`; unselected border inline style → `"var(--border-10)"`; text → `--foreground-80/50` |
| `src/components/canvas/workspace-preview-card.tsx` | migrated | Border → `--border-10`; resting bg → `--background-l0-80`; hover bg → `--background-l0-85`; shadow → `--shadow-dept-agent-node-dark`; text → `--foreground-80/50`; focus ring → `--focused` |
| `src/components/canvas/query-shells.tsx` | audited — no changes | Zero legacy token refs; delegates to `RoadmapModal` and `AgentWorkspaceDialog` (future slices) |

**ReactFlow SVG-attribute constraints (documented, not migratable in Slice 6a):**
- `markerEnd.color`: SVG attribute, CSS `var()` does not resolve — kept as `"rgba(255,255,255,0.3)"` (resolved value of `--border-30`)
- `nodeColor` callback return value: SVG fill attribute, CSS `var()` does not resolve — kept as `"#eeeee8"` (CofounderNode minimap fill)
- `maskColor`: SVG attribute — replaced with `"rgba(30,30,35,0.64)"` (resolved value of `--background` at 0.64 opacity)
- `department-node boxShadow` template with `rgba(0,0,0,0.28)`: runtime template literal combining dept color + drop-shadow; CSS var() won't compose safely here

**Animations deferred to Slice 6b:**
- `@keyframes canvasDashFlow` (orbital ring stroke animation)
- `@keyframes department-workspace-pixel-drift` (ambient pixel particles)
- `@keyframes pulseGlow` (active agent node glow)
- `@keyframes agent-canvas-cue-pop` (new task cue pop)
- `animate-node-breath` class (CofounderNode idle breath)
- `animate-node-select-pop` class (DepartmentNode selection pop)

## Slice 6b — Canvas Animations (Section L)

| File | Slice 6b status | Key changes |
|---|---|---|
| `src/styles/animations.css` | created | All Section L keyframes not already in `motion.css`. 36 keyframes across: UI State (`fade-in`, `sd-fadeIn`, `sd-blurIn`, `sd-slideUp`, `enter`, `exit`), Looping (`pulse`, `pulse-building`, `thin-pulse`, `pulse-dot`, `status-dot-breathe`, `blink`, `text-blink`), Chat/Loading (`typing-indicator-blink`, `typing`, `loading-dots`, `bounce-dots`, `wave-bars`, `text-shimmer-sweep`, `spinner-fade`), Canvas-specific (`canvasDashFlow`, `department-workspace-pixel-drift`, `department-workspace-pixel-ambient-wave`, `agent-canvas-cue-pop`, `attentionUpdateSlideUp`, `attentionInboxItemAppear`, `newTaskAppear`, `taskRouteHintEnter`, `taskRouteHintIconPop`, `reviewLauncherFreshBadge`, `reviewLensSettle`, `canvasActivityNoteIn`, `cofounder-cli-bloom`), Marketing asset (3 keyframes). Utility classes for all animations using `--tt-transition-duration-*` and `--tt-transition-easing-*` tokens. |
| `src/styles/globals.css` | updated | Added `@import "./animations.css"` |
| `src/components/canvas/canvas-workspace.tsx` | updated | `canvasDashFlow` wired to orbital edge style: `animation: "canvasDashFlow 20s linear infinite"` on base edges `style` object |

**Already in motion.css (not duplicated):**
`node-breath` · `node-select-pop` · `agent-pulse` · `shimmer` · `modal-enter/exit` · `task-row-in` · `notif-pop/exit` · `panel-slide-in` · `tab-content-fade`

**Structural animations deferred (Slice 7+ — require new DOM elements):**
- `department-workspace-pixel-drift` / `department-workspace-pixel-ambient-wave` — Keyframes defined; wiring requires adding pixel particle `<div>` children to dept workspace home nodes (no such node type currently in canvas cluster).
- `pulseGlow` / `agent-canvas-cue-pop` — Keyframes defined; wiring belongs in agents cluster (Slice 7+).
- `attentionUpdateSlideUp` — Wired via `.animate-attention-slide-up` utility class; application to InboxPanel belongs in notifications cluster.

## Slice 7 — Agents Cluster Migration (Sections H / I / J / L)

| File | Slice 7 status | Key changes |
|---|---|---|
| `src/components/agents/agent-cards.tsx` | migrated + animated | `--app-border` → `--border-10`; `--app-text/50` → `--foreground-80/50`; `--app-primary-light` icon → `--foreground-80`; selected card border → `--primary`; hover bg `rgba(0.07)` + selected bg `rgba(0.08)` → `--foreground-8`; inner dark panels `rgba(0,0,0,0.12)` → `--foreground-inverse-10`; `--brand-300` → `--focused`; **`.animate-agent-pulse` wired to running agent cards** |
| `src/components/agents/agent-config-panel.tsx` | migrated | Same token migration; destructive error box → `--tt-color-text-red-contrast`/`--destructive`; `--brand-300` focus ring → `--focused`; `--focused` wired to session row focus |
| `src/components/agents/agent-control-center.tsx` | migrated | Same token migration pattern; icon badge `--foreground-80`; filter panel, search, selects all on Section V tokens |
| `src/components/agents/agent-create-dialog.tsx` | migrated | Same pattern + selected skill card → `--primary` border + `--foreground-8` bg; `rgba(255,255,255,0.09)` → `--foreground-8`; destructive error box migrated |
| `src/components/agents/agent-workspace-dialog.tsx` | migrated + animated | Same token migration + browser frame bg `#111216` → `--background-l-negative-50-100`; code block `bg-black/35` → `--foreground-inverse-30`; link text `--app-primary-light` → `--tt-color-text-blue`; **`.animate-agent-cue-pop` wired to workspace content grid on session load** |
| `src/styles/animations.css` | updated | Added `.animate-agent-pulse` utility class — wires `agent-pulse` keyframe (from motion.css) to running agent nodes |

## Slice 8 — Chat Cluster Migration (Sections N / L / V)

| File | Slice 8 status | Key changes |
|---|---|---|
| `src/components/chat/chat-composer.tsx` | migrated | `--app-border` → `--border-10`; `--app-text-50` → `--foreground-50`; `rgba(255,255,255,0.04/.06)` → `--foreground-3/5`; `--brand-300` → `--focused` |
| `src/components/chat/chat-thread-list.tsx` | migrated | Same + selected thread → `--primary` border + `--foreground-8` bg; unselected → `--foreground-inverse-10` dark bg |
| `src/components/chat/chat-workspace.tsx` | migrated | Same; icon badge → `--foreground-80`; dark panel `rgba(0,0,0,0.12)` → `--foreground-inverse-10` |
| `src/components/chat/message-renderer.tsx` | migrated + animated | Same + user msg border → `--primary`; AI avatar icon → `--foreground-80`; file icon → `--foreground-80`; thinking label → `--foreground-80`; link text → `--tt-color-text-blue`; action log bg `rgba(0,0,0,0.16)` → `--foreground-inverse-20`; code block `bg-black/35` → `--foreground-inverse-30`; **typing indicator wired**: `animate-pulse` → `animate-typing-dot`, delays 120ms/240ms → 160ms/320ms per Section L spec, dots `--foreground-50` |
