# checkpoint-slice-6b.md

## Phase
Slice 6b — Canvas Animations (Section L)

## Status
Complete. `pnpm typecheck` exits 0. All Section L keyframes registered. `canvasDashFlow` wired to orbital edges. Structural animation wiring (pixel particles, agent cue) deferred to domain cluster slices.

## Files Changed
- `src/styles/animations.css` (created — 36 Section L keyframes + utility classes)
- `src/styles/globals.css` (updated — `@import "./animations.css"` added)
- `src/components/canvas/canvas-workspace.tsx` (updated — `canvasDashFlow` wired to orbital edge style)
- `REGISTRY.md`, `CHANGES.md`, `checkpoint-slice-6b.md`

## Section L Keyframe Coverage

### Already in motion.css — not re-implemented

| Keyframe | motion.css name | Section L ref |
|---|---|---|
| Node idle breath | `node-breath` | Section L "node-breath" |
| Node selection pop | `node-select-pop` | Section L "node-select-pop" |
| Agent glow pulse | `agent-pulse` | Section L "pulseGlow" equivalent |
| Loading shimmer | `shimmer` | Section L "shimmer" |
| Modal entrance/exit | `modal-enter`, `modal-exit` | Section L "t-modal-open", "t-modal-close" |
| Task row entrance | `task-row-in` | Section L "newTaskAppear" equivalent |
| Dropdown slide | `notif-pop`, `notif-pop-exit` | Section L popover animations |
| Panel slide | `panel-slide-in` | Section L "taskRouteHintEnter" equivalent |
| Tab content fade | `tab-content-fade` | Section L "sd-slideUp" equivalent |

### New in animations.css — 36 keyframes

**UI State (6):** `fade-in`, `sd-fadeIn`, `sd-blurIn`, `sd-slideUp`, `enter`, `exit`

**Looping/Ambient (7):** `pulse`, `pulse-building`, `thin-pulse`, `pulse-dot`, `status-dot-breathe`, `blink`, `text-blink`

**Chat/Loading (7):** `typing-indicator-blink`, `typing`, `loading-dots`, `bounce-dots`, `wave-bars`, `text-shimmer-sweep`, `spinner-fade`

**Canvas-specific (13):** `canvasDashFlow`, `department-workspace-pixel-drift`, `department-workspace-pixel-ambient-wave`, `agent-canvas-cue-pop`, `attentionUpdateSlideUp`, `attentionInboxItemAppear`, `newTaskAppear`, `taskRouteHintEnter`, `taskRouteHintIconPop`, `reviewLauncherFreshBadge`, `reviewLensSettle`, `canvasActivityNoteIn`, `cofounder-cli-bloom`

**Marketing asset (3):** `MarketingAssetLoadingAnimation__marketing-asset-field/scan/dot-breathe`

### Animation tokens used

All utility class durations reference Section V tokens:
- `var(--tt-transition-duration-short)` = 0.1s — micro interactions
- `var(--tt-transition-duration-default)` = 0.2s — standard transitions
- `var(--tt-transition-easing-default)` = `cubic-bezier(0.46, 0.03, 0.52, 0.96)` — neutral
- `var(--tt-transition-easing-cubic)` = `cubic-bezier(0.65, 0.05, 0.36, 1)` — slide/fade
- `cubic-bezier(0.22, 1, 0.36, 1)` — Section L "login book pop" / ultra-smooth ease-out (used for pop animations; not a named token in Section V, used as literal per spec)

### `canvasDashFlow` wiring

The only canvas animation wired in Slice 6b without structural changes. Added to the base orbital edge `style` object in `buildEdges()`:
```js
animation: "canvasDashFlow 20s linear infinite"
```
ReactFlow forwards `style` as a CSS style attribute on the SVG `<path>` element. `stroke-dashoffset` animates continuously, creating the Section L "moving-ants" effect on the dashed orbital ring.

## Assumptions Made

