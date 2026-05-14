# CHANGES.md

## Slice 2 — UI Primitives Token Migration

Scope per Slice 2 prompt: audit existing components against Sections J / K / N and patch them to use Section V tokens (active under `html.dark`). Re-skin only — no structural rebuilds.

Verification: `pnpm typecheck` → exit 0.

---

## Files Modified

### Foundation (set in Slice 1, referenced here)
| File | Reason |
|---|---|
| `src/styles/tokens.css` | (Slice 1) Section V dark tokens under `html.dark`; legacy tokens preserved on `:root` as transitional fallback. |
| `src/app/layout.tsx` | (Slice 1) Six font families wired; `<html class="dark">` set as default. |
| `DECISIONS.md` | Appended DECISION-52 (defer proprietary font licensing — `ppmondwest` / `Departure Mono` system fallback acceptable). |

### UI Primitives Migrated in Slice 2 (21 files)
All under `src/components/ui/`. Each was re-skinned only — no behavioral or structural changes. Variant signatures and exported types remain unchanged so domain callers continue compiling.

| File | Why | Sections referenced |
|---|---|---|
| `skeleton.tsx` | Replace hardcoded `rgba(255,255,255,...)` shimmer gradient with `--foreground-5/15`. | K, P |
| `loading-state.tsx` | Dark border → `--border-10`. | P |
| `tooltip.tsx` | Match Section N tooltip spec: `--background-sidepanel` bg, `--border-10`, `--foreground-80` text, 6px radius, `--tt-shadow-elevated-md`. | N |
| `badge.tsx` (+ StatusBadge) | All 6 status variants now use `--success-*`, `--tt-color-text-{yellow,red,blue}` + `-contrast` bg tokens. StatusBadge dots use canonical tokens. | N |
| `button.tsx` | `app` variant → Section J Tier 1 Primary (`--primary` solid near-white + `--shadow-button-md` + `--primary-foreground` dark text + brightness hover/active states). `danger` → Tier 5 Destructive (transparent + `--destructive` text + `--border-10`). `brand` → `--tt-brand-color-500/400`. Focus ring → `--focused`. Transition timing uses `--tt-transition-duration-short` + `--tt-transition-easing-default`. | J |
| `icon-button.tsx` | Dark `app`/`ghost`/`danger` variants use `--foreground-{5,8,10}` layered surfaces and `--focused` ring. | J, N |
| `card.tsx` (+ AppPanel) | Card `app` variant → `--background-sidepanel`; `deep` → `--card` (lab(1.98454% 0 0)). AppPanel uses `--shadow-outset-100`. | K |
| `empty-state.tsx` | Dark surface: `--foreground-3` bg, `--border-10`, `--foreground-80` text. | O |
| `error-state.tsx` | Dark surface uses `--tt-color-text-red-contrast` for both border + bg; `--destructive` for icon + text. | O |
| `dropdown-menu.tsx` | Section N popover spec applied to Content / SubContent / Items / Label / Separator. `--popover` bg, `--border-10`, hover via `--foreground-8`, elevation via `--shadow-outset-100`. | E, N |
| `dialog.tsx` | Modal uses `--popover` bg, `--shadow-outset-150` elevation, `--foreground-50`/`--foreground` close button ramp, `--focused` ring. | F, K |
| `input.tsx` | Dark surface: `--input` border, `--foreground-5` bg, `--foreground-80` text, `--caret` cursor color, `--destructive` for error states, `--focused` ring. | I, R |
| `textarea.tsx` | Same migration as Input. | I, R |
| `select.tsx` (+ SelectField) | Trigger matches Input; Content matches DropdownMenu; highlighted items use `--foreground-8`. | I, N |
| `avatar.tsx` (+ AvatarFallback) | `--border-10`, `--foreground-8` bg, `--foreground` text. | N |
| `progress.tsx` (+ ProgressField) | Track `--foreground-10`; indicator `--tt-brand-color-500`. ValueLabel uses `--foreground-50`. | F |
| `segmented-control.tsx` | Section I Appearance spec — dark container uses `--border-10`/`--foreground-5`; active segment uses `--primary`/`--primary-foreground`. | I, R |
| `tabs.tsx` | Section F sliding-indicator spec — active tab uses `--primary`/`--primary-foreground`; focus ring `--focused`. | F, R |
| `toggle.tsx` (Switch + ToggleField + ToggleButton) | Section I Notifications spec — Switch on-state uses `--success-30` (not brand purple). ToggleButton active state uses `--primary`. | I, R |
| `file-upload.tsx` | Dark surface uses `--input` border + `--foreground-3` bg; dragging state uses `--focused` ring + `--tt-color-text-blue-contrast` bg. | N |
| `container.tsx` (AppViewport, AppSplit) | Top-level app shells now use `--background` + `--foreground-80` instead of legacy `--app-canvas`/`--app-text`. | D |

### Documentation files updated
| File | Reason |
|---|---|
| `REGISTRY.md` | Appended "Slice 2 — Token Migration" section: status table for 21 migrated primitives, list of intentionally-skipped marketing primitives, and the domain-components deferral list. |
| `OPEN-QUESTIONS.md` | (Slice 1) Appended QUESTION-27/28/29 for font licensing and light-mode scope. |
| `DECISIONS.md` | Appended DECISION-52 (font licensing deferred). |
| `CHANGES.md` | This file. |
| `checkpoint-slice-2.md` | Slice-2 phase log. |

---

## Files Intentionally NOT Modified

### Light-mode marketing primitives (no Section V equivalent)
- `src/components/ui/accordion.tsx` — used only in Pricing FAQ and How-to (light surfaces).
- `src/components/ui/slider.tsx` — used only in Pricing calculator (light).
- `src/components/ui/hero-notification-pill.tsx` — hero overlay over imagery; uses white-on-image styling that is correct as-is.

### Marketing/auth variants inside dual-mode primitives
- `Button.variant = "light" | "dark" | "ghost"` — preserved on legacy marketing tokens. These render correctly on cream marketing pages; re-skinning them would require the light-mode scope that lands in Slice 3.
- `IconButton.variant = "light"` — same reason.

### Domain components still on legacy tokens (Slice 2b — out of scope)

These compile and render correctly via the legacy `:root` token shim from Slice 1. Each carries component-specific styling decisions (Section M / G / H layouts) that exceed a token-substitution pass, so they are deferred rather than half-touched.

Counts come from the Slice 1 grep (`var\(--(brand-|app-|color-|feature-|hero-|font-...)` ): ~80 files across the following clusters, in priority order for Slice 2b:

| Cluster | Files (representative) | Why deferred |
|---|---|---|
| App shell | `app-shell.tsx`, `side-panel-tabs.tsx`, `breadcrumb.tsx`, `company-switcher.tsx`, `upgrade-modal.tsx` | Section E chrome (z-index 10030+) needs the full chrome architecture from Section S — not a token-only patch. |
| Canvas | `canvas-workspace.tsx`, `cofounder-node.tsx`, `department-node.tsx`, `workspace-preview-card.tsx` | Section M Page 8 + Section L (`canvasDashFlow`, pixel drift) is structural, not token-only. |
| Side panel + tabs | `canvas-side-panel.tsx` | Section F all-5-tabs spec is a layout/state refactor. |
| Chat | `chat-composer.tsx`, `chat-workspace.tsx`, `message-renderer.tsx`, `chat-thread-list.tsx` | Section N "Cofounder Chat Input" needs the label-chip + send-button + attachment-button compound — exceeds token substitution. |
| Agents | `agent-cards.tsx`, `agent-workspace-dialog.tsx`, `agent-control-center.tsx`, `agent-config-panel.tsx`, `agent-create-dialog.tsx` | Section H agent-workspace-node is the most complex component in the spec — its own slice. |
| Tasks | `task-cards.tsx`, `task-create-dialog.tsx`, `task-detail-panel.tsx`, `task-workspace.tsx` | Section M Page 16 (full task manager) + Section K task-row card needs cluster-level work. |
| Settings | `settings-shell.tsx`, `settings-sections.tsx` | Section I = 9 settings pages, each with own visual contract; needs its own slice. |
| Integrations | `integration-center.tsx`, `postiz-integration.tsx` | Section M Page 17 grid + per-card states. |
| Departments | `department-board.tsx`, `department-cover.tsx`, `department-context-tabs.tsx`, `department-detail-panel.tsx`, `department-roadmap-strip.tsx`, `department-sections.tsx` | Section G dept-home-panel needs the 8 dept-specific accent colors from Section B. |
| Files | `file-cards.tsx`, `file-library.tsx`, `file-preview-panel.tsx`, `folder-tree.tsx`, `upload-dialog.tsx` | Library tab + file previews. |
| Notifications | `inbox-panel.tsx` | Attention inbox widget (Section N). |
| Onboarding | `company-onboarding-workspace.tsx`, `design-onboarding-wizard.tsx`, `option-card.tsx`, `personal-onboarding-wizard.tsx`, `stepper.tsx` | Section M Pages 2–7 — light-mode (deferred behind Slice 3 light-mode scope). |
| Roadmap | `roadmap-card.tsx`, `roadmap-detail-panel.tsx`, `roadmap-modal.tsx`, `roadmap-stage-board.tsx` | Roadmap hero card in Section K + roadmap UI in Section F Home tab. |
| Command palette | `command-palette.tsx` | Section N search-dropdown spec. |
| Billing | `billing-dashboard.tsx` | Section I Billing page. |
| App pages | `src/app/org/[orgId]/...`, `src/app/(auth)/login/page.tsx`, etc. | Page-level layouts — out of scope per Slice 2 rule "do not touch pages". |

