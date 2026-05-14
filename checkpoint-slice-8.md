# checkpoint-slice-8.md

## Phase
Slice 8 — Chat Cluster (Sections N / L / V)

## Status
Complete. `pnpm typecheck` exits 0. Zero legacy refs across all 4 chat files.

## Files Changed
- `src/components/chat/chat-composer.tsx`
- `src/components/chat/chat-thread-list.tsx`
- `src/components/chat/chat-workspace.tsx`
- `src/components/chat/message-renderer.tsx`
- `REGISTRY.md`, `CHANGES.md`, `checkpoint-slice-8.md`

## Token Migration Map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | All 4 files |
| `--app-text` | `--foreground-80` | All 4 files |
| `--app-text-50` | `--foreground-50` | All 4 files |
| `--app-primary-light` (icons/labels) | `--foreground-80` | Avatar badge, header icon, action label |
| `--app-primary-light` (selected border) | `--primary` | User message border, selected thread border |
| `--app-primary-light` (links) | `--tt-color-text-blue` | `linkify()` `<a>` elements |
| `--app-primary-light` (typing dots) | `--foreground-50` | Section N typing indicator dots |
| `--brand-300` | `--focused` | Mention pill focus rings |
| `rgba(255,255,255,0.04)` | `--foreground-3` | Panel bgs |
| `rgba(255,255,255,0.06)` | `--foreground-5` | Avatar badge bg, ghost hover |
| `rgba(255,255,255,0.08)` | `--foreground-8` | User msg + selected thread bg |
| `rgba(0,0,0,0.12)` | `--foreground-inverse-10` | Dark inner panels |
| `rgba(0,0,0,0.16)` | `--foreground-inverse-20` | Action log article bg |
| `bg-black/35` | `--foreground-inverse-30` | Code block bg |

## Section L Animation Wiring

`TypingIndicator` component in `message-renderer.tsx`:
- Replaced `animate-pulse` (generic Tailwind) with `animate-typing-dot` (Section L `typing-indicator-blink` keyframe from `animations.css`)
- Updated stagger delays from 120ms/240ms → **160ms/320ms** per Section L spec (0ms/160ms/320ms)
- Dot bg color: `--foreground-80` (after replace_all) → `--foreground-50` (Section N: "3 dots, opacity 0.25–1.0 cycling")

Effect: typing indicator now uses the spec-exact `typing-indicator-blink` animation — dots cycle `opacity: 0.25 → 1 → 0.25` with `transform: scale(0.9) → 1 → 0.9`, staggered 160ms apart.

## Assumptions Made

1. **`--app-primary-light` → three different tokens by context.** Same pattern as agents cluster: (a) icon/label tint → `--foreground-80`; (b) selected/user-message border → `--primary`; (c) hyperlinks → `--tt-color-text-blue`; (d) typing dots → `--foreground-50` (muted, cycles with animation).

2. **`rgba(0,0,0,0.16)` → `--foreground-inverse-20` (0.2 opacity).** The action log article uses a darker bg than regular panels (0.16 vs 0.12). `--foreground-inverse-20 = rgba(0,0,0,0.2)` is the closest Section V token above 0.16. Rounds up; action log remains visually distinct from regular panels.

3. **Typing dot color `--foreground-50`.** Section N describes dots as animated 0.25–1.0 opacity cycling via `typing-indicator-blink`. The base colour during the `opacity: 1` peak should be visible white; using `--foreground-50 = rgba(255,255,255,0.5)` as the base, the animation's opacity cycling takes it from ~12% (0.5 × 0.25) to 50% — a subtle but correct range for a typing indicator on a dark chat surface.

## Deviations From Spec

1. **`chat-workspace.tsx` had no `rgba(255,255,255,0.04)`.** Grep for that literal found no match in that file — the panel bgs there use `rgba(0,0,0,0.12)` instead. All occurrences resolved correctly.

2. **Section N chat input compound** (label chip, send button, attachment button per the full spec) describes a specific compound layout. The existing `ChatComposer` uses a `Textarea` + `FileUpload` + `Button` stack, which is structurally different from the spec's inline label-chip + compact send-button. Per "no structural changes," the existing layout is preserved and only tokens are migrated. Full Section N chat input alignment is a future structural slice.

## Verification

```
pnpm typecheck                                                              → exit 0
grep "var(--app-|var(--brand-|rgba(255,255|rgba(0,0,0|bg-black|animate-pulse\b" chat/*.tsx → 0 results
```

## Remaining Domain Clusters (9 pending)

integrations · tasks · departments · files · notifications · onboarding · roadmap · command-palette/billing · side-panel
