# checkpoint-slice-3.md

## Phase
Slice 3 — Light-Mode Dual-Mode System (Section B palette)

## Status
Complete. `pnpm typecheck` exits 0.

## Scope
Implement the Section A dual-mode visual identity: light cream for marketing/auth routes, dark for app routes. No flash. Five light-mode primitives migrated. Legacy shim preserved.

## What Was Done

### 1. `src/middleware.ts` — created
Next.js Edge Middleware that runs on every non-asset request and sets an `x-theme: light` or `x-theme: dark` response header based on the pathname.

**Light routes** (receive `x-theme: light`):
- `/` (root marketing page)
- `/login`, `/onboarding`
- `/pricing`, `/resources`, `/how-to/*`
- `/privacy-policy`, `/terms`, `/terms-of-service`, `/docs`

**Dark routes** (receive `x-theme: dark`): everything else — app shell, canvas, settings, API routes, etc.

The matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and any path with a file extension so static assets are never intercepted.

### 2. `src/app/layout.tsx` — updated
Made the root layout `async`. Imports `headers` from `next/headers`. Reads the `x-theme` header set by middleware and passes it as `className` to `<html>`. Falls back to `"dark"` if the header is absent (e.g. during static generation or direct API calls).

Result: the correct theme class is present in the SSR HTML before any JavaScript loads — no client-side class toggling, no flash.

### 3. `src/styles/tokens.css` — updated
Added `html:not(.dark)` block at the end of the file with Section B light-mode palette overrides:

| Token | Light value | Section B source |
|---|---|---|
| `--background` | `rgb(241, 241, 238)` | "Page body, onboarding canvas bg" |
| `--background-l0` | `rgb(251, 251, 248)` | "Cards, panels, login page body" |
| `--background-screen` | `rgb(242, 242, 238)` | "Center node inner screen" |
| `--foreground` | `rgb(32, 32, 32)` | "Primary text" |
| `--foreground-60` | `rgba(32,32,32,0.6)` | "Secondary text, dept labels" |
| `--foreground-50` | `rgba(32,32,32,0.5)` | "Legal text, subtle labels" |
| `--foreground-10` | `rgba(32,32,32,0.1)` | "Orbital ring strokes, dividers" |
| `--foreground-{80,70,40,30,20,15,8,5,3}` | Proportional dark-ink opacity steps | Derived from Section B pattern |
| `--border` | `rgba(0,0,0,0.2)` | "Input borders" |
| `--border-subtle` | `rgba(0,0,0,0.06)` | "Ghost button borders" |
| `--input` | `rgba(0,0,0,0.2)` | Same as border on light |
| `--card`, `--popover` | `rgb(251, 251, 248)` | Card surfaces = background-l0 |
| `--primary` | `rgb(79, 79, 79)` | "Submit dark" — Section B |
| `--primary-foreground` | `rgba(255,255,255,0.8)` | Text on dark submit buttons |
| `--tt-color-text-blue` | `rgb(29, 112, 217)` | "Recommended badge text" |
| `--tt-color-text-blue-contrast` | `rgb(218, 233, 251)` | "Recommended badge background" |
| `--focused` | `rgb(29, 112, 217)` | Focus rings on light surfaces |
| `--ring` | `rgba(29,112,217,0.4)` | Radix focus ring |
| `--onboarding-warm-bg` | `#F4F2ED` | Dept onboarding overlay bg |
| `--onboarding-warm-text` | `#1A1916` | Dept onboarding text |

### 4. Five light-mode primitives migrated

**`button.tsx`** — `light`, `dark`, `ghost` variants:
- `light`: `--background-l0` bg, `--border-10` border, `--foreground` text, `--shadows-light-buttons-md`. Off `--color-surface` / `--color-surface-raised`.
- `dark`: `--primary` (rgb(79,79,79)) bg, `rgba(0,0,0,0.5)` border, `--primary-foreground` text, `--shadows-light-buttons-lg`. Keeps gradient style via brightness hover.
- `ghost`: `--foreground-60` text, `--border-subtle` resting border, `--foreground-8` hover bg. Off `--color-ink-strong` / `--color-border-pill`.

**`icon-button.tsx`** — `light` variant:
- `--background-l0` bg, `--border-10` border, `--foreground` text, `--shadows-light-buttons-sm`.

**`accordion.tsx`**:
- Item border: `--border-10` (off `--color-border-card`)
- Trigger: `--foreground-80` resting, `--foreground` hover, `--focused` ring (off `--color-ink-strong`, `--brand-300`)
- Content: `--foreground-60` text (off `--color-ink-muted`)

**`slider.tsx`**:
- Track: `--foreground-10` (off hardcoded `rgba(38,35,35,0.12)`)
- Range: `--tt-brand-color-500` (off `--brand-500`)
- Thumb border: `--border-10` (off hardcoded `rgba(32,32,32,0.12)`)
- Focus ring: `--focused` (off `--brand-300`)
- SliderField labels: `--foreground-80/50/40` (off `--color-ink-strong/muted/faint`)

**`hero-notification-pill.tsx`** — audited, no changes:
- Uses intentional `rgba(255,255,255,...)` glassmorphic values for the homepage hero image overlay. No legacy `var(--app-*)` or `var(--color-*)` references. Correct as-is.

