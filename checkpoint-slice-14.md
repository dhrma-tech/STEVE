# checkpoint-slice-14.md

## Phase
Slice 14 — Onboarding Cluster (Section A / M Pages 2–7 / Q / B)

## Status
Complete. `pnpm typecheck` exits 0. Zero legacy refs across all 5 onboarding files.
Light-mode system integration complete (Slices 3 + 14 = full public/pre-auth flow aligned).

## Files Changed
- `src/components/onboarding/company-onboarding-workspace.tsx` (9 passes, dark)
- `src/components/onboarding/design-onboarding-wizard.tsx` (3 passes, dark)
- `src/components/onboarding/personal-onboarding-wizard.tsx` (1 pass, light)
- `src/components/onboarding/option-card.tsx` (5 passes, both surfaces)
- `src/components/onboarding/stepper.tsx` (3 passes, light)
- `REGISTRY.md`, `CHANGES.md`, `checkpoint-slice-14.md`

## Surface Routing

| File | Route | Theme class | Token system |
|---|---|---|---|
| `company-onboarding-workspace.tsx` | `/org/[orgId]/onboarding` | `html.dark` | Section V dark |
| `design-onboarding-wizard.tsx` | embedded in company-workspace | `html.dark` | Section V dark |
| `personal-onboarding-wizard.tsx` | `/onboarding` | `html:not(.dark)` | Section B light |
| `option-card.tsx` | both routes | both | dual-mode via cascade |
| `stepper.tsx` | `/onboarding` | `html:not(.dark)` | Section B light |

## Token Migration Map

| Legacy | Section V | Context |
|---|---|---|
| `--app-canvas` | `--background` | company-workspace main + section bg |
| `--app-text` | `--foreground-80` | AccordionTrigger, answer question text |
| `--app-text-50` | `--foreground-50` | Labels, descriptions, accordion content, eyebrows |
| `--app-border` | `--border-10` | Section/card/answer/example borders |
| `--app-black-base` | `--card` | Cofounder center node bg |
| `--brand-300` | `--focused` | Focus rings (option-card, design-wizard) |
| `--brand-500` | `--tt-brand-color-500` | Stepper active, option-card selected border + badge, icon badge |
| `rgba(255,255,255,0.04)` | `var(--foreground-3)` | ActionLog section bg |
| `rgba(38,38,42,0.92)` | `var(--background-l0-85)` | Department orbit pill glass bg (DECISION-57 approximation) |
| `--color-ink-faint` | `--foreground-50` | Personal wizard eyebrow label |
| `--color-ink-muted` | `--foreground-50` | OptionCard description, Stepper inactive step label |
| `--color-border-card` | `--border-10` | OptionCard unselected border |
| `--color-surface-raised` | `--background-l0` | OptionCard unselected bg (light: `rgb(251,251,248)`) |
| `--color-border-pill` | `--border-10` | Stepper step indicator border (inactive) |

## Tokens Intentionally Kept as Literals

| Value | Location | Reason |
|---|---|---|
| `rgba(98,41,255,0.08)` | option-card selected bg | Brand purple tint — no Section V token for brand at arbitrary opacity |
| `rgba(98,41,255,0.18)` | company-workspace radial gradient | Design-specific canvas preview glow — gradient value, not a surface token |
| `rgba(30,30,35,0)` | company-workspace radial gradient | Transparent endpoint — no token needed |
| `--success` | stepper complete state | Already Section V token |
| `--foreground` | stepper active label | Already Section V token |

## Assumptions Made

1. **`rgba(38,38,42,0.92)` → `--background-l0-85`.** Per DECISION-57: glass bgs at 0.72–0.92 opacity use `--background-l0-85` as the nearest Section V token. Department orbit pills in the canvas preview have no backdrop-blur, so the approximation is slight (0.85 vs 0.92) but acceptable — same precedent as topbar/mobile nav in Slice 5.

2. **`--color-surface-raised` → `--background-l0`.** Section B light `--background-l0 = rgb(251,251,248)` is the spec value for slightly-raised card surfaces on the cream background. The unselected `OptionCard` bg should be marginally lighter than the page background (`rgb(241,241,238)`) — `--background-l0` is the correct token for this.

3. **`--color-ink-faint` and `--color-ink-muted` → `--foreground-50`.** Both are muted/secondary text tiers in the light-mode hierarchy. `--foreground-50` resolves under `html:not(.dark)` to the Section B muted text value. Same token handles both — the distinction (faint vs muted) is not captured separately in Section V.

4. **`option-card.tsx` dual-mode correctness.** The migrated tokens (`--focused`, `--tt-brand-color-500`, `--border-10`, `--background-l0`, `--foreground-50`) all have both `html.dark` and `html:not(.dark)` definitions in `tokens.css`. The card renders correctly in both contexts.

## Deviations From Spec

1. **`rgba(98,41,255,0.08)` selected bg kept literal.** No Section V token for brand-color at 8% opacity. Brand purple tint is design-specific; no approximation token available. Documented in assumptions.

## Verification

```
pnpm typecheck                                                            → exit 0
grep var(--app-|var(--brand-|var(--color- across onboarding/             → 0 results
```

## Remaining Domain Clusters (3 pending)

roadmap · files · departments
