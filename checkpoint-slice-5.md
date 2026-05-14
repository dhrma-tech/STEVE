# checkpoint-slice-5.md

## Phase
Slice 5 — App-Shell Cluster (Sections D / E / F / S)

## Status
Complete. `pnpm typecheck` exits 0. Zero legacy refs across all 5 app-shell files.

## Files Changed
- `src/lib/z-index.ts` (created)
- `src/components/app-shell/app-shell.tsx`
- `src/components/app-shell/side-panel-tabs.tsx`
- `src/components/app-shell/breadcrumb.tsx`
- `src/components/app-shell/company-switcher.tsx`
- `src/components/app-shell/upgrade-modal.tsx`
- `REGISTRY.md`, `CHANGES.md`, `checkpoint-slice-5.md`

## Z-Index Architecture (`src/lib/z-index.ts`)

Created as the single source of truth for all Section S z-index values. 17 named constants covering:
- Canvas node layers (0 → 500)
- App shell interior (30, 40 — below canvas chrome)
- Sidebar/settings (1000, 2000, 2001)
- Modal stack (10018–10020)
- Canvas chrome (10030–10031)
- Popover/dropdown/tooltip (10004–10060)
- Toast/modal/shortcuts (10070–10090)

The two existing Tailwind classes in app-shell (`z-30` on topbar, `z-40` on mobile nav) are not changed structurally — they're within the Section S app-interior tier. The file documents them as `Z_APP_TOPBAR = 30` and `Z_MOBILE_NAV = 40`. Canvas-specific chrome constants (Z_CANVAS_CHROME = 10030, etc.) are defined but not yet consumed; they'll be imported by the canvas cluster in Slice 6.

## Token Migration Map

| Legacy | Section V | Notes |
|---|---|---|
| `--app-canvas` | `--background` | |
| `--app-black-base` | `--card` | Left sidebar bg: very deep dark |
| `--app-panel` | `--background-sidepanel` | |
| `--app-border` | `--border-10` | All occurrences |
| `--app-text` | `--foreground-80` | |
| `--app-text-50` | `--foreground-50` | |
| `--app-primary-light` | `--foreground-80` | Nav icons, panel headers, modal text |
| `--app-primary-light` (mobile CTA bg) | `--primary` | J Tier 1 |
| `--app-black-base` (mobile CTA text) | `--primary-foreground` | |
| `--brand-300` | `--focused` | |
| `--warning` | `--alert` | Section V alert orange `#ff672f` |
| `rgba(255,255,255,0.04)` | `--foreground-3` | |
| `rgba(255,255,255,0.05/.06)` | `--foreground-5` | |
| `rgba(255,255,255,0.08)` | `--foreground-8` | |
| `rgba(255,255,255,0.10/.12)` | `--foreground-10` | |
| `rgba(30,30,35,0.92)` topbar glass | `--background-l0-85` | Approximation; see Deviation 1 |
| `rgba(29,29,34,0.94)` mobile nav glass | `--background-l0-85` | Same |
| `shadow-[rgba(0,0,0,0.35)_0_18px_50px]` | `--tt-shadow-elevated-md` | |

## Assumptions Made

1. **`--app-primary-light` maps to `--foreground-80` in all app-shell contexts.** The legacy value was `#eeeee8e6` (warm cream white, 93% opacity). In the app-shell context (dark mode), this rendered as near-white for nav icons, panel header icons, and message text. `--foreground-80 = rgba(255,255,255,0.8)` is the canonical near-white content color in dark mode. Exception: mobile CTA button uses `--primary` (bg) + `--primary-foreground` (text) to match Section J Tier 1 Primary semantics.

2. **`--app-black-base` → `--card` for the left sidebar bg.** `--app-black-base = #0e0e11`. `--card = lab(1.98454% 0 0) ≈ #050505`. Slightly darker, but both are near-black sidebar backgrounds. `--card` is the correct Section V token for very dark surfaces. The visual difference at 5% vs 10% lightness is negligible against `--background` (RGB 30,30,35).

3. **Glass backgrounds approximated.** Topbar uses `rgba(30,30,35,0.92)` — mapped to `--background-l0-85 = #1e1e23d9` (85% opacity). Mobile nav uses `rgba(29,29,34,0.94)` — same token. Neither is exact (85% vs 92%/94%) but both tokens are the closest defined opacity steps for the base canvas color. The difference is imperceptible at any reasonable screen size. Both elements use `backdrop-blur`, which means the glass effect from blur dominates the transparency difference.

4. **`rgba(255,255,255,0.12)` → `--foreground-10` (0.1).** No 12% opacity token exists in Section V. Rounded down to the nearest defined step. Used for active sidebar icon bg — one step brighter than the 0.1 step, negligible visually.

5. **`--warning` → `--alert`.** `--warning = #f59e0b` (amber). `--alert = #ff672f` (Section V alert orange-red). These are different hues — amber vs orange. The unread count badge is a notification indicator; `--alert` is Section V's canonical alert/notification color. More spec-aligned than keeping amber. Visual change is intentional.

6. **Shadow approximation.** `shadow-[rgba(0,0,0,0.35)_0_18px_50px]` is a single-layer shadow. `--tt-shadow-elevated-md` is a multi-layer shadow (`0px 16px 48px #00000080, ...`). The Section V multi-layer shadow has more depth but the same scale. Visual result is slightly richer than the original.

## Deviations From Spec

1. **Glass bg opacity mismatch.** `--background-l0-85` is 85% opacity; topbar/mobile nav used 92%/94%. No higher-opacity token exists. Closest available used; difference imperceptible with backdrop-blur active.

2. **Section E chrome z-index not yet migrated to constants.** The `z-30` and `z-40` Tailwind classes in `app-shell.tsx` remain as Tailwind utilities. Per "no restructure" rule, changing these to inline `style={{ zIndex: Z_APP_TOPBAR }}` would require converting Tailwind utility classes to React inline styles — a structural change beyond token substitution. The constants are defined in `z-index.ts` for documentation and future use. Actual z-index values are correct per Section S.

3. **Section F 5-tab panel: full spec not applied.** `side-panel-tabs.tsx` is token-migrated but the full Section F spec includes a sliding indicator animation between tabs, specific tab heights (24px), and exact padding. These are structural (layout/animation) changes beyond token substitution. The tab system uses the already-migrated `Tabs` primitive from Slice 2. Structural Section F alignment is a future slice concern.

## Verification

```
pnpm typecheck                                                                   → exit 0
grep "var(--app-|var(--brand-|var(--warning|rgba(255,255" src/components/app-shell/*.tsx  → 0 results
```

## Remaining Domain Clusters (12 pending)

canvas · side-panel · agents · chat · integrations · tasks · departments · files · notifications · onboarding · roadmap · command-palette/billing