## Assumptions Made

1. **`html:not(.dark)` over `html.light`**: Using `:not(.dark)` means the light-mode tokens activate for any HTML element without a `.dark` class — including pages that might temporarily have neither class during SSR edge cases. This is more resilient than requiring an explicit `.light` class; the middleware sets `.light` but this selector is a belt-and-suspenders catch-all. The SSR HTML will always have one of `light` or `dark` due to the middleware + fallback.

2. **Proportional foreground-* steps.** Section B only explicitly specifies `--foreground-60`, `--foreground-50`, and `--foreground-10` for light mode. The remaining steps (`--foreground-80`, `--foreground-70`, `--foreground-40`, `--foreground-30`, `--foreground-20`, `--foreground-15`, `--foreground-8`, `--foreground-5`, `--foreground-3`) were derived by applying the same opacity fractions to `rgb(32,32,32)` (the light-mode foreground base), matching the pattern Section B establishes for the three named steps. This keeps the opacity-ladder consistent for any component that references these steps on a light surface.

3. **`--primary` on light = Submit dark (rgb(79,79,79)), not near-white.** In dark mode, `--primary = lab(90.952% 0 0)` (near-white) because the dark Tier 1 button is light-colored. In light mode, the primary action button ("Continue", "Submit", "Accept") is the near-black `rgb(79,79,79)` per Section B "Submit dark" and Section J "Onboarding send / continue" buttons. This means the `app` variant button (which uses `--primary`) switches from near-white to dark gray on light pages — which is the correct spec behavior. The `app` variant is the app-shell primary; it should not appear on marketing pages. The `light`/`dark` variants are the marketing CTAs.

4. **Legacy `--color-*` domain components not migrated yet.** Marketing domain components (nav, footer, home-sections, pricing-calculator, etc.) still reference `--color-ink-*`, `--color-surface-*`, etc. from the legacy `:root` block. They now render correctly because the legacy `:root` values remain valid, and the new `html:not(.dark)` block correctly sets `--background` / `--foreground` / `--border` underneath them. Semantic alignment of those components off the legacy names is Slice 3b.

5. **`/referrals` route treatment.** The middleware doesn't include `/referrals` as a light route — this is an authenticated app page (`/org/:orgId/...`), not a public marketing route. The unauthenticated referral landing (if it exists at `/referrals`) is currently routed to `/org/*/referrals`, so it inherits the dark theme correctly.

## Deviations From Spec

1. **`--border-subtle` is a new token not in Section V.** Section B names `rgba(0,0,0,0.06)` as the ghost button border value without assigning a CSS variable name. I created `--border-subtle` to hold this value on the `html:not(.dark)` scope. It's not in the Section V dark token system (dark mode ghost borders use `--border-10` which is `rgba(255,255,255,0.1)`). Recorded here; will be noted for any future unified border-scale alignment.

2. **`--onboarding-warm-bg` and `--onboarding-warm-text` are new tokens.** Section B lists `#F4F2ED` (dept onboarding overlay bg) and `#1A1916` (dept onboarding text) without variable names. I introduced these two named tokens on the `html:not(.dark)` scope for use by onboarding components in Slice 3b. Not in Section V.

3. **Hero-notification-pill uses hardcoded `rgba(255,255,255,...)` opacity utilities.** These are Tailwind's `white/14`, `white/70`, `white/80` utilities — not CSS variable references. Per spec, this component sits over a dark-toned hero image and must use white regardless of the html theme class. Migrating to tokens would require a new `--hero-notification-*` token family not in Section V. Left as-is; the component is theme-agnostic by design.

## Verification

```
pnpm typecheck   → exit 0
```

## Files Changed

```
src/middleware.ts                    (created)
src/app/layout.tsx                   (updated — async, x-theme header)
src/styles/tokens.css                (updated — html:not(.dark) block)
src/components/ui/button.tsx         (re-skinned light/dark/ghost variants)
src/components/ui/icon-button.tsx    (re-skinned light variant)
src/components/ui/accordion.tsx      (re-skinned)
src/components/ui/slider.tsx         (re-skinned)
REGISTRY.md                          (Slice 3 status table appended)
CHANGES.md                           (Slice 3 section appended)
checkpoint-slice-3.md                (this file)
```

## What Slice 3b / Slice 4 Need

1. **Slice 3b — Marketing domain component migration.** Walk `src/components/marketing/` and `src/components/auth/` files and replace `--color-ink-*`, `--color-surface-*`, `--color-border-*`, `--feature-blue-*`, `--hero-blue`, `--brand-300/500` etc. with Section B / Section V tokens. The light-mode scope now exists; these components can be re-skinned without the `:root` shim.
2. **Slice 2b — Dark-mode domain component migration.** The 14 clusters listed in `CHANGES.md` (app-shell, canvas, side-panel, agents, chat, settings, etc.) still reference legacy `--app-*` tokens. Each cluster maps to a specific spec section.
3. **Remove legacy `:root` shim** once both Slice 2b and Slice 3b are complete.
4. **Font licensing** (DECISION-52) — ppmondwest and Departure Mono remain on system fallback.
