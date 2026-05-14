# checkpoint-slice-2.md

## Phase
Slice 2 — UI Primitives Token Migration (Sections J / K / N)

## Status
Complete. `pnpm typecheck` exits 0.

## Scope
Re-skin existing UI primitives onto Section V tokens (active under `html.dark` from Slice 1). No structural rebuilds; variant signatures and exported types unchanged. Marketing/light-mode primitives intentionally deferred — they have no Section V equivalent until the light-mode scope lands in Slice 3.

Touched: 21 files under `src/components/ui/`, plus `REGISTRY.md`, `DECISIONS.md`, `CHANGES.md`, and this checkpoint.

## What Was Done

### Token migration cheat sheet (applied uniformly)

| Legacy token | Section V token |
|---|---|
| `--app-border` | `--border-10` |
| `--app-input-border` | `--input` |
| `--app-text` | `--foreground` / `--foreground-80` |
| `--app-text-{80,50,30}` | `--foreground-{80,50,30}` |
| `--app-canvas` | `--background` |
| `--app-panel` / `--app-workspace-raised` | `--background-sidepanel` |
| `--app-black-base` (dropdowns / dialogs) | `--popover` |
| `--app-card` | `--card` |
| `--app-primary-light` | `--primary` (with `--primary-foreground` for text) |
| `--brand-{500,400,300}` | `--tt-brand-color-{500,400,300}` |
| `--brand-300` focus rings | `--focused` |
| `--danger` | `--destructive` |
| `rgba(255,255,255,0.05)` literal | `--foreground-5` |
| `rgba(255,255,255,0.08)` literal | `--foreground-8` |
| `rgba(255,255,255,0.10)` literal | `--foreground-10` |
| `rgba(255,255,255,0.14)` literal | `--foreground-15` |
| `rgba(52,168,83,...)` greens | `--success` / `--success-30` / `--success-40` / `--success-100` |
| `rgba(239,68,68,...)` reds | `--destructive` / `--tt-color-text-red-contrast` |
| Hardcoded `rgba(...)_0_..._...` shadow stacks | `--shadow-button-md`, `--shadow-outset-100/150`, `--tt-shadow-elevated-md` |
| Hardcoded transition durations on buttons | `--tt-transition-duration-short` + `--tt-transition-easing-default` |

### Primitives migrated (21 files in `src/components/ui/`)

Foundation / leaf:
- `skeleton.tsx` — dark shimmer gradient uses `--foreground-5/15`.
- `loading-state.tsx` — dark border `--border-10`.
- `tooltip.tsx` — re-skinned to Section N tooltip spec (`--background-sidepanel`, 6px radius, `--tt-shadow-elevated-md`).
- `badge.tsx` + `StatusBadge` — all 6 variants on `--success-*` / `--tt-color-text-*` / `-contrast` tokens.
- `avatar.tsx` — `--border-10` / `--foreground-8` / `--foreground`.

Surfaces:
- `card.tsx` — `app` → `--background-sidepanel`, `deep` → `--card`, `AppPanel` → `--shadow-outset-100`.
- `empty-state.tsx` — dark surface `--foreground-3` bg, `--border-10`, `--foreground-80` text.
- `error-state.tsx` — `--tt-color-text-red-contrast` border + bg, `--destructive` icon + text.
- `container.tsx` — `AppViewport` / `AppSplit` switched to `--background` + `--foreground-80`.

Inputs:
- `input.tsx` — `--input` / `--foreground-5` / `--foreground-80` / `--caret` / `--destructive` / `--focused`.
- `textarea.tsx` — same migration.
- `select.tsx` — trigger matches Input; content matches DropdownMenu.
- `file-upload.tsx` — `--input` / `--foreground-3`, dragging state `--focused` + `--tt-color-text-blue-contrast`.

Buttons:
- `button.tsx` — Section J Tier mapping: `app` → Tier 1 Primary (`--primary` + `--shadow-button-md`), `danger` → Tier 5 Destructive, `brand` → `--tt-brand-color-500/400`; focus ring `--focused`; transitions use `--tt-transition-duration-short` + `--tt-transition-easing-default`.
- `icon-button.tsx` — Dark variants on `--foreground-{5,8,10}` layered surfaces + `--focused`.

Overlays:
- `dropdown-menu.tsx` — `--popover` bg, `--border-10`, `--shadow-outset-100`, hover `--foreground-8`; applied to Content, SubContent, all item variants, Label, Separator.
- `dialog.tsx` — `--popover` modal bg, `--shadow-outset-150`, `--foreground-50`/`--foreground` close-button ramp, `--focused` ring.

Composite:
- `progress.tsx` — track `--foreground-10`, indicator `--tt-brand-color-500`, ProgressField label `--foreground-80` / `--foreground-50`.
- `segmented-control.tsx` — dark container `--border-10` / `--foreground-5`; active segment `--primary` / `--primary-foreground` (matches Section I Appearance segmented control).
- `tabs.tsx` — active tab `--primary` / `--primary-foreground`; focus ring `--focused`.
- `toggle.tsx` — Switch on-state `--success-30` (matches Section I Notifications switch spec). ToggleField bg `--foreground-3`; ToggleButton active `--primary`.

### Documentation
- `REGISTRY.md` — appended a "Slice 2 — Token Migration" section with per-component status, intentionally-skipped marketing primitives, and the domain-components deferral list.
- `DECISIONS.md` — appended DECISION-52 (defer proprietary font licensing per user instruction).
- `CHANGES.md` — created. Lists every file modified + reason, files intentionally skipped, and the Slice 2b / Slice 3 follow-up plan.
- `checkpoint-slice-2.md` — this file.