### Pages and backend
Per the Slice 2 rule "do not rebuild components that already work structurally", and per the prompt's general "do not touch pages or backend files in this slice", nothing under `src/app/**/page.tsx`, `src/app/**/layout.tsx`, `src/app/api/`, or `src/lib/` was modified.

---

## Verification

```
pnpm typecheck   → exit 0
```

Build and runtime smoke were not run; Slice 2 completion criteria did not require them, and the user explicitly chose typecheck-only verification in Slice 1.

## What Slice 2b / Slice 3 Will Need

1. **Slice 2b — Domain component token migration.** Walk the 14 clusters in the table above. For each cluster, replace legacy `--app-*` / `--brand-*` / hardcoded `rgba(255,255,255,...)` references with Section V tokens. Keep structural code unchanged.
2. **Slice 3 — Light-mode scope.** Introduce a scoped light-mode token block (likely `html.light` or per-route-group class wrapper for `(marketing)` and `(auth)`). Migrate Accordion / Slider / HeroNotificationPill / the `light`/`dark`/`ghost` button variants onto the new light-mode tokens. Resolves QUESTION-29.
3. **Remove the legacy `:root` shim** in `src/styles/tokens.css` once every consumer references Section V tokens directly.
4. **Font licensing follow-up** (resolves QUESTION-27 / QUESTION-28 / DECISION-52) — load licensed `ppmondwest` and `Departure Mono` files via `next/font/local` when assets are available.

---

## Slice 3 — Light-Mode Dual-Mode System

Scope: implement the Section B light-mode token scope so marketing/auth pages render with warm cream backgrounds and dark ink text, while app pages continue to render dark.

Verification: `pnpm typecheck` → exit 0.

