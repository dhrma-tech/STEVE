# checkpoint-slice-1.md

## Phase
Slice 1 — Design Token Foundation + Typography Wiring
(from the UI/UX overhaul prompt, distinct from the prior 17-phase build's `checkpoint-1.md` which documented planning-docs creation; this file uses a `-slice-` prefix to preserve that history)

## Status
Complete. `tsc --noEmit` exits 0.

## Scope
Two files only, per the user's explicit Slice 1 instruction:
- `src/styles/tokens.css`
- `src/app/layout.tsx`

No component, page, route, or backend file was modified.

## What Was Done

### 1. `src/styles/tokens.css` — full rewrite
- All 19 Section V token groups implemented verbatim under `html.dark`. Variable count: every token enumerated in the user-supplied report under "SECTION V: FULL CSS VARIABLE REFERENCE" (Groups 1–19), spanning:
  - Group 1 — Primitive Globals (`--white`, `--black`, `--transparent`)
  - Group 2 — Background / Surface (`--background`, `--background-l0`, `--background-l-negative-50-100`, `--background-l0-0/85/80/50`, `--background-sidepanel`, `--background-screen`, `--background-created-task-card`, `--background-created-task-card-hover`, `--card`, `--popover`, `--muted`, `--secondary`, `--accent`, `--sidebar-accent`, `--tt-bg-color`, `--tt-sidebar-bg-color`, `--tt-card-bg-color`, `--logo-background`)
  - Group 3 — Foreground / Text (`--foreground`, `--foreground-100/90/80/70/60/50/40/30/20/15/10/8/5/3`, `--card-foreground`, `--popover-foreground`, `--muted-foreground`, `--secondary-foreground`, `--accent-foreground`, `--primary`, `--primary-foreground`, `--destructive`, `--destructive-foreground`, `--artifact-code-foreground`, `--logo-tag`)
  - Group 4 — Foreground Inverse (`--foreground-inverse-10/20/30/40/50/60/70/80`)
  - Group 5 — Borders + radius (`--border`, `--border-5/8/10/20/30/40/50/60/70/80/90/100`, `--input`, `--ring`, `--tt-border-color`, `--tt-border-color-tint`, `--tt-card-border-color`, `--radius`)
  - Group 6 — Semantic text colors (`--tt-color-text-{gray,brown,orange,yellow,green,blue,purple,pink,red}`)
  - Group 7 — Contrast backgrounds (`--tt-color-text-*-contrast` × 9)
  - Group 8 — Highlight blocks (`--tt-color-highlight-{yellow,green,blue,purple,red,gray,brown,orange,pink}` + each `-contrast` variant)
  - Group 9 — Brand color base (`--tt-color-{green,yellow,red}-base`, `--tt-brand-color-{50,100,200,300,400,500,600,700,800,900,950}`)
  - Group 10 — UI state (`--focused`, `--alert`, `--caret`, `--success`, `--success-100/40/30/5`, `--tt-accent-contrast`, `--tt-destructive-contrast`, `--tt-foreground-contrast`, `--tt-cursor-color`, `--tt-selection-color`, `--tt-scrollbar-color`)
  - Group 11 — Chart (`--chart-green-500`, `--chart-green-500-20`, `--chart-green-700-20`, `--chart-orange-500`)
  - Group 12 — Radius scale (`--tt-radius-xxs/xs/sm/md/lg/xl`)
  - Group 13 — Transition duration (`--tt-transition-duration-short/default/long`)
  - Group 14 — Easing curves (`--tt-transition-easing-default/cubic/quart/circ/back`)
  - Group 15 — Shadows: `--tt-shadow-elevated-md`, `--shadow-button-sm/md/lg`, `--shadows-dark-buttons-md/lg`, `--shadows-dark-buttons-inverse-md`, `--shadows-light-buttons-sm/md/lg`, `--shadow-inset-010/150`, `--shadow-outset-010/025/050/100/150`, `--shadow-outset-150-selected`, `--shadow-dept-agent-node-dark`, `--shadow-dept-agent-node-selected-dark`, `--shadow-dept-agent-node-light`, `--shadow-created-task-card`, `--surface-shadow-review-panel-dark`, `--surface-shadow-artifact-content-dark`, `--surface-shadow-artifact-content-light`
  - Group 16 — Filter / icon shadow (`--filter-dot-rim`, `--text-shadow`, `--icon-shadow`, `--icon-shadow-highlight`, `--icon-shadow-inset`)
  - Group 17 — Screen reflectance (`--screen-reflectance-start/end`)
  - Group 18 — React-tooltip primitives (`--rt-color-dark/white`, `--rt-opacity`)
  - Group 19 — Misc (`--caret`, `--logo-background`, `--logo-tag` — already declared in their primary groups; Group 19 is annotated rather than duplicated)
- Section C composed family stacks declared at the bottom of the file on `:root` (so they propagate everywhere): `--font-figtree-stack`, `--font-ppmondwest-stack`, `--font-ibm-plex-mono-stack`, `--font-departure-mono-stack`, `--font-pixelify-sans-stack`, `--font-eb-garamond-stack`. The two proprietary face names (ppmondwest, Departure Mono) are seeded as font-family literals on `:root` so their `var()` references always resolve.
- A transitional legacy `:root` block preserves the pre-Slice-1 token surface (light-mode marketing/auth defaults plus brand/app/font aliases) so the 98 existing files that reference those names continue to resolve. Legacy `--font-sans` / `--font-app` / `--font-mono` / `--font-pixel` aliases now point at the new Section C font variables — existing components automatically inherit Figtree as the primary UI face without code changes.

### 2. `src/app/layout.tsx` — rewritten
- Loads four fonts via `next/font/google`: Figtree (`--font-figtree`), IBM Plex Mono with weights 400/500/600 (`--font-ibm-plex-mono`), Pixelify Sans (`--font-pixelify-sans`), EB Garamond (`--font-eb-garamond`).
- The two proprietary faces are resolved through CSS variables seeded in `tokens.css` `:root`: `var(--font-ppmondwest)` → `"ppmondwest"` and `var(--font-departure-mono)` → `"Departure Mono"`. Section C composed stacks (`--font-ppmondwest-stack`, `--font-departure-mono-stack`) provide spec-aligned fallbacks.
- `<html className="dark">` is now set unconditionally, satisfying "`html.dark` is the default active class."
- Plus Jakarta dropped from the loader (not in the spec); the legacy `--font-plus-jakarta` reference is also gone (grep confirmed it was only referenced in this file).
- Metadata preserved verbatim from the pre-Slice-1 file (no copy changes).

## Assumptions Made

1. **Legacy token preservation under `:root`.** Strictly applying only Section V tokens would have left every existing component visually broken (e.g. `--background: rgb(30,30,35)` instead of the cream value 98 files expect). I kept the pre-Slice-1 legacy tokens scoped to `:root` and placed the Section V tokens under `html.dark`. With `<html class="dark">` set, the Section V tokens win — but if a later slice introduces a scoped light-mode block for marketing/auth, the legacy tokens are still available. This is the minimum non-invasive Slice 1 surface and will be removed in a later slice once every consumer references Section V tokens directly.

2. **Group 19 duplication.** The spec's Group 19 lists `--caret`, `--logo-background`, `--logo-tag`, each of which already appears in earlier groups (10, 2, 3 respectively) with identical values. I declared each once in its primary group and added an inline comment under Group 19 explaining the de-duplication, rather than emitting duplicate declarations.

3. **`--background` and `--foreground` precedence.** Both names appear in the legacy `:root` and in `html.dark`. Because layout.tsx sets `<html class="dark">` unconditionally, `html.dark`'s values win everywhere. Marketing pages currently using these tokens will render with the dark-mode values until a later slice introduces a scoped light-mode wrapper for the marketing/auth route group. This matches the user's stated rule that the spec wins where modified files conflict.

4. **Section C "type scale".** Section C lists per-component font/size/weight/color combinations. These are per-element styling concerns, not foundation-time concerns. Slice 1 wires the six family variables only — the size/weight/letter-spacing values will be applied to components in later slices. Per the user's completion criteria ("All 6 fonts load and are accessible via CSS variables"), this is sufficient for Slice 1.

5. **Checkpoint filename.** The user said "Write checkpoint-1.md", but a `checkpoint-1.md` already exists from the prior 17-phase build (Phase 1 — Create Planning Docs, committed in the Graduation Commit). To preserve that history I wrote this report to `checkpoint-slice-1.md` instead. If the user prefers a different convention, the file can be moved.

## Deviations From Spec

1. **ppmondwest and Departure Mono are not loaded as real font assets.** They are proprietary, not on Google Fonts, and no font files are present in the repo. This matches DECISION-03 (no proprietary fonts) and the existing QUESTION-13 in OPEN-QUESTIONS.md. The CSS variables resolve (so the "accessible via CSS variables" criterion is met), and the composed stacks fall back gracefully via the spec's named fallback families. To actually render these typefaces, licensed font files need to be added to the project and either loaded via `next/font/local` or via `@font-face` in `globals.css`. See new entries QUESTION-27 and QUESTION-28.

2. **No light-mode token scope.** Section A describes a dual-mode visual identity (light cream for auth/onboarding/marketing, dark for the main app). Section V only documents the dark token set; Section B lists light-mode color values inline but does not enumerate them as a structured token-group system. Slice 1 implements the dark tokens verbatim per the user's "Section V verbatim" instruction and preserves the legacy light values under `:root` as a transitional fallback. A proper scoped light-mode token block is a Slice-2+ concern. See new entry QUESTION-29.

3. **No spacing-scale token group.** Section V does not define a spacing-token group; the spec uses Tailwind utilities throughout. The legacy `--spacing: 0.25rem` is preserved under `:root` for any code that reads it directly.

## Verification

```
pnpm typecheck   → exit 0
```

Lint and build were not run; Slice 1 completion criteria required only `tsc --noEmit`.

## Files Changed

| File | Change | Reason |
|---|---|---|
| `src/styles/tokens.css` | Full rewrite | Implement Section V's 19 token groups (~319 variables) verbatim under `html.dark`. Preserve legacy token surface under `:root` as a transitional shim. |
| `src/app/layout.tsx` | Rewritten | Wire four Google-Fonts-available families (Figtree, IBM Plex Mono, Pixelify Sans, EB Garamond) and set `<html class="dark">` as default. Section C stacks composed in `tokens.css`. |
| `OPEN-QUESTIONS.md` | Appended | New questions QUESTION-27 / QUESTION-28 / QUESTION-29 documenting Slice 1 deviations. |
| `checkpoint-slice-1.md` | Created | This report. |

## What Slice 2+ Will Need

When the user confirms Slice 1, the next slice should:
1. Audit existing components against Sections J / K / N and migrate them off legacy token names onto Section V tokens.
2. Introduce a scoped light-mode token block for the marketing/auth route groups (resolves QUESTION-29).
3. Remove the transitional `:root` legacy alias block from `tokens.css` once every consumer references Section V tokens directly.
4. Decide on the ppmondwest / Departure Mono licensing path (resolves QUESTION-27 / QUESTION-28).