## Assumptions Made

1. **Variant names preserved.** Button has 6 legacy variants (light/dark/brand/ghost/app/danger); Section J defines 8 tiers. Rebuilding the variant structure would be "rebuilding a component that already works structurally," which Slice 2 forbids. I mapped existing variants onto the closest Section J tier (`app` → Tier 1, `danger` → Tier 5, `brand` → branded CTA) and left the marketing variants (`light`, `dark`, `ghost`) on legacy light tokens until Slice 3. Missing tiers (Canvas embossed, GitHub login pill) will be added as needed by future pages, not preemptively.

2. **Marketing-only primitives skipped.** Accordion, Slider, and HeroNotificationPill have no usage on dark-mode app surfaces and rely on light-mode tokens or white-on-image styling that is correct as-is. Migrating them now would require the light-mode scope from Slice 3 to provide replacement tokens. Decision recorded in CHANGES.md.

3. **Domain components deferred to Slice 2b.** ~80 files across 14 clusters (app-shell, canvas, side-panel, agents, chat, settings, integrations, tasks, departments, files, notifications, onboarding, roadmap, command-palette, billing) still reference legacy tokens. Each cluster carries Section-specific structural decisions (Section H agent-workspace-node, Section I 9 settings pages, etc.) that exceed a token-substitution pass. Touching them with a pure rename would either be incomplete (missing structural alignment to their spec sections) or scope-bloat (mixing structural rebuilds into a "re-skin only" slice). The legacy `:root` shim from Slice 1 keeps them rendering correctly until each cluster gets its own slice. List captured in CHANGES.md with priority order.

4. **Switch on-state color override.** The pre-Slice-2 Switch used `--brand-500` (purple) for the on-state. Section I Notifications page explicitly specifies the toggle on-state as `color(srgb 0.203922 0.658824 0.32549 / 0.3)` — that's `--success-30` (green at 30%). I migrated to the spec value despite this being a visual change. This counts as "re-skin to spec" rather than "rebuild," since the structural component is unchanged.

## Deviations From Spec

1. **Button variant count.** Spec Section J defines 8 button tiers; existing component has 6 variants. I aligned semantics but did not add Tier 6 (Canvas CTA 3D embossed dark), Tier 7 (Canvas New Task embossed press-down), or Tier 8 (GitHub auth pill). These need new pages to render against. Adding unused variants now would be premature abstraction. Will be added during canvas / login slices.

2. **No "light" vs "dark" surface decomposition for inputs / tooltips / dropdowns.** Inputs, textareas, selects, and file-upload still accept a `surface` prop. Per Slice 2 rule "do not rebuild components that already work structurally", I kept the dual-surface pattern intact and only migrated the dark-surface branch onto Section V tokens. Slice 3 will collapse `surface` into route-group context once light-mode scope lands.

3. **Tooltip / Dropdown popovers use `--background-sidepanel` for tooltip but `--popover` (lab(1.98454% 0 0) ≈ #050505) for dropdowns and dialogs.** Section N actually specifies `rgb(41,41,46)` (= `--background-sidepanel`) for tooltips and `rgb(41,41,46)` for many dropdowns too — but the "Card Type: Popover / Dropdown" subsection in Section K uses `rgb(41,41,46)` while "Card Type: Fresh Updates / Notification Popover" uses `lab(1.98454% 0 0)`. To avoid breaking visual contrast on existing usages mid-slice, dropdowns continue using `--popover` (their pre-Slice-2 base). This is a small palette inconsistency relative to spec that Slice 2b will reconcile when domain-component pages are migrated and we can see which popover surface the user expects for which usage.

## Verification

```
pnpm typecheck   → exit 0
```

Slice 2 completion criteria did not require lint or build runs. The Slice 1 verification policy applies: typecheck-only is the agreed verification level until a slice explicitly needs more.

## Files Changed (compact list)

```
src/components/ui/avatar.tsx
src/components/ui/badge.tsx
src/components/ui/button.tsx
src/components/ui/card.tsx
src/components/ui/container.tsx
src/components/ui/dialog.tsx
src/components/ui/dropdown-menu.tsx
src/components/ui/empty-state.tsx
src/components/ui/error-state.tsx
src/components/ui/file-upload.tsx
src/components/ui/icon-button.tsx
src/components/ui/input.tsx
src/components/ui/loading-state.tsx
src/components/ui/progress.tsx
src/components/ui/segmented-control.tsx
src/components/ui/select.tsx
src/components/ui/skeleton.tsx
src/components/ui/tabs.tsx
src/components/ui/textarea.tsx
src/components/ui/toggle.tsx
src/components/ui/tooltip.tsx
REGISTRY.md
DECISIONS.md
CHANGES.md
checkpoint-slice-2.md
```

## What Slice 2b / Slice 3 Need

1. **Slice 2b — domain component migration.** Walk the 14 clusters in CHANGES.md priority order; replace legacy token references with Section V tokens. No structural rebuilds. Re-run typecheck after each cluster.
2. **Slice 3 — light-mode scope.** Introduce a scoped light-mode token block (likely `html.light` or per-route-group wrapper for `(marketing)` and `(auth)`). Migrate marketing-only primitives (Accordion, Slider, HeroNotificationPill) and the `light`/`dark`/`ghost` button variants onto the new light-mode tokens. Resolves QUESTION-29.
3. **Remove the legacy `:root` shim** in `src/styles/tokens.css` once Slice 2b is complete and every consumer references Section V tokens directly.
4. **Font licensing follow-up** (DECISION-52 / QUESTION-27 / QUESTION-28) — when licensed `ppmondwest` and `Departure Mono` assets are available, load via `next/font/local`.