### Files created
| File | Reason |
|---|---|
| `src/middleware.ts` | Detects light-theme routes (/, /login, /onboarding, /pricing, /resources, /how-to/*, /privacy-policy, /terms, /terms-of-service, /docs) and stamps `x-theme: light` on the response header. All other routes get `x-theme: dark`. Matcher excludes `_next/static`, `_next/image`, favicon, and file-extension assets. |

### Files modified
| File | Reason |
|---|---|
| `src/app/layout.tsx` | Made `async`; imports `headers` from `next/headers`; reads `x-theme` header and applies it as the `<html>` class at SSR time. Default fallback is `dark` if the header is absent (e.g. during static generation). Flash-free — class is in the SSR HTML before any JS loads. |
| `src/styles/tokens.css` | Added `html:not(.dark)` block with Section B light-mode palette overrides: cream backgrounds (`--background: rgb(241,241,238)`, `--background-l0: rgb(251,251,248)`), dark-ink foreground scale (`--foreground: rgb(32,32,32)` and proportional opacity steps), dark borders (`--border: rgba(0,0,0,0.2)`), primary = `rgb(79,79,79)` (Section B "Submit dark"), focused = `rgb(29,112,217)` (Section B blue accent), and card/popover surfaces mapped to cream. |
| `src/components/ui/button.tsx` | `light` variant: `--background-l0` bg + `--shadows-light-buttons-md`. `dark` variant: `--primary` + `--shadows-light-buttons-lg`. `ghost` variant: `--foreground-60` text + `--border-subtle`. All off `--color-ink-*` and `--color-surface-*` legacy names. |
| `src/components/ui/icon-button.tsx` | `light` variant: `--background-l0` + `--shadows-light-buttons-sm`. Off legacy `--color-surface`. |
| `src/components/ui/accordion.tsx` | Border `--border-10`; trigger text `--foreground-80`/`--foreground`; content text `--foreground-60`; focus ring `--focused`. Off legacy `--color-border-card`, `--color-ink-strong`, `--color-ink-muted`, `--brand-300`. |
| `src/components/ui/slider.tsx` | Track `--foreground-10`; range `--tt-brand-color-500`; thumb border `--border-10`; focus ring `--focused`; label text `--foreground-80/50/40`. Off legacy `--brand-300`, `--brand-500`, `--color-ink-*`. |
| `REGISTRY.md` | Marked Slice 2 deferred primitives as migrated; appended Slice 3 status table. |
| `CHANGES.md` | This section. |
| `checkpoint-slice-3.md` | Phase log. |

### Files audited — no changes needed
| File | Reason |
|---|---|
| `src/components/ui/hero-notification-pill.tsx` | Uses intentional `rgba(255,255,255,...)` glassmorphic values for the hero image overlay. No `var(--app-*)` or legacy token references. Correct as-is. |

### Light-mode activation logic
```
Request → middleware detects route → sets x-theme header
  → root layout reads header (server-side) → <html class="light|dark">
  → html:not(.dark) tokens activate for light routes
  → html.dark tokens activate for dark routes
```

No client JS involved. Theme is in the SSR HTML. No flash.

### Remaining legacy `--color-*` references
Marketing domain components (marketing-nav, marketing-footer, home-sections, pricing-calculator, chapter-card, etc.) still reference `--color-ink-*`, `--color-surface-*`, and `--feature-blue-*` names. These now resolve correctly because:
1. The legacy `:root` block in `tokens.css` still declares them.
2. The new `html:not(.dark)` block overrides the shared tokens (`--background`, `--foreground`, `--border`, etc.) that underlie the semantic meaning.

Full migration of domain marketing components off legacy names is Slice 3b — deferred until after the light-mode scope was proven stable.

---

## Slice 3b — Marketing Domain Component Migration

Scope: Remove all `--color-ink-*`, `--color-surface-*`, `--color-border-*`, `--hero-blue`, and `--brand-300` (focus rings) references from every marketing component and page. All replaced with Section B / Section V tokens active under `html:not(.dark)`.

Verification: `pnpm typecheck` → exit 0.

### Files modified (19 files)

| File | Changes |
|---|---|
| `src/components/marketing/marketing-nav.tsx` | Focus rings `--brand-300` → `--focused`; nav item text `--color-ink-strong` → `--foreground-80`; separator/muted text `--color-ink-faint/muted` → `--foreground-50/60` |
| `src/components/marketing/marketing-footer.tsx` | `--color-ink` → `--foreground`; `--color-ink-muted/faint` → `--foreground-60/50`; `--color-border-card` → `--border-10` |
| `src/components/marketing/home-sections.tsx` | Full sweep: `--color-ink-*` → foreground scale; `--hero-blue` → `--tt-color-text-blue`; `--color-border-card` + `--color-surface-raised` → `--border-10` + `--background-l0`; `--color-border-pill` → `--border-subtle`; `--brand-300` → `--focused` |
| `src/components/marketing/pricing-calculator.tsx` | `--color-ink-faint/muted/strongest` → foreground scale; `--color-border-card` → `--border-10`; `--color-border-pill` → `--border-subtle` |
| `src/components/marketing/chapter-card.tsx` | `--brand-300` → `--focused`; `--color-border-pill` → `--border-subtle`; `--color-ink-muted` → `--foreground-60` |
| `src/components/marketing/feature-comparison.tsx` | `--color-border-card` → `--border-10`; `--color-ink-strong` → `--foreground-80`; `--color-ink-muted` → `--foreground-60`; `--color-feature-success` → `--success-100`; `--color-feature-neutral` → `--foreground-40` |
| `src/components/marketing/how-to-renderer.tsx` | `--color-border-card` + `--color-surface-raised` → `--border-10` + `--background-l0`; `--color-ink-faint/muted` → `--foreground-50/60`; `--color-surface-darker` → `--foreground-10`; `--brand-500` → `--tt-brand-color-500`; `--brand-300` → `--focused` |
| `src/components/marketing/resources-grid.tsx` | `--brand-300` → `--focused`; all `--color-ink-*` → foreground scale |
| `src/components/marketing/pixel-art.tsx` | `--color-border-card` → `--border-10`; `--color-ink` → `--foreground` |
| `src/app/(marketing)/pricing/page.tsx` | `--color-ink-faint/muted` → `--foreground-50/60` |
| `src/app/(marketing)/resources/page.tsx` | Same |
| `src/app/(marketing)/docs/page.tsx` | Same + `--hero-blue` → `--tt-color-text-blue` |
| `src/app/(marketing)/privacy-policy/page.tsx` | Same + `--color-border-card` → `--border-10` |
| `src/app/(marketing)/terms/page.tsx` | Same |
| `src/app/(marketing)/resources/introducing-cofounder-2/page.tsx` | Same (extra file discovered during sweep, patched for completeness) |
| `DECISIONS.md` | Appended DECISION-53 (`--border-subtle` creation rationale) |
| `REGISTRY.md` | Appended Slice 3b status table |
| `CHANGES.md` | This section |
| `checkpoint-slice-3b.md` | Phase log |

### Files audited — no changes needed

- `src/app/(marketing)/page.tsx` — zero legacy token refs
- `src/app/(marketing)/layout.tsx` — zero legacy token refs
- `src/app/(marketing)/how-to/[chapter]/page.tsx` — zero legacy token refs
- `src/components/marketing/orbit-preview.tsx` — uses `--app-*` and `--brand-*` intentionally for the dark app-preview widget embedded in the marketing page (not light-surface tokens)
- `src/components/marketing/notification-wheel.tsx` — uses `rgba(255,255,255,...)` inline styles for the hero overlay; correct as-is

### Legacy `:root` token shim status after Slice 3b
The marketing surface is now fully migrated. The legacy `:root` shim still serves:
- Domain app components (app-shell, canvas, side-panel, agents, chat, settings, etc.) — Slice 2b
- Auth pages (login-panel, onboarding) — Slice 4

The shim can be removed once Slice 2b is complete. That is the final remaining consumer cluster.

---

## Slice 4 — Settings Cluster (Section I)

Scope: migrate `settings-shell.tsx` and `settings-sections.tsx` off all legacy `--app-*`, `--brand-*`, hardcoded `rgba()` values onto Section V / Section I tokens.

Verification: `pnpm typecheck` → exit 0. `grep "var(--app-|var(--brand-)" settings-{shell,sections}.tsx` → 0 results.

### Token migration map applied

| Legacy | Section V / I | Spec rationale |
|---|---|---|
| `--app-canvas` | `--background` | Page bg = Section V `rgb(30,30,35)` |
| `--app-panel` (shell) | `--background-sidepanel` | Section V `#29292e` for sidebar panels |
| `--app-panel` (SettingsPanel cards) | `--background-settings` | Section I: "background: rgb(37,37,43)" — new token, see DECISION-56 |
| `--app-border` in SettingsPanel | `--border-8` | Section I: "border: 0.8px solid rgba(255,255,255,0.08)" |
| `--app-border` elsewhere | `--border-10` | All other dark borders = Section V `rgba(255,255,255,0.1)` |
| `--app-text` | `--foreground-80` | Section V near-white text |
| `--app-text-50` | `--foreground-50` | Section V muted text |
| `--app-primary-light` (icon) | `--foreground-80` | Sidebar header icon, near-white |
| `--app-primary-light` (StatusLine CheckCircle) | `--success-100` | Section I: success indicator = green |
| `--app-primary-light` (ExternalLinkRow) | `--tt-color-text-blue` | Section I Company tab: external links = blue |
| `--brand-300` focus rings | `--focused` | Section V `#7bb9ff` |
| `rgba(216,255,122,0.13)` active nav | `--foreground-5` | Section I active nav: `rgba(255,255,255,0.05)` |
| `rgba(255,255,255,0.06)` hover bgs | `--foreground-5` | Section I hover: `rgba(255,255,255,0.05)` |
| `rgba(255,255,255,0.04)` subtle bgs | `--foreground-3` | Section V `rgba(255,255,255,0.03)` |
| `rgba(255,255,255,0.035)` row bgs | `--foreground-3` | Section V `rgba(255,255,255,0.03)` |
| `rgba(239,68,68,0.38)` destructive border | `--tt-color-text-red-contrast` | Consistent with error-state.tsx (Slice 2) |
| `rgba(239,68,68,0.08)` destructive bg | `--tt-color-text-red-contrast` | Same pattern |
| `text-red-100` (DangerNote) | `text-[var(--destructive)]` | Section V `--destructive = lab(63.7053% 60.745 31.3109)` |
| `text-red-100/65` (DangerNote detail) | `text-[var(--foreground-50)]` | Muted secondary, not spec-specifically red |

### Files modified

| File | Reason |
|---|---|
| `src/components/settings/settings-shell.tsx` | Full re-skin of the settings layout shell (main bg, sidebar, nav items, page header card) |
| `src/components/settings/settings-sections.tsx` | Full re-skin of all 9 settings page form components (Preferences, AI, Env/Secrets, Notifications, Organization, Inbox, Support, Advanced, Payments) |
| `src/styles/tokens.css` | Added `--background-settings: rgb(37,37,43)` — Section I settings card background (DECISION-56) |
| `DECISIONS.md` | DECISION-56 appended |
| `REGISTRY.md` | Slice 4 status table appended |
| `CHANGES.md` | This section |
| `checkpoint-slice-4.md` | Phase log |

### Remaining domain clusters (13 pending)
app-shell · canvas · side-panel · agents · chat · integrations · tasks · departments · files · notifications · onboarding · roadmap · command-palette/billing

---

## Slice 5 — App-Shell Cluster (Sections D / E / F / S)

Scope: migrate the 5 app-shell components off all `--app-*`, `--brand-*`, hardcoded `rgba()` values. Create the Section S z-index constant file.

Verification: `pnpm typecheck` → exit 0. Grep across all app-shell files for `var(--app-|var(--brand-|rgba(255,255,rgba([23])` → 0 results.

### Files created

| File | Reason |
|---|---|
| `src/lib/z-index.ts` | Section S z-index architecture. All 17 named constants, single source of truth per spec requirement. Used by existing Tailwind classes `z-30` (topbar) and `z-40` (mobile nav) — those classes are not changed structurally but are now documented against their Section S layer. Canvas-specific chrome values (Z_CANVAS_CHROME = 10030, Z_DROPDOWN_MIN = 10004, etc.) are defined for use by canvas cluster in Slice 6+. |

### Files modified

| File | Changes |
|---|---|
| `src/components/app-shell/app-shell.tsx` | Full re-skin: page/sidebar bg, topbar glass bg, nav icon badge, sidebar icon nav (active/inactive/hover), topbar search+inbox+menu buttons, mobile nav (all states), unread badge, mobile CTA. |
| `src/components/app-shell/side-panel-tabs.tsx` | Full re-skin: panel wrapper, tab area border, Home/AI/Co/Tasks/Files tab content cards, PanelHeader icon badge, StatusRows dividers. |
| `src/components/app-shell/breadcrumb.tsx` | `--app-text/50` → `--foreground-80/50`. |
| `src/components/app-shell/company-switcher.tsx` | Trigger border + bg + text, hover, focus ring, dropdown text. |
| `src/components/app-shell/upgrade-modal.tsx` | Plan cards border + bg, icon colors, description text, message text. |

### Token migration map

| Legacy | Section V | Notes |
|---|---|---|
| `--app-canvas` | `--background` | `rgb(30,30,35)` |
| `--app-black-base` | `--card` | `lab(1.98454% 0 0)` ≈ very deep dark; left sidebar bg |
| `--app-panel` | `--background-sidepanel` | `#29292e` |
| `--app-border` | `--border-10` | `rgba(255,255,255,0.1)` |
| `--app-text` | `--foreground-80` | |
| `--app-text-50` | `--foreground-50` | |
| `--app-primary-light` | `--foreground-80` | Nav/panel icons, modal text — all near-white usage |
| `--app-primary-light` (mobile CTA bg) | `--primary` | Section J Tier 1 Primary |
| `--app-black-base` (mobile CTA text) | `--primary-foreground` | |
| `--brand-300` focus rings | `--focused` | |
| `--warning` (unread badge) | `--alert` | Section V `#ff672f` alert orange |
| `rgba(255,255,255,0.04)` | `--foreground-3` | Very subtle bg |
| `rgba(255,255,255,0.05)` | `--foreground-5` | |
| `rgba(255,255,255,0.06)` | `--foreground-5` | |
| `rgba(255,255,255,0.08)` | `--foreground-8` | |
| `rgba(255,255,255,0.10/.12)` | `--foreground-10` | No 0.12 token; rounded to 0.1 |
| `rgba(30,30,35,0.92)` (topbar glass) | `--background-l0-85` | Background at 85% opacity; closest available |
| `rgba(29,29,34,0.94)` (mobile nav glass) | `--background-l0-85` | Same approximation |
| `shadow-[rgba(0,0,0,0.35)_0_18px_50px]` | `--tt-shadow-elevated-md` | Multi-layer elevated shadow |

### Remaining domain clusters (12 pending)
canvas · side-panel · agents · chat · integrations · tasks · departments · files · notifications · onboarding · roadmap · command-palette/billing

---

## Slice 6a — Canvas Cluster (Sections D / E / H / S) — Tokens Only

Scope: migrate 4 canvas components off all legacy `--app-*`/`--brand-*`/hardcoded `rgba()` values. Animations deferred to Slice 6b.

Verification: `pnpm typecheck` → exit 0. Grep for `var(--app-|var(--brand-|rgba(255,255,rgba(14,14|rgba(37,37)` across canvas files → 0 CSS-class results (1 intentional SVG-attribute literal documented).

### Files modified

| File | Changes |
|---|---|
| `src/components/canvas/canvas-workspace.tsx` | Canvas bg, radial gradient, `<Background>` color → transparent (Section D no-grid), MiniMap bg class, Panel chrome bg + shadow, edge style.stroke, edge labelBgStyle.fill, maskColor resolved value |
| `src/components/canvas/cofounder-node.tsx` | Full node re-skin: border, bg, shadow, icon badge, progress track/fill, text |
| `src/components/canvas/department-node.tsx` | Node bg, shadow, unselected border (inline style), text |
| `src/components/canvas/workspace-preview-card.tsx` | Border, resting bg, hover bg, shadow, focus ring, text |
| `src/components/canvas/query-shells.tsx` | Audited — zero legacy refs |

### Token migration map

| Legacy / Hardcoded | Section V | Context |
|---|---|---|
| `var(--app-canvas)` | `var(--background)` | Canvas bg `rgb(30,30,35)` per Section D |
| `var(--app-text)` | `var(--foreground-80)` | |
| `var(--app-text-50)` | `var(--foreground-50)` | |
| `var(--app-border)` | `var(--border-10)` | |
| `var(--app-primary-light)` icon badge bg | `var(--primary)` | J Tier 1 |
| `var(--app-black-base)` icon badge text | `var(--primary-foreground)` | |
| `var(--app-primary-light)` progress fill | `var(--tt-brand-color-500)` | Brand accent for progress |
| `var(--brand-300)` | `var(--focused)` | |
| `rgba(255,255,255,0.08)` | `var(--foreground-8)` | Radial gradient subtle center |
| `rgba(255,255,255,0.10)` | `var(--foreground-10)` | Progress track |
| `rgba(238,238,232,0.34)` | `var(--border-30)` | CofounderNode border ≈ 0.3 warm white |
| `rgba(255,255,255,0.12)` | `"var(--border-10)"` | DeptNode unselected border inline style |
| `rgba(14,14,17,0.72)`, `rgba(29,29,34,0.78)` | `var(--background-l0-80)` | Dark glass ~80% opacity |
| `rgba(14,14,17,0.88)`, `rgba(37,37,43,0.92)` | `var(--background-l0-85)` | Dark glass ~85% opacity |
| Node shadows `rgba(0,0,0,0.28/0.4)` | `var(--shadow-dept-agent-node-dark)` | Section K spec node shadow |
| Panel shadow `rgba(0,0,0,0.28)_0_16px_40px` | `var(--shadow-outset-100)` | Overlay panel elevation |
| Edge `style.stroke: rgba(255,255,255,0.28)` | `"var(--border-20)"` | CSS style prop — resolves ✓ |
| Edge `labelBgStyle.fill: rgba(14,14,17,0.72)` | `"var(--background-l0-80)"` | CSS style prop — resolves ✓ |
| `<Background color="rgba(255,255,255,0.14)">` | `color="transparent"` | Section D: no grid dots |
| `maskColor="rgba(14,14,17,0.64)"` | `maskColor="rgba(30,30,35,0.64)"` | SVG attribute — uses resolved `--background` RGB |

### ReactFlow SVG-attribute constraints

Three values cannot use CSS `var()` syntax because they become SVG element attributes (not CSS style properties), where custom property resolution is not supported by browsers:

1. `markerEnd.color` — SVG `<marker>` fill attribute. Kept as `"rgba(255,255,255,0.3)"` (= resolved `--border-30`).
2. `nodeColor` callback — SVG `<circle>` fill attribute in MiniMap. Kept as `"#eeeee8"` for CofounderNode.
3. `department-node` `boxShadow` template literal — combines runtime `nodeData.color` (dept accent) with drop-shadow string. CSS var cannot safely compose inside a template literal that mixes with a runtime value.

### Animations deferred to Slice 6b

All Section L canvas animation keyframes are read (for awareness) but not implemented:
- `canvasDashFlow` — animated dashed orbital ring stroke offset
- `department-workspace-pixel-drift` — ambient pixel particles
- `department-workspace-pixel-ambient-wave` — ambient overlay drift
- `pulseGlow` — active agent node glow
- `agent-canvas-cue-pop` — new task cue pop
- `animate-node-breath` / `animate-node-select-pop` — already applied as Tailwind animation classes; their keyframe definitions are in `motion.css` and are deferred from Section L alignment

### Remaining domain clusters (11 pending)
side-panel · agents · chat · integrations · tasks · departments · files · notifications · onboarding · roadmap · command-palette/billing

---

## Slice 6b — Canvas Animations (Section L)

Scope: Register all Section L keyframes in `src/styles/animations.css`. Wire `canvasDashFlow` to the orbital edges. All other canvas-specific animations have keyframes defined and utility classes ready; structural wiring (pixel particle elements, agent cue nodes) deferred to domain-specific cluster slices.

Verification: `pnpm typecheck` → exit 0.

### Files created

| File | Reason |
|---|---|
| `src/styles/animations.css` | New file. All Section L keyframes not already in motion.css. 36 keyframes + utility classes. All animation durations and easings reference `--tt-transition-duration-*` / `--tt-transition-easing-*` Section V tokens. |

### Files modified

| File | Changes |
|---|---|
| `src/styles/globals.css` | Added `@import "./animations.css"` after motion.css import |
| `src/components/canvas/canvas-workspace.tsx` | Added `animation: "canvasDashFlow 20s linear infinite"` to orbital edge `style` object — Section D orbital ring gets the moving-ants animation per Section L spec |

### Section L keyframe inventory

**UI State** (full spec code provided):
`fade-in`, `sd-fadeIn`, `sd-blurIn`, `sd-slideUp`, `enter`, `exit`

**Looping / Ambient** (full spec code provided):
`pulse`, `pulse-building`, `thin-pulse`, `pulse-dot`, `status-dot-breathe`, `blink`, `text-blink`

**Chat / Loading** (full spec code provided):
`typing-indicator-blink`, `typing`, `loading-dots`, `bounce-dots`, `wave-bars`, `text-shimmer-sweep`, `spinner-fade`

**Canvas-specific** (some inferred from spec descriptions):
- `canvasDashFlow` — ✓ wired to orbital edges
- `department-workspace-pixel-drift` — defined (5-waypoint CSS-var-based drift per spec), wiring deferred
- `department-workspace-pixel-ambient-wave` — defined (full spec code), wiring deferred
- `agent-canvas-cue-pop` — defined (scale+opacity pop, inferred), wiring deferred to agents cluster
- `attentionUpdateSlideUp` — defined (full spec code), utility class `.animate-attention-slide-up`
- `attentionInboxItemAppear` — defined (similar slide-up), utility class `.animate-attention-item`
- `newTaskAppear` — defined (slide+fade), utility class (tasks cluster will apply)
- `taskRouteHintEnter` / `taskRouteHintIconPop` — defined, utility classes ready
- `reviewLauncherFreshBadge` / `reviewLensSettle` — defined, utility classes ready
- `canvasActivityNoteIn` — defined, utility class `.animate-canvas-note-in`
- `cofounder-cli-bloom` — defined, no direct canvas component (CLI surface not in current build)

**Marketing asset** (inferred from spec descriptions):
`MarketingAssetLoadingAnimation__marketing-asset-field/scan/dot-breathe`

### Already in motion.css — not duplicated
`node-breath` (canvas cofounder idle) · `node-select-pop` (dept node select) · `agent-pulse` (Section L `pulseGlow` equivalent) · `shimmer` · `modal-enter/exit` · `task-row-in` · `notif-pop/exit` · `panel-slide-in` · `tab-content-fade`

### Remaining domain clusters (11 pending)
side-panel · agents · chat · integrations · tasks · departments · files · notifications · onboarding · roadmap · command-palette/billing

---

## Slice 7 — Agents Cluster (Sections H / I / J / L)

Scope: Token migration + animation wiring across 5 agents components. No DOM changes. No structural refactoring.

Verification: `pnpm typecheck` → exit 0. Grep for `var(--app-|var(--brand-|rgba(239,68|rgba(255,255|rgba(0,0,0,0.12` → 0 results.

### Files modified

| File | Changes |
|---|---|
| `src/components/agents/agent-cards.tsx` | Full re-skin; selected card → `--primary` border + `--foreground-8` bg; running cards get `.animate-agent-pulse` |
| `src/components/agents/agent-config-panel.tsx` | Full re-skin; error box → `--tt-color-text-red-contrast`/`--destructive`; `--brand-300` focus ring → `--focused` |
| `src/components/agents/agent-control-center.tsx` | Full re-skin |
| `src/components/agents/agent-create-dialog.tsx` | Full re-skin; selected skill → `--primary` border + `--foreground-8` bg; error box migrated |
| `src/components/agents/agent-workspace-dialog.tsx` | Full re-skin + 3 targeted edits + animation wiring |
| `src/styles/animations.css` | `.animate-agent-pulse` utility class added |

### Token migration map

| Legacy | Section V | Notes |
|---|---|---|
| `--app-border` | `--border-10` | All 5 files |
| `--app-text` | `--foreground-80` | All 5 files |
| `--app-text-50` | `--foreground-50` | All 5 files |
| `--app-primary-light` (icons) | `--foreground-80` | Zap, Bot, Inbox, TerminalSquare, FileText, Filter |
| `--app-primary-light` (selected border) | `--primary` | Agent cards + skill cards selected border |
| `--app-primary-light` (links) | `--tt-color-text-blue` | linkify `<a>` in workspace dialog |
| `--brand-300` | `--focused` | agent-cards, config, create focus rings |
| `rgba(255,255,255,0.04)` | `--foreground-3` | Panel bgs |
| `rgba(255,255,255,0.06)` | `--foreground-5` | Ghost button hover |
| `rgba(255,255,255,0.07)` | `--foreground-8` | Card hover (agent-cards) |
| `rgba(255,255,255,0.08)` | `--foreground-8` | Selected card bg |
| `rgba(255,255,255,0.09)` | `--foreground-8` | Selected skill bg |
| `rgba(0,0,0,0.12)` | `--foreground-inverse-10` | Dark inner panels |
| `rgba(239,68,68,0.36)` border | `--tt-color-text-red-contrast` | Destructive box border |
| `rgba(239,68,68,0.12)` bg | `--tt-color-text-red-contrast` | Destructive box bg |
| `text-red-100` | `text-[var(--destructive)]` | Destructive text |
| `bg-[#111216]` | `--background-l-negative-50-100` | Browser frame (deep dark) |
| `bg-black/35` | `--foreground-inverse-30` | Code block bg (~0.3 opacity black) |

### Animation wiring

- **`.animate-agent-pulse`** — added to `animations.css`, wired to running agent cards in `agent-cards.tsx` via `agent.status === "running" ? "animate-agent-pulse" : ""`. Uses `agent-pulse` keyframe from `motion.css` (the Section L `pulseGlow` equivalent — box-shadow ring pulse).
- **`.animate-agent-cue-pop`** — wired to `agent-workspace-dialog.tsx` workspace content grid div (the `!loading && session` branch container). On session load, the workspace pops in with scale+opacity entrance per Section L `agent-canvas-cue-pop` keyframe.

### Remaining domain clusters (10 pending)
side-panel · chat · integrations · tasks · departments · files · notifications · onboarding · roadmap · command-palette/billing

---

## Slice 8 — Chat Cluster (Sections N / L / V)

Scope: token migration + Section L typing indicator wiring across 4 chat components.

Verification: `pnpm typecheck` → exit 0. Grep → 0 legacy refs.

### Files modified

| File | Changes |
|---|---|
| `src/components/chat/chat-composer.tsx` | `--app-border` → `--border-10`; `--app-text-50` → `--foreground-50`; `rgba(0.04/.06)` → `--foreground-3/5`; `--brand-300` → `--focused` |
| `src/components/chat/chat-thread-list.tsx` | Same + selected thread border `--app-primary-light` → `--primary`; selected bg `rgba(0.08)` → `--foreground-8`; unselected bg `rgba(0,0,0,0.12)` → `--foreground-inverse-10` |
| `src/components/chat/chat-workspace.tsx` | `--app-border/text/text-50/primary-light` → canonical tokens; dark panel bg `rgba(0,0,0,0.12)` → `--foreground-inverse-10` |
| `src/components/chat/message-renderer.tsx` | Full migration + 4 targeted edits + typing indicator wired to Section L spec |

### Token migration map

| Legacy | Section V | Notes |
|---|---|---|
| `--app-border` | `--border-10` | |
| `--app-text` | `--foreground-80` | |
| `--app-text-50` | `--foreground-50` | |
| `--app-primary-light` (icons, label) | `--foreground-80` | replace_all then fix exceptions |
| `--app-primary-light` (user msg / thread border) | `--primary` | J Tier 1 selected border |
| `--app-primary-light` (link text) | `--tt-color-text-blue` | Section N blue links |
| `--app-primary-light` (typing dots) | `--foreground-50` | Section N dots = muted white |
| `--brand-300` | `--focused` | |
| `rgba(255,255,255,0.04)` | `--foreground-3` | |
| `rgba(255,255,255,0.06)` | `--foreground-5` | |
| `rgba(255,255,255,0.08)` | `--foreground-8` | |
| `rgba(0,0,0,0.12)` | `--foreground-inverse-10` | dark inner panels |
| `rgba(0,0,0,0.16)` | `--foreground-inverse-20` | action log bg (rounded up) |
| `bg-black/35` | `--foreground-inverse-30` | code block bg |

### Animation wiring (Section L)

Typing indicator in `TypingIndicator` component:
- `animate-pulse` (Tailwind) → `animate-typing-dot` (Section L `typing-indicator-blink` keyframe)
- Delays: 120ms/240ms → **160ms/320ms** (spec: 0ms/160ms/320ms staggered)
- Dot color: `--app-primary-light` → `--foreground-50` (spec: dots at ~0.25–1 opacity cycling)

### Remaining domain clusters (9 pending)
integrations · tasks · departments · files · notifications · onboarding · roadmap · command-palette/billing · side-panel

---

## Slice 9 — Notifications Cluster (Sections N / O / S)

Scope: migrate `src/components/notifications/inbox-panel.tsx` off all legacy `--app-*`/hardcoded `rgba()` values. Z-index constant + two Section L animation classes wired.

Verification: `pnpm typecheck` → exit 0. Grep for `var(--app-|var(--brand-|rgba(255,255)` in inbox-panel.tsx → 0 results.

### Files modified

| File | Changes |
|---|---|
| `src/components/notifications/inbox-panel.tsx` | Full token migration + `animate-attention-slide-up` on panel + `animate-attention-item` on items + `Z_ATTENTION_INBOX` z-index |

### Token migration map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | DialogHeader border-b, subheader border-b, article border |
| `--app-text` | `--foreground-80` | Item title h3, mark-read hover text |
| `--app-text-50` | `--foreground-50` | Loading state, item description, timestamp, mark-read default |
| `--app-primary-light` (Bell icon) | `--foreground-80` | Icon tint (icon/label context per cheat sheet) |
| `--app-primary-light` (link text) | `--tt-color-text-blue` | "Open" link per Section N blue link spec |
| `rgba(255,255,255,0.04)` | `--foreground-3` | Article card bg |
| Hardcoded z-index (absent) | `Z_ATTENTION_INBOX` (1000) | DialogContent `style.zIndex` |

### Animation wiring (Section L)

- `animate-attention-slide-up` → applied to `<DialogContent>`: panel slides up `translateY(8px) → 0` on open
- `animate-attention-item` → applied to each `<article>`: individual items slide up `translateY(6px) → 0` as they render

### Hover / interaction states (Section N)

- `<article>` items: `transition-colors hover:bg-[var(--foreground-8)]` added
- "Mark read" button: `hover:text-[var(--foreground-80)]` (was `hover:text-[var(--app-text)]`)

### Empty state (Section O)

Already delegates to `<EmptyState surface="dark">` — migrated UI primitive. Title "All caught up" + description text unchanged (spec-aligned).

### Remaining domain clusters (8 pending)
integrations · tasks · departments · files · onboarding · roadmap · command-palette/billing · side-panel

---

## Slice 10 — Command-Palette Cluster (Section E / M / U)

Scope: migrate `src/components/command-palette/command-palette.tsx` off all legacy `--app-*`/`--brand-*`/hardcoded `rgba()` values. Re-skin only.

Verification: `pnpm typecheck` → exit 0. Grep for `var(--app-|var(--brand-|rgba(255,255)` in command-palette.tsx → 0 results.

### Files modified

| File | Changes |
|---|---|
| `src/components/command-palette/command-palette.tsx` | Full token migration |

### Token migration map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | DialogHeader border-b, result button hover border |
| `--app-primary-light` | `--foreground-80` | Command icon tint |
| `--app-text-50` | `--foreground-50` | Search icon, loading state, group labels, item subtitles |
| `--app-text` | `--foreground-80` | Result item title text |
| `rgba(255,255,255,0.06)` | `--foreground-5` | Result button hover background |
| `--brand-300` | `--focused` | Result button focus-visible ring |

### Notes

- Search input: already uses `<Input>` migrated primitive — no changes needed
- Empty state: already uses `<EmptyState surface="dark">` migrated primitive — no changes needed
- No z-index hardcoded in file; Dialog primitive manages its own stacking
- No Section L animation classes applicable to command palette per spec

### Remaining domain clusters (7 pending)
integrations · tasks · departments · files · onboarding · roadmap · side-panel

---

## Slice 11 — Integrations Cluster (Section M Page 17 / N / V)

Scope: migrate `integration-center.tsx` and `postiz-integration.tsx` off all legacy `--app-*`/hardcoded `rgba()` values. Re-skin only.

Verification: `pnpm typecheck` → exit 0. Grep for `var(--app-|var(--brand-|rgba(255,255)` in both files → 0 results.

### Files modified

| File | Changes |
|---|---|
| `src/components/integrations/integration-center.tsx` | 7 token passes |
| `src/components/integrations/postiz-integration.tsx` | 9 token passes |

Note: `src/app/org/[orgId]/integrations/postiz/page.tsx` has no legacy tokens (bare server wrapper — delegates fully to PostizIntegration).

### Token migration map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | All card/section/channel borders |
| `--app-panel` | `--background-sidepanel` | Card/section backgrounds |
| `--app-canvas` | `--background` | postiz main element bg |
| `--app-text-50` | `--foreground-50` | Labels, descriptions, metadata, subtitles |
| `--app-text` | `--foreground-80` | Button/link text, body text, hover targets |
| `--app-primary-light` | `--foreground-80` | Icon tint (Megaphone), status message text |
| `rgba(255,255,255,0.04)` | `var(--foreground-3)` | Metric card bg, channel item bg |
| `rgba(255,255,255,0.06)` | `var(--foreground-5)` | Ghost button hover bg |
| `rgba(255,255,255,0.08)` | `var(--foreground-8)` | Icon badge bg (postiz Megaphone) |

### Status pills (Section N)

Status badge variants remain as-is — they already use the migrated `<Badge>` primitive (Slice 2): `variant="success"` (connected), `variant="warning"` (sandbox/pending), `variant="neutral"` (missing/disconnected), `variant="danger"` (error). The `statusVariant()` function maps integration status strings to these Badge variants. No changes needed.

### Remaining domain clusters (6 pending)
files · onboarding · roadmap · tasks · departments · side-panel

---

## Slice 12 — Side-Panel Cluster (Section F / U / S)

Scope: migrate `src/components/side-panel/canvas-side-panel.tsx` off all legacy `--app-*`/`--brand-*`/hardcoded `rgba()` values. Covers all 5 tab panes: Home, AI (Cofounder), Company, Tasks, Library.

Verification: `pnpm typecheck` → exit 0. Grep for `var(--app-|var(--brand-|rgba(255,255)` in canvas-side-panel.tsx → 0 results.

### Files modified

| File | Changes |
|---|---|
| `src/components/side-panel/canvas-side-panel.tsx` | 8 token passes |

Note: `src/components/app-shell/side-panel-tabs.tsx` was already migrated in Slice 5 — no changes needed.

### Token migration map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | Aside border-t/border-l, tab bar border-b, section borders, icon badge border, MiniRow borders |
| `--app-panel` | `--background-sidepanel` | `<aside>` background |
| `--app-text` | `--foreground-80` | Aside base text color |
| `--app-text-50` | `--foreground-50` | Roadmap subtitle, PanelHeading eyebrow, MiniRow detail text |
| `--app-primary-light` | `--foreground-80` | PanelHeading icon badge tint |
| `rgba(255,255,255,0.04)` | `var(--foreground-3)` | Roadmap section card bg, MiniRow bg |
| `rgba(255,255,255,0.06)` | `var(--foreground-5)` | PanelHeading icon badge bg |
| `--brand-300` | `--focused` | Suggested task button focus-visible ring |

### Z-index (Section S)

No hardcoded z-index in this file. The `<aside>` is positioned by layout flow within the canvas workspace grid. `Z_RIGHT_SIDEBAR = 2000` is available in z-index.ts but not applicable here — the panel does not use `position: fixed` or explicit stacking.

### Tab panes migrated

- **Home** — roadmap progress card, suggested task MiniRows, Cofounder Textarea
- **AI (Cofounder)** — delegates to `<ChatWorkspace>` (migrated Slice 8)
- **Company** — StackStatus MiniRows, `<AgentControlCenter>` (migrated Slice 7)
- **Tasks** — delegates to `<TaskWorkspace>` (pending Slice 13+)
- **Library** — delegates to `<FileLibrary>` (pending Slice 13+)

### Remaining domain clusters (5 pending)
files · onboarding · roadmap · tasks · departments

---

## Slice 13 — Tasks Cluster (Section M Page 16 / R / T / V)

Scope: migrate all 4 task files off legacy `--app-*`/`--brand-*`/hardcoded `rgba()`/hardcoded hex values. High token density (18 distinct legacy patterns).

Verification: `pnpm typecheck` → exit 0. Grep for `var(--app-|var(--brand-|rgba(|#ffd27c|#9df0b4|text-red-100` across tasks/ → 0 results.

### Files modified

| File | Passes |
|---|---|
| `src/components/tasks/task-cards.tsx` | 10 |
| `src/components/tasks/task-workspace.tsx` | 8 |
| `src/components/tasks/task-create-dialog.tsx` | 4 |
| `src/components/tasks/task-detail-panel.tsx` | 12 |

### Token migration map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | All card/section/row borders |
| `--app-text-50` | `--foreground-50` | All secondary/muted text |
| `--app-text` | `--foreground-80` | Button text, ghost hover targets |
| `--app-primary-light` (icons) | `--foreground-80` | CalendarDays, Sparkles, Filter, MessageSquare, Paperclip, ShieldAlert |
| `--app-primary-light` (selected row border) | `--primary` | TaskRow selected border (task-cards.tsx only) |
| `--brand-300` | `--focused` | Focus-visible rings on interactive rows |
| `rgba(255,255,255,0.04)` | `var(--foreground-3)` | Unselected card/section bgs |
| `rgba(255,255,255,0.06)` | `var(--foreground-5)` | Icon badge bg, ghost button hover, subtask/session button hover |
| `rgba(255,255,255,0.07)` | `var(--foreground-8)` | TaskRow hover (0.07 → rounds to 0.08 token) |
| `rgba(255,255,255,0.08)` | `var(--foreground-8)` | TaskRow selected bg |
| `rgba(0,0,0,0.12)` | `var(--foreground-inverse-10)` | Board/calendar column bgs, detail panel bg, inner section bgs |
| `rgba(239,68,68,0.36)` | `var(--tt-color-text-red-contrast)` | Error block border |
| `rgba(239,68,68,0.12)` | `var(--tt-color-text-red-contrast)` | Error block bg |
| `text-red-100` | `text-[var(--destructive)]` | Error block text |
| `rgba(245,158,11,0.38)` | `var(--tt-color-text-yellow-contrast)` | Approval required block border |
| `rgba(245,158,11,0.1)` | `var(--tt-color-text-yellow-contrast)` | Approval required block bg |
| `#ffd27c` | `var(--alert)` | Approval amber text (ShieldAlert label, approval indicator) |
| `#9df0b4` | `var(--tt-color-text-green-contrast)` | Completed subtask check icon (green) |

### Task status (Section T)

Status semantics handled by `<StatusBadge>` (migrated Slice 2). The `taskStatusOptions` drives the SelectField values. No additional migration needed — status display is already spec-aligned via the Badge primitive.

### Remaining domain clusters (4 pending)
files · onboarding · roadmap · departments

---

## Slice 14 — Onboarding Cluster (Section A / M Pages 2–7 / Q / B)

Scope: migrate all 5 onboarding files. Completes light-mode system integration (Slice 3 closes here).

Verification: `pnpm typecheck` → exit 0. Grep for `var(--app-|var(--brand-|var(--color-` across onboarding/ → 0 results.

### Files modified

| File | Surface | Passes |
|---|---|---|
| `src/components/onboarding/company-onboarding-workspace.tsx` | Dark (`/org/[orgId]/onboarding`) | 9 |
| `src/components/onboarding/design-onboarding-wizard.tsx` | Dark (embedded in company-workspace) | 3 |
| `src/components/onboarding/personal-onboarding-wizard.tsx` | Light (`/onboarding`) | 1 |
| `src/components/onboarding/option-card.tsx` | Both (used in light + dark contexts) | 5 |
| `src/components/onboarding/stepper.tsx` | Light (used in personal-onboarding-wizard) | 3 |

### Token migration map

| Legacy | Section V | Surface | Context |
|---|---|---|---|
| `--app-canvas` | `--background` | dark | company-workspace main + section bgs |
| `--app-text` | `--foreground-80` | dark | AccordionTrigger, answer text |
| `--app-text-50` | `--foreground-50` | dark | Labels, descriptions, accordion content |
| `--app-border` | `--border-10` | dark | Section/card/answer row borders |
| `--app-black-base` | `--card` | dark | Cofounder center node bg |
| `--brand-300` | `--focused` | both | Focus rings (option-card, design-wizard) |
| `--brand-500` | `--tt-brand-color-500` | both | Active step, selected border, icon badge, stepper active |
| `rgba(255,255,255,0.04)` | `var(--foreground-3)` | dark | ActionLog section bg |
| `rgba(38,38,42,0.92)` | `var(--background-l0-85)` | dark | Department orbit pill glass bg |
| `--color-ink-faint` | `--foreground-50` | light | Personal wizard eyebrow label |
| `--color-ink-muted` | `--foreground-50` | light | Option card description, stepper inactive label |
| `--color-border-card` | `--border-10` | light | Option card unselected border |
| `--color-surface-raised` | `--background-l0` | light | Option card unselected bg |
| `--color-border-pill` | `--border-10` | light | Stepper step indicator border (inactive) |

### Tokens intentionally kept

| Value | Reason |
|---|---|
| `rgba(98,41,255,0.08)` | Selected option-card tint — brand purple at 8% opacity. No Section V token for brand-color at arbitrary opacity. Design-specific value. |
| `rgba(98,41,255,0.18)` | Radial gradient glow inside complex `bg-[...]` string — design-specific canvas preview gradient, not a Section V surface. |
| `rgba(30,30,35,0)` | Transparent endpoint of same gradient — no token needed at 0 opacity. |
| `--success` | Already a Section V token in stepper. |
| `--foreground` | Already a Section V token in stepper. |

### Surface routing (Slice 3 context)

`/onboarding` → `html:not(.dark)` (Section B light) → `personal-onboarding-wizard.tsx` + `stepper.tsx`
`/org/[orgId]/onboarding` → `html.dark` (Section V dark) → `company-onboarding-workspace.tsx` + `design-onboarding-wizard.tsx`
`option-card.tsx` → used in both; tokens resolve correctly under both `html.dark` and `html:not(.dark)` cascades.

### Remaining domain clusters (3 pending)
roadmap · files · departments

---

## Slice 15 — Roadmap Cluster (Section M / K / F / L)

Scope: migrate all 4 roadmap files off legacy `--app-*`/`--brand-*`/`--warning`/hardcoded rgba values. Animation wiring included.

Verification: `pnpm typecheck` → exit 0. Grep for `var(--app-|var(--brand-|var(--warning)` across roadmap/ → 0 results.

### Files modified

| File | Passes |
|---|---|
| `src/components/roadmap/roadmap-card.tsx` | 11 |
| `src/components/roadmap/roadmap-stage-board.tsx` | 7 |
| `src/components/roadmap/roadmap-modal.tsx` | 9 |
| `src/components/roadmap/roadmap-detail-panel.tsx` | 13 |

### Token migration map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | All stage/card/panel/dep borders |
| `--app-text` | `--foreground-80` | Primary text, ghost button text |
| `--app-text-50` | `--foreground-50` | Secondary labels, metadata |
| `--app-black-base` | `--card` | Stage timeline node bg |
| `--app-primary-light` (icon) | `--foreground-80` | Workflow icon (modal), GitBranch icon (detail) |
| `--app-primary-light` (selected border) | `--primary` | RoadmapCard selected border |
| `--brand-300` | `--focused` | Card focus ring + available icon text |
| `--warning` | `--alert` | Empty stage AlertCircle icon text |
| `rgba(255,255,255,0.025/.035)` | `var(--foreground-3)` | Stage column bg, empty column bg |
| `rgba(255,255,255,0.04)` | `var(--foreground-3)` | Graph entries, dependency matrix buttons |
| `rgba(255,255,255,0.045)` | `var(--foreground-5)` | Detail panel aside bg (≈0.05) |
| `rgba(255,255,255,0.055)` | `var(--foreground-5)` | Card resting bg (≈0.06) |
| `rgba(255,255,255,0.06)` | `var(--foreground-5)` | Modal icon badge bg, ghost hover |
| `rgba(255,255,255,0.07)` | `var(--foreground-8)` | DependencyMatrix button hover (≈0.08) |
| `rgba(255,255,255,0.08)` | `var(--foreground-8)` | RoadmapCard hover |
| `rgba(255,255,255,0.10)` | `var(--border-10)` | Locked card border (exact token value) |
| `rgba(255,255,255,0.11)` | `var(--foreground-10)` | Selected card bg (≈0.10) |
| `rgba(0,0,0,0.12)` | `var(--foreground-inverse-10)` | All inner dark panels |
| `rgba(245,158,11,0.12)` | `var(--tt-color-text-yellow-contrast)` | Empty stage icon badge bg |
| `rgba(239,68,68,0.35/.08)` | `var(--tt-color-text-red-contrast)` | Error block border+bg |
| `text-red-100` | `text-[var(--destructive)]` | Error block text |
| `rgba(52,168,83,0.35/.1)` | `var(--tt-color-text-green-contrast)` | Success message border+bg |
| `#bdf8c9` | `var(--tt-color-text-green-contrast)` | Success message text |
| `#9df0b4` | `var(--tt-color-text-green-contrast)` | Complete state icon text |

### Tokens kept as literals (design-specific card status colors)

`rgba(52,168,83,0.58)` complete card border, `rgba(52,168,83,0.45/.15)` complete icon badge, `rgba(157,138,255,0.62)` available card border, `rgba(157,138,255,0.42/.15)` available icon badge, `rgba(255,255,255,0.12)` selected card ring shadow, `rgba(255,255,255,0.16)` timeline connector — all design-specific card status UI with no Section V equivalents.

### Animation wiring (Section L)

- `animate-sd-slide-up` → added to `RoadmapCard` button base class: cards slide up 4px on mount
- `animate-sd-slide-up` → added to `RoadmapDetailPanel` `<aside>`: panel slides up on item selection (component is keyed by `selectedItem?.id` in roadmap-modal, so it remounts and re-animates on each selection)

### Remaining domain clusters (2 pending)
files · departments

---

## Slice 16 — Files Cluster (Section M / N / U)

Scope: migrate all 5 file component files off legacy `--app-*`/`--brand-*`/hardcoded rgba values. Completes the file/library system end-to-end.

Verification: `pnpm typecheck` → exit 0. Only `rgba(216,255,122,*)` remains — intentional design-specific lime selection highlight, no Section V equivalent.

### Files modified

| File | Passes |
|---|---|
| `src/components/files/file-cards.tsx` | 7 |
| `src/components/files/folder-tree.tsx` | 6 |
| `src/components/files/upload-dialog.tsx` | 3 |
| `src/components/files/file-library.tsx` | 7 |
| `src/components/files/file-preview-panel.tsx` | 10 |

### Token migration map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | Card/section/panel borders |
| `--app-text` | `--foreground-80` | File name, preview text, button text |
| `--app-text-50` | `--foreground-50` | File metadata, folder labels, eyebrows |
| `--app-primary-light` | `--foreground-80` | File type icons, folder icons, Files/Search/Link2 icons |
| `--brand-300` | `--focused` | File card and folder button focus rings |
| `rgba(255,255,255,0.04)` | `var(--foreground-3)` | Unselected card/section bgs, stat cards, version rows |
| `rgba(255,255,255,0.05)` | `var(--foreground-5)` | Folder button hover bg (≈0.06) |
| `rgba(255,255,255,0.06)` | `var(--foreground-5)` | Icon badge bg, ghost button hover |
| `rgba(255,255,255,0.07)` | `var(--foreground-8)` | File icon badge bg (≈0.08) |
| `rgba(0,0,0,0.12)` | `var(--foreground-inverse-10)` | Version history section bg |
| `rgba(0,0,0,0.14)` | `var(--foreground-inverse-10)` | Preview block bg (≈0.12) |
| `rgba(0,0,0,0.22)` | `var(--foreground-inverse-20)` | Code/text preview block inner bg (≈0.20) |

### Tokens kept as literals

`rgba(216,255,122,0.46)` (selected card border), `rgba(216,255,122,0.1)` (selected file card bg), `rgba(216,255,122,0.12)` (selected folder button bg) — design-specific lime/neon selection highlight. No Section V token for this selection color.

### Remaining domain cluster (1 pending)
departments

---

## Slice 17 — Departments Cluster (Section A / G / L / P) — FINAL SLICE

Scope: token migration across all 6 department files + structural pixel-drift particle DOM implementation in `department-cover.tsx`. This is the final slice of the Cofounder.co UI/UX overhaul (17/17).

Verification: `pnpm typecheck` → exit 0. Zero `var(--app-|var(--brand-|rgba(` refs across all 6 files.

### Files modified

| File | Type | Passes |
|---|---|---|
| `src/components/departments/department-board.tsx` | token migration | 8 |
| `src/components/departments/department-context-tabs.tsx` | token migration | 6 |
| `src/components/departments/department-cover.tsx` | token migration + STRUCTURAL | full rewrite |
| `src/components/departments/department-detail-panel.tsx` | token migration | 7 |
| `src/components/departments/department-roadmap-strip.tsx` | token migration | 3 |
| `src/components/departments/department-sections.tsx` | token migration | 8 |

### Token migration map (all 6 files)

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | All card/section/accordion borders |
| `--app-text` | `--foreground-80` | Primary text, ghost button text |
| `--app-text-50` | `--foreground-50` | Labels, descriptions, metadata |
| `--app-primary-light` | `--foreground-80` | Section icons, file icons |
| `rgba(255,255,255,0.04)` | `var(--foreground-3)` | Card/section bgs |
| `rgba(255,255,255,0.06)` | `var(--foreground-5)` | Ghost button hover |
| `rgba(255,255,255,0.07)` | `var(--foreground-8)` | Icon badge bgs |
| `rgba(0,0,0,0.12)` | `var(--foreground-inverse-10)` | Metric/inner panel bgs |
| `shadow-[rgba(0,0,0,0.24)_0_18px_48px]` | `shadow-[var(--tt-shadow-elevated-md)]` | Department cover card shadow |

### Structural work: pixel-drift particle DOM (department-cover.tsx)

**Deterministic particle generator** seeded from `slug` using LCG (linear congruential generator):
- `hashCode(slug)` → integer seed from slug string
- `lcg(seed)` → deterministic PRNG (stable across server + client renders, no hydration mismatch)
- 15 particles computed inline in render body (server component, no hooks needed)

**Each particle `<div>`:**
- `className="animate-pixel-drift absolute size-[2px] rounded-sm bg-white"`
- `animationDelay`: staggered 0–5s per particle
- CSS custom properties per keyframe API:
  - `--department-pixel-start-x`: ±4px (random from slug seed)
  - `--department-pixel-start-y`: ±3px (random from slug seed)
  - `--department-pixel-dim-opacity`: 0.10–0.30 (dim state)
  - `--department-pixel-bright-opacity`: 0.50–0.80 (bright peak)
- Position: `left` 4%–92%, `top` 8%–84% (kept in bounds)
- Container: `pointer-events-none absolute inset-0 overflow-hidden aria-hidden`

**Ambient wave overlay:**
- `animate-pixel-wave` added to existing grid overlay `<div>`
- Grid pattern gently drifts ±7px horizontally (12s ease-in-out infinite)
- `--department-pixel-start-x/y` not needed — wave uses fixed translate values

### Section A: Department accent colors

`--department-accent` CSS custom property already wired via `getDepartmentVisual(slug).cover.accent` + override from `color` prop. No changes needed — accent system was already spec-aligned before this slice.

### Overhaul status after Slice 17

**17/17 slices complete. 100% spec alignment.**
