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
| OnboardingStepper | `src/components/onboarding/stepper.tsx` | built | `/onboarding` |
| OptionCard | `src/components/onboarding/option-card.tsx` | built | Personal onboarding, company question modal, design vibe picker |
| PersonalOnboardingWizard | `src/components/onboarding/personal-onboarding-wizard.tsx` | built | `/onboarding` |
| CompanyOnboardingWorkspace | `src/components/onboarding/company-onboarding-workspace.tsx` | built | `/org/[orgId]/onboarding` company activation |
| DesignOnboardingWizard | `src/components/onboarding/design-onboarding-wizard.tsx` | built | `/org/[orgId]/onboarding` design setup |
| BrandKitReview | `src/components/onboarding/design-onboarding-wizard.tsx` | built | Design onboarding brand-kit review step |
| AppShell | `src/components/app-shell/app-shell.tsx` | built | Authenticated `/org/[orgId]/*` routes |
| CompanySwitcher | `src/components/app-shell/company-switcher.tsx` | built | App shell top-left company selector |
| AppBreadcrumb | `src/components/app-shell/breadcrumb.tsx` | built | App shell topbar breadcrumb |
| SidePanelTabs | `src/components/app-shell/side-panel-tabs.tsx` | built | App shell right side panel |
| UpgradeModal | `src/components/app-shell/upgrade-modal.tsx` | built | App shell action menu upgrade flow |
| MobileAppNav | `src/components/app-shell/app-shell.tsx` | built | Authenticated mobile app navigation |
| CommandPalette | `src/components/command-palette/command-palette.tsx` | built | Global app search and command palette |
| InboxPanel | `src/components/notifications/inbox-panel.tsx` | built | App shell notification/inbox panel |
| CanvasWorkspace | `src/components/canvas/canvas-workspace.tsx` | built | `/org/[orgId]/canvas` |
| CofounderNode | `src/components/canvas/cofounder-node.tsx` | built | React Flow central canvas node |
| DepartmentNode | `src/components/canvas/department-node.tsx` | built | React Flow department nodes |
| WorkspacePreviewCard | `src/components/canvas/workspace-preview-card.tsx` | built | Canvas active department previews |
| QueryShells | `src/components/canvas/query-shells.tsx` | built | Canvas roadmap and session query shells |
| CanvasSidePanel | `src/components/side-panel/canvas-side-panel.tsx` | built | `/org/[orgId]/canvas` right side panel |
| DepartmentCover | `src/components/departments/department-cover.tsx` | built | Department detail panels and department boards |
| DepartmentContextTabs | `src/components/departments/department-context-tabs.tsx` | built | Department context sections and boards |
| DepartmentRoadmapStrip | `src/components/departments/department-roadmap-strip.tsx` | built | Department boards |
| DepartmentSections | `src/components/departments/department-sections.tsx` | built | Department detail panels |
| DepartmentDetailPanel | `src/components/departments/department-detail-panel.tsx` | built | Canvas department selection side panel |
| DepartmentBoardDialog | `src/components/departments/department-board.tsx` | built | Department double-click drill-in board |
| RoadmapModal | `src/components/roadmap/roadmap-modal.tsx` | built | Full-screen roadmap tech tree modal opened from `/canvas?open_tech_tree=1` |
| RoadmapStageBoard | `src/components/roadmap/roadmap-stage-board.tsx` | built | Roadmap horizontal stage board |
| RoadmapCard | `src/components/roadmap/roadmap-card.tsx` | built | Roadmap milestone cards |
| RoadmapDetailPanel | `src/components/roadmap/roadmap-detail-panel.tsx` | built | Roadmap item detail, dependencies, unlocks, launch, and complete actions |
| DependencyMatrix | `src/components/roadmap/roadmap-modal.tsx` | built | Roadmap dependency overview mode |
| TaskWorkspace | `src/components/tasks/task-workspace.tsx` | built | Canvas Tasks side panel, task filters, suggested next, list/board/calendar views |
| TaskCreateDialog | `src/components/tasks/task-create-dialog.tsx` | built | App shell FAB, canvas suggested next, side panel new task, department launch defaults |
| TaskList | `src/components/tasks/task-cards.tsx` | built | Task workspace list view |
| TaskBoard | `src/components/tasks/task-cards.tsx` | built | Task workspace board view |
| TaskCalendar | `src/components/tasks/task-cards.tsx` | built | Task workspace calendar view |
| TaskDetailPanel | `src/components/tasks/task-detail-panel.tsx` | built | Task detail, status, sessions, subtasks, comments, attachments, approvals |
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
| FileLibrary | `src/components/files/file-library.tsx` | built | Canvas Files tab, library browser, search, stats, upload, folder navigation |
| FolderTree | `src/components/files/folder-tree.tsx` | built | Library folder tree/list with General folder highlighting |
| FileList | `src/components/files/file-cards.tsx` | built | Library file list rows with type icons, visibility, department/task badges |
| FileUploadDialog | `src/components/files/upload-dialog.tsx` | built | Library upload dialog/dropzone with folder, department, task, and visibility selection |
| FilePreviewPanel | `src/components/files/file-preview-panel.tsx` | built | File detail preview, sharing, folder/department organization, archive, and version history |
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
| IntegrationCenter | `src/components/integrations/integration-center.tsx` | built | `/integrations` provider connect/check/disconnect center |
| PostizIntegration | `src/components/integrations/postiz-integration.tsx` | built | `/integrations/postiz` social publishing channels |

## Registry Rules
- Reuse these primitives before creating page-specific components.
- Page-specific components may compose registry components, but must not duplicate their behavior.
- If a future phase needs a genuinely new component, add it here immediately with status and usage.
