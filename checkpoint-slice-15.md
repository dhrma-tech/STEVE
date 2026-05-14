# checkpoint-slice-15.md

## Phase
Slice 15 — Roadmap Cluster (Section M / K / F / L)

## Status
Complete. `pnpm typecheck` exits 0. Zero legacy refs across all 4 roadmap files.

## Files Changed
- `src/components/roadmap/roadmap-card.tsx` (11 passes)
- `src/components/roadmap/roadmap-stage-board.tsx` (7 passes)
- `src/components/roadmap/roadmap-modal.tsx` (9 passes)
- `src/components/roadmap/roadmap-detail-panel.tsx` (13 passes)
- `REGISTRY.md`, `CHANGES.md`, `checkpoint-slice-15.md`

## Token Migration Map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | Stage/card/dep/panel borders (all 4 files) |
| `--app-text` | `--foreground-80` | Primary text, ghost button text |
| `--app-text-50` | `--foreground-50` | Labels, stage eyebrows, metadata |
| `--app-black-base` | `--card` | Stage timeline connector node bg |
| `--app-primary-light` (icon) | `--foreground-80` | Workflow icon (modal), GitBranch (detail) |
| `--app-primary-light` (selected border) | `--primary` | RoadmapCard selected state border |
| `--brand-300` | `--focused` | Card focus ring + available iconClass text |
| `--warning` | `--alert` | Empty stage AlertCircle icon |
| `rgba(255,255,255,0.025/.035)` | `var(--foreground-3)` | Stage column bg, empty col bg |
| `rgba(255,255,255,0.04)` | `var(--foreground-3)` | Graph entry bg, dep matrix button bg |
| `rgba(255,255,255,0.045)` | `var(--foreground-5)` | Detail panel bg (≈0.05) |
| `rgba(255,255,255,0.055)` | `var(--foreground-5)` | Card resting bg (≈0.06) |
| `rgba(255,255,255,0.06)` | `var(--foreground-5)` | Icon badge bg, ghost hover |
| `rgba(255,255,255,0.07)` | `var(--foreground-8)` | Dep matrix button hover (≈0.08) |
| `rgba(255,255,255,0.08)` | `var(--foreground-8)` | Card hover bg |
| `rgba(255,255,255,0.10)` | `var(--border-10)` | Locked card border (exact = `--border-10`) |
| `rgba(255,255,255,0.11)` | `var(--foreground-10)` | Selected card bg (≈0.10) |
| `rgba(0,0,0,0.12)` | `var(--foreground-inverse-10)` | All inner dark detail panels |
| `rgba(245,158,11,0.12)` | `var(--tt-color-text-yellow-contrast)` | Empty stage icon badge bg |
| `rgba(239,68,68,0.35/.08)` | `var(--tt-color-text-red-contrast)` | Error block border+bg |
| `text-red-100` | `text-[var(--destructive)]` | Error block text |
| `rgba(52,168,83,0.35/.1)` | `var(--tt-color-text-green-contrast)` | Success msg border+bg |
| `#bdf8c9` / `#9df0b4` | `var(--tt-color-text-green-contrast)` | Success msg text / complete icon text |

## Animation Wiring (Section L)

- **`animate-sd-slide-up` → `RoadmapCard`** — added to base className. Cards slide up 4px (`translateY(4px) → 0`) at 120ms ease-out on mount (Section L `sd-slideUp` keyframe, utility class from Slice 6b `animations.css`).
- **`animate-sd-slide-up` → `RoadmapDetailPanel` `<aside>`** — added to `<aside>` className. The component is `key={selectedItem?.id ?? "empty-roadmap-detail"}` in `roadmap-modal.tsx`, so it remounts on each item selection and the animation fires fresh. Detail panel slides up on selection.

## Tokens Kept as Literals

Design-specific card status colors — no Section V equivalents:
- `rgba(52,168,83,0.58)` — complete card border (green)
- `rgba(52,168,83,0.45)` / `rgba(52,168,83,0.15)` — complete icon badge border+bg
- `rgba(157,138,255,0.62)` / `shadow-[rgba(157,138,255,0.12)...]` — available card border+shadow (brand purple)
- `rgba(157,138,255,0.42)` / `rgba(157,138,255,0.15)` — available icon badge border+bg
- `rgba(255,255,255,0.12)` in `shadow-[rgba(255,255,255,0.12)_0_0_0_1px]` — selected card ring shadow
- `rgba(255,255,255,0.16)` — stage timeline vertical connector (between 0.10 and 0.20, no exact token)

## Assumptions Made

1. **`rgba(255,255,255,0.055)` → `--foreground-5` (≈0.06).** Card resting bg non-standard at 5.5%. Nearest token is 5% or 6% — both map to `--foreground-5`. Rounding is imperceptible.

2. **`rgba(255,255,255,0.045)` → `--foreground-5` (≈0.05).** Detail panel bg. Same logic: `--foreground-5` is the correct tier.

3. **`rgba(255,255,255,0.035)` → `--foreground-3` (≈0.04).** Stage column bg. Below 5% threshold → `--foreground-3`.

4. **`rgba(255,255,255,0.10)` → `--border-10` (exact).** The locked card border value exactly equals `--border-10 = rgba(255,255,255,0.1)`. A direct exact-value token match.

5. **Design-specific rgba kept as literals.** The green/purple card status rgba values are intentional per-card color choices that convey status semantics not captured by Section V surface tokens. Keeping them preserves the roadmap's visual status language.

## Deviations From Spec

1. **`rgba(255,255,255,0.07)` → `--foreground-8` (0.08).** Dependency matrix button hover non-standard at 7%. Same rounding precedent as tasks cluster.

2. **`rgba(255,255,255,0.11)` → `--foreground-10` (0.10).** Selected card bg non-standard at 11%. Nearest token rounds down to 10%.

## Verification

```
pnpm typecheck                                                            → exit 0
grep var(--app-|var(--brand-|var(--warning) across roadmap/              → 0 results
```

## Remaining Domain Clusters (2 pending)

files · departments