1. **`canvasDashFlow` keyframe derived from spec description.** Section L describes it as "Animated dashed orbital ring stroke offset / Creates the moving-ants effect" but provides no percentages. Standard moving-ants implementation: `to { stroke-dashoffset: -100; }` — single percentage, `stroke-dashoffset` decreasing continuously while `stroke-dasharray: "8 10"` is set on the edge. Duration 20s creates a slow ambient orbit. The `-100` value means the pattern travels the equivalent of 100 units in one loop; with dasharray of 18 units per cycle this gives ~5.5 visible cycles. Spec-aligned behaviorally.

2. **`department-workspace-pixel-drift` 5-waypoint implementation.** Section L says "continues through 5 waypoints" and gives the 0% and 22% frames exactly. Waypoints 45%, 68%, 87% are derived to create a realistic organic drift using the same CSS custom properties (`--department-pixel-start-x/y`, `--department-pixel-dim/bright-opacity`) that the spec declares. The interpolation between waypoints follows standard ease-in-out behavior.

3. **`status-dot-breathe` inferred.** Section L describes "gentle opacity + scale breathe cycle — applied to dept status indicator dots" but gives no percentages. Implemented as `0%,100% { opacity: 0.6; scale: 1 } 50% { opacity: 1; scale: 1.2 }` — consistent with the `pulse-dot` pattern but at lower intensity, appropriate for subtle "breathing."

4. **Several canvas animations inferred from descriptions.** `agent-canvas-cue-pop`, `taskRouteHintEnter/IconPop`, `reviewLauncherFreshBadge/LensSettle`, `canvasActivityNoteIn`, `cofounder-cli-bloom` — all given descriptive names and effects in Section L but no exact percentages. Implemented using standard web animation patterns (pop = scale from 0.6 → 1.15 → 1, settle = overshoot → undershoot → 1, slide = translateY/X). These are design-implementation decisions consistent with the spec's described intent.

5. **Marketing asset animations inferred.** Section L names three `MarketingAssetLoadingAnimation__*` keyframes with descriptions (scan-line, horizontal sweep, dot breathe) but no code. Implemented from description.

6. **`enter`/`exit` keyframes follow Tailwind animate conventions.** They use `--tw-enter-*` and `--tw-exit-*` CSS custom properties which Tailwind animate plugin would provide. Included per Section L spec listing; they'll be inert unless the corresponding custom properties are set.

## Deviations From Spec

1. **Pixel drift and pixel ambient wave — keyframes defined, wiring deferred.** Wiring these requires adding pixel particle `<div>` children to dept workspace home nodes. No `departmentWorkspaceHomeNode` React component currently exists in the canvas cluster (the `WorkspacePreviewCard` is a simplified equivalent). Adding pixel children would be structural. Deferred to departments cluster (Slice 7+) when the dept-home node surface is expanded.

2. **`pulseGlow` — covered by existing `agent-pulse` in motion.css.** Rather than duplicate, `agent-pulse` (`0%,100% { box-shadow: 0 0 0 0 rgba(134,239,172,0.55) } 50% { box-shadow: 0 0 0 6px rgba(134,239,172,0) }`) serves as the implementation. Wiring to active agent nodes belongs in agents cluster (Slice 7+).

3. **`cofounder-cli-bloom` — no target component.** The CLI surface it animates is not part of the current canvas build. Keyframe registered; wiring deferred until CLI component exists.

## Verification

```
pnpm typecheck   → exit 0
```

## Canvas Cluster Complete (Slices 6a + 6b)

- 4 canvas components: tokens migrated ✓
- Section D canvas bg: `--background` ✓
- Section D no grid dots: `<Background color="transparent">` ✓
- Section H node styling: `--shadow-dept-agent-node-dark`, `--background-l0-85`, `--primary` icon badge ✓
- Section L `canvasDashFlow`: wired to orbital edges ✓
- Section L `node-breath`: already wired to CofounderNode ✓
- Section L `node-select-pop`: already wired to DepartmentNode ✓
- All 36 new Section L keyframes: registered in animations.css ✓
- All animation utility classes: available for downstream clusters ✓

## Remaining Domain Clusters (11 pending)

side-panel · agents · chat · integrations · tasks · departments · files · notifications · onboarding · roadmap · command-palette/billing
