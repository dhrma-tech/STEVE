# RESTART.md — Resume Guide

## Project Identity
**STEVE** — Full Cofounder.co clone. 17-slice design-token overhaul complete. Now in UX polish phase.

## Current State (as of session end)

### Phase 1 — Slices 1–17: ✅ COMPLETE
All design tokens, UI primitives, marketing, settings, canvas, agents, chat, notifications, command palette, integrations, side panel, tasks clusters done.

### Phase 2 — 10 Core UX Fixes: ✅ COMPLETE
Toast system (sonner), Button loading prop, Error state contrast, Specific wizard errors, OptionCard aria-pressed, Progress aria-label, Locked task tooltips, Advisor chat error toast, Settings inline redirect removed, Button cursor-not-allowed.

### Phase 3 — 15 Polish Fixes: ✅ ALL 15 COMPLETE

| # | Fix | Status |
|---|---|---|
| 1 | Settings StatusLine → toast | ✅ Done |
| 2 | Tab content fade keyframe | ✅ Done |
| 3 | Skeleton shimmer animation | ✅ Done |
| 4 | Wizard step fade transition | ✅ Done |
| 5 | Department node hover lift | ✅ Done |
| 6 | Toast theme-aware dark mode | ✅ Done |
| 7 | Advisor chat auto-grow textarea | ✅ Done |
| 8 | CanvasControls visual consistency | ✅ Done |
| 9 | Stepper check-pop animation | ✅ Done |
| 10 | Questions page entrance animation | ✅ Done |
| 11 | Nav drawer active-click flash | ✅ Done |
| 12 | Empty departments popover state | ✅ Done |
| 13 | LoadingState border light mode | ✅ Done |
| 14 | Bottom controls mobile offset | ✅ Done |
| 15 | Focus ring offset in canvas | ✅ Done |

### Additional fixes done in same session
- Interactive dot background cursor animation (canvas)
- Dot radius reduced: `1.2` max growth (was `2.5`)
- Dot opacity lowered: dark `0.08 + 0.38`, light `0.1 + 0.28`
- Dark mode toggle `pointer-events-auto` fix (was blocked by parent `pointer-events-none`)
- Dark mode toggle middleware rewrite (ALWAYS_LIGHT list vs preference cookie)
- ThemeToggle uses `classList.toggle` not `className =` replacement

## Current Blocker
**Dark mode toggle** — user reports still not working after pointer-events fix. May need further investigation. Possible issues:
- Cookie SameSite / domain setting
- Next.js App Router re-hydration resetting the class
- The `/org` route default (light) conflicting with "dark" preference

## Files Last Touched
- `src/components/ui/theme-toggle.tsx` — pointer-events fix
- `src/middleware.ts` — ALWAYS_LIGHT rewrite
- `src/components/canvas/interactive-background.tsx` — dot radius/opacity
- `src/components/settings/settings-sections.tsx` — toast migration
- `src/styles/animations.css` — tab-content-fade + check-pop keyframes
- `src/components/onboarding/personal-onboarding-wizard.tsx` — step fade + toast
- `src/components/canvas/canvas-workspace.tsx` — CanvasControls + empty state
- `src/components/canvas/department-node.tsx` — hover lift
- `src/components/side-panel/canvas-side-panel.tsx` — aria-label + focus ring
- `src/app/layout.tsx` — Toaster with theme prop

## What To Do First Tomorrow
1. **Debug dark mode toggle** — open browser DevTools, check:
   - Is `pointer-events-auto` on the button? (should be after fix)
   - Does clicking change `html.classList`?
   - Is the cookie `theme-preference` being set?
   - Does middleware read it on next navigation?
2. If toggle works: move to Phase 4 items (see PROJECT_CHECKLIST.md)

## Key Architecture Notes
- Dark mode: `html.dark` class → Section V tokens active
- Light mode: `:root` tokens active (no `html.dark`)
- Middleware: ALWAYS_LIGHT routes (marketing/auth) ignore cookie. App routes (`/org/*`) default light, cookie can set dark.
- Toast: `sonner` installed, `<Toaster>` in `src/app/layout.tsx`
- Canvas background: `InteractiveBackground` canvas element in `src/components/canvas/interactive-background.tsx`
- Nav drawer: floating glass panel in `app-shell.tsx`, triggered by hamburger
- No persistent sidebar — all nav in drawer + floating buttons

## Dev Commands
```bash
cd c:\Users\ACER\STEVE
pnpm dev          # Start STEVE (port 3000)
pnpm typecheck    # Must exit 0 before stopping

cd c:\Users\ACER\cofounder-landing
npm run dev       # Start landing page (port 5173)
```
