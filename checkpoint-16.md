# Checkpoint 16: Phase 15 - Animations And Motion

## Objective
Implement entrance staggers, micro-interactions, skeleton shimmers, canvas transitions, modal polish, and reduced-motion accessibility across all application surfaces.

## New Primitives Created

### `src/components/motion/spring-button.tsx`
- `SpringButton` — spring-physics hover/press wrapper (`whileHover` + `whileTap`) for interactive cards and primary CTAs.
- `PanelSlide` — directional slide-in (right/left/bottom) with configurable distance for panels and drawers.
- `ScaleFade` — scale + opacity entrance/exit for modal content and tooltips.

### `src/components/motion/animated-list.tsx`
- `AnimatedList` — wrapper that staggers children using `AnimatePresence` + layout animation, so adding/removing items rearranges siblings smoothly.
- `AnimatedListItem` — individual item with layout animation and staggered `opacity`/`y` entrance.
- `AgentPulseDot` — pulsating status indicator (framer-motion scale+opacity loop) for running agents; renders a static dot in reduced-motion mode.

## Motion CSS Additions (`src/styles/motion.css`)
- `node-select-pop` — scale pop + outward box-shadow ring when a department node is selected on the canvas.
- `panel-slide-in` — side panel slides in from the right (280ms, custom ease).
- `tab-content-fade` — tab panel content fades up (240ms) when switching tabs.
- `agent-pulse` — CSS keyframe fallback for the AgentPulseDot pulse ring.
- `counter-up` — numeric value tick-up entrance.
- `node-breath` — idle drop-shadow breathing for the central Cofounder node.
- `modal-enter` / `modal-exit` — scale+translateY entrance/exit for dialogs, replacing the cruder notif-pop.
- Utility classes: `.animate-node-select-pop`, `.animate-panel-slide-in`, `.animate-tab-content-fade`, `.animate-node-breath`, `.animate-modal-enter`.

## Component Wiring

### Lists (entrance stagger)
- `TaskList` (`task-cards.tsx`) — wrapped in `Stagger` + `StaggerItem` for vertical stagger entrance.
- `AgentList` (`agent-cards.tsx`) — already had `Stagger`; now also has `AgentPulseDot` beside the badge for running agents.
- `MarketplaceSkills` (`agent-cards.tsx`) — skill cards now enter with a tighter `staggerChildren: 0.05` stagger.

### Canvas Nodes
- `CofounderNode` — idle `animate-node-breath` drop-shadow.
- `DepartmentNode` — `animate-node-select-pop` class applied when `selected` is true; smoother `transition-[border-color,box-shadow]`.

### Side Panel + Tabs
- `CanvasSidePanel` aside — `animate-panel-slide-in` on every render/mount.
- All five `TabsContent` panels — `animate-tab-content-fade` for tab-switch feedback.

### Modals
- `DialogContent` — upgraded from `notif-pop` to `modal-enter` / `modal-exit` keyframes (scale+translateY, 260ms).

## Reduced-Motion
- All framer-motion primitives (`Stagger`, `StaggerItem`, `FadeIn`, `PageTransition`, `SpringButton`, `PanelSlide`, `ScaleFade`, `AnimatedList`, `AgentPulseDot`) check `useReducedMotion()` and disable nonessential motion.
- CSS `@media (prefers-reduced-motion: reduce)` block zeroes all animation durations globally.

## Verification
- [x] Production build passes (exit 0, TypeScript clean).
- [x] All 26 static pages generated.
- [x] No new layout-shift risk (all animations use `opacity` + `transform` only, never width/height/margin).
- [x] Reduced-motion: framer hooks + CSS media query both active.
- [x] Skeleton shimmer class unchanged (`motion-safe-shimmer` with `background-size: 200%`).

## Registry Updates
- `SpringButton`, `PanelSlide`, `ScaleFade` — NEW motion primitives.
- `AnimatedList`, `AnimatedListItem`, `AgentPulseDot` — NEW motion primitives.
- `CofounderNode` — idle breath animation.
- `DepartmentNode` — selection pop animation.
- `CanvasSidePanel` — panel slide-in + tab fade.
- `DialogContent` — upgraded modal enter/exit.
- `TaskList` — stagger entrance.
- `AgentList` / `MarketplaceSkills` — stagger + pulse dot.

## Next Steps
Proceed to **Phase 16: Error, Loading And Empty States**.
- Audit every async route for loading/error/empty state coverage.
- Standardize API error mapper.
- Ensure no blank screens or raw crashes remain.
- Write `checkpoint-17.md`.
