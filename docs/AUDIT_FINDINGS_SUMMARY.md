# Audit Findings — Phase 3 Polish (All 15 Complete)

## Tier 1 — Critical (blocked other improvements)

### 1. Settings StatusLine → toast ✅
- **Broken**: 6 settings forms used inline `<StatusLine>` grey text for success/error. No animation, no auto-dismiss, errors looked identical to successes.
- **Why**: Every settings save gave zero visual feedback.
- **Fix**: Replaced all `setMessage()` + `<StatusLine>` with `toast.success()` / `toast.error()` from sonner.
- **Files**: `src/components/settings/settings-sections.tsx`

### 2. Tab content fade keyframe ✅
- **Broken**: `animate-tab-content-fade` class applied to every `<TabsContent>` in the side panel but `@keyframes tab-content-fade` was never defined.
- **Why**: Tab switches were instant — felt unresponsive.
- **Fix**: Added `@keyframes tab-content-fade` (opacity 0→1, translateY 6px→0, 0.22s) to `animations.css`.
- **Files**: `src/styles/animations.css`

### 3. Skeleton shimmer animation ✅
- **Broken**: `motion-safe-shimmer` class used `background-size: 200%` + shimmer animation, but `--foreground-15` token was missing from `:root` light tokens causing gradient to collapse.
- **Why**: Skeletons looked like static grey blocks, not loading indicators.
- **Fix**: Added `--foreground-15: rgba(32,32,32,0.15)` to light `:root` token block.
- **Files**: `src/styles/tokens.css`

---

## Tier 2 — High Impact (core daily UX)

### 4. Wizard step fade transition ✅
- **Broken**: Onboarding wizard steps swapped content instantly with no animation.
- **Why**: Jarring context switch between question types (input → cards → slider).
- **Fix**: Wrapped step content in `<div key={step} className="animate-tab-content-fade">` — key forces remount, triggering animation.
- **Files**: `src/components/onboarding/personal-onboarding-wizard.tsx`

### 5. Department node hover lift ✅
- **Broken**: Nodes only changed border-color on hover. No elevation feedback.
- **Why**: Core canvas elements felt flat and non-interactive.
- **Fix**: Added `hover:scale-[1.02] hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)]` to node className.
- **Files**: `src/components/canvas/department-node.tsx`

### 6. Toast theme-aware dark mode ✅
- **Broken**: `<Toaster>` used sonner's default light theme. In dark mode toasts were jarring white cards.
- **Why**: Visual inconsistency broke immersion.
- **Fix**: Passed `theme={theme === "dark" ? "dark" : "light"}` prop using the SSR-resolved theme variable.
- **Files**: `src/app/layout.tsx`

### 7. Advisor chat auto-grow textarea ✅
- **Broken**: Textarea hardcoded `rows={2}`, non-responsive. Long messages required scrolling inside a 2-line box.
- **Why**: Daily friction in the primary AI chat interaction.
- **Fix**: `rows={1}` + `onChange` handler sets `height = scrollHeight` capped at 120px.
- **Files**: `src/components/ai/advisor-chat.tsx`

### 8. CanvasControls visual consistency ✅
- **Broken**: Overview/Dashboard/Departments used `<Button>` component (tall bordered pills) while the floating icon buttons used glass square style.
- **Why**: Two different design languages in the same viewport.
- **Fix**: Replaced Button usage with inline glass pill buttons matching the floating button style.
- **Files**: `src/components/canvas/canvas-workspace.tsx`

---

## Tier 3 — Polish Details

### 9. Stepper check-pop animation ✅
- **Broken**: Completed step checkmarks appeared instantly with no animation.
- **Fix**: Added `animate-check-pop` class (scale 0.5→1.15→1, 0.25s cubic) + defined `@keyframes check-pop` in animations.css.
- **Files**: `src/components/onboarding/stepper.tsx`, `src/styles/animations.css`

### 10. Questions page entrance animation ✅
- **Broken**: Wizard card appeared instantly on page load.
- **Fix**: Wrapped `<PersonalOnboardingWizard>` in `<div className="animate-fade-rise w-full">`.
- **Files**: `src/app/questions/page.tsx`

### 11. Nav drawer active-click flash ✅
- **Broken**: Nav links gave no physical click feedback.
- **Fix**: Added `active:bg-[var(--foreground-15)] active:scale-[0.98]` to nav link className.
- **Files**: `src/components/app-shell/app-shell.tsx`

### 12. Empty departments popover state ✅
- **Broken**: Departments popover showed blank `<div>` when no departments exist.
- **Fix**: Added `if (departments.length === 0)` empty message inside the popover.
- **Files**: `src/components/canvas/canvas-workspace.tsx`

### 13. LoadingState border in light mode ✅
- **Broken**: `border-[var(--color-border-card)]` nearly invisible on cream `#f5f5f2` background.
- **Fix**: Changed to `border-[var(--border-20)]` for light surface (2× opacity = visible).
- **Files**: `src/components/ui/loading-state.tsx`

### 14. Bottom controls mobile offset ✅
- **Broken**: Overview/Dashboard/Departments buttons at `bottom-5` overlapped the mobile floating nav bar.
- **Fix**: `bottom-20 lg:bottom-5` — clear of nav on mobile, normal on desktop.
- **Files**: `src/components/canvas/canvas-workspace.tsx`

### 15. Focus ring offset in canvas panel ✅
- **Broken**: Focus rings used `ring-offset-[var(--background)]` but the canvas side panel has a different background.
- **Fix**: Added `aria-label="Workspace panel"` + `[&_button]:focus-visible:ring-offset-[var(--background-sidepanel)]` to aside.
- **Files**: `src/components/side-panel/canvas-side-panel.tsx`
