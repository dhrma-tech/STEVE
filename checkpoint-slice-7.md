# checkpoint-slice-7.md

## Phase
Slice 7 — Agents Cluster (Sections H / I / J / L)

## Status
Complete. `pnpm typecheck` exits 0. Zero legacy `--app-*` / `--brand-*` / hardcoded `rgba()` refs across all 5 agents files.

## Files Changed
- `src/components/agents/agent-cards.tsx`
- `src/components/agents/agent-config-panel.tsx`
- `src/components/agents/agent-control-center.tsx`
- `src/components/agents/agent-create-dialog.tsx`
- `src/components/agents/agent-workspace-dialog.tsx`
- `src/styles/animations.css` (`.animate-agent-pulse` utility added)
- `REGISTRY.md`, `CHANGES.md`, `checkpoint-slice-7.md`

## Token Migration Map

| Legacy | Section V | Notes |
|---|---|---|
| `--app-border` | `--border-10` | |
| `--app-text` | `--foreground-80` | |
| `--app-text-50` | `--foreground-50` | |
| `--app-primary-light` (icons) | `--foreground-80` | Section H near-white icon tint |
| `--app-primary-light` (selected borders) | `--primary` | J Tier 1 accent border |
| `--app-primary-light` (link text) | `--tt-color-text-blue` | Section I blue link style |
| `--brand-300` | `--focused` | |
| `rgba(255,255,255,0.04)` | `--foreground-3` | Panel bgs |
| `rgba(255,255,255,0.06)` | `--foreground-5` | Ghost hover |
| `rgba(255,255,255,0.07/.08)` | `--foreground-8` | Card hover/selected bgs |
| `rgba(255,255,255,0.09)` | `--foreground-8` | Skill selected (rounded to 0.08) |
| `rgba(0,0,0,0.12)` | `--foreground-inverse-10` | Dark inner panels |
| `rgba(239,68,68,0.36/.12)` | `--tt-color-text-red-contrast` | Destructive error box |
| `text-red-100` | `text-[var(--destructive)]` | |
| `bg-[#111216]` | `--background-l-negative-50-100` | Browser frame deep dark |
| `bg-black/35` | `--foreground-inverse-30` | Code block bg |

## Animation Wiring

### `.animate-agent-pulse` (agent-cards.tsx)
- Added utility class to `animations.css`: `animation: agent-pulse 2.4s ease infinite`
- Wired to running agent card `<article>` via conditional class: `agent.status === "running" ? "animate-agent-pulse" : ""`
- Effect: box-shadow ring pulses on running agents (Section L `pulseGlow`)

### `.animate-agent-cue-pop` (agent-workspace-dialog.tsx)
- Wired to the workspace content grid `<div>` that mounts when `!loading && session` is true
- Effect: workspace area pops in with scale+opacity on session load (Section L `agent-canvas-cue-pop`)
- No new DOM nodes added — applied to existing `<div className="grid min-h-[680px]...">` element

## Assumptions Made

1. **`--app-primary-light` maps to three different tokens.** In agent context: (a) icon color → `--foreground-80` (near-white tint); (b) selected card/skill border → `--primary` (J Tier 1 prominent accent); (c) hyperlink text in `linkify()` → `--tt-color-text-blue` (Section I external link blue). The context determines which semantic token is correct.

2. **`rgba(0,0,0,0.12)` → `--foreground-inverse-10`.** The inverse token group uses `rgba(0,0,0,0.1)` = `--foreground-inverse-10 = #0000001a`. At 0.12 this rounds down to 0.1. The dark overlay panels (action log rows, session buttons, task items) use this for subtle depth separation against the component background. Visually imperceptible difference.

3. **`rgba(255,255,255,0.09)` → `--foreground-8` (0.08).** Selected skill card bg in agent-create used 0.09 — rounded to the nearest Section V token at 0.08. One step below the 0.10 level.

4. **`#111216` browser frame → `--background-l-negative-50-100`.** `#111216` = (17,18,22) RGB; `--background-l-negative-50-100 = #1d1d22` = (29,29,34) RGB. Slightly different base but both are "very deep dark" surfaces. The browser frame renders white web content inside an iframe, so the frame border color is barely visible against the surrounding dark dialog. Semantic correctness over exact value match.

5. **`bg-black/35` code block → `--foreground-inverse-30`.** `bg-black/35` = `rgba(0,0,0,0.35)`. `--foreground-inverse-30 = #0000004d` = `rgba(0,0,0,0.3)`. Slightly less opaque but same visual intent (dark tinted code block bg within a light-enough message text area).

## Deviations From Spec

1. **Section H agent workspace node structure not fully aligned.** Section H describes a complex node structure with "notch blob" (dark pill header containing dept icon + agent name + task selector + "New Task" btn), inner tabs (Agent Workspace / Scratchpad), workspace area with approvals/outputs. The existing `agent-workspace-dialog.tsx` implements this as a full-screen Dialog (not a canvas node). The Dialog has equivalent information layout (tab bar with Browser/Scratchpad/Replay, action log, task chat, etc.) but uses a different structural approach. Per "no structural refactoring," the Dialog structure is preserved and only tokens are migrated. The Section H notch blob pattern is noted for future Slice 8+ work when canvas nodes are expanded.

2. **`--foreground-inverse-10` vs exact `rgba(0,0,0,0.12)`.** 0.10 vs 0.12 — documented above.

## Verification

```
pnpm typecheck                                                                     → exit 0
grep "var(--app-|var(--brand-|rgba(239|rgba(255,255|rgba(0,0,0,0.12)" agents/*.tsx → 0 results
```

## Remaining Domain Clusters (10 pending)

side-panel · chat · integrations · tasks · departments · files · notifications · onboarding · roadmap · command-palette/billing
