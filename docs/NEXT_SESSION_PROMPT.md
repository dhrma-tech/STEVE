# Next Session Prompt

## Paste this at the start of tomorrow's session:

---

You are resuming the STEVE (Cofounder.co clone) UX polish project.

**All 15 Phase 3 polish fixes are complete.** The current blocker is the dark mode toggle, which the user reports is still not working after the last session's fixes.

## Current Blocker: Dark Mode Toggle

**What's broken**: Clicking the sun/moon toggle button in the top-left floating controls doesn't reliably switch between dark/light modes.

**Last fixes applied** (may not have fully resolved it):
1. Added `pointer-events-auto` to the toggle button (parent wrapper has `pointer-events-none`)
2. Rewrote middleware to use `ALWAYS_LIGHT` list for marketing/auth routes, preference cookie for app routes
3. Changed toggle from `className =` replacement to `classList.toggle()` to avoid wiping other classes

**Files involved**:
- `src/components/ui/theme-toggle.tsx` — the toggle component
- `src/middleware.ts` — theme routing logic
- `src/app/layout.tsx` — Toaster + html className

**How to debug**:
1. Open browser DevTools → Elements → inspect `<html>` element
2. Click the toggle button
3. Check: does `html.classList` change between "dark" and "light"?
4. Check: is cookie `theme-preference` being set? (DevTools → Application → Cookies)
5. Navigate to another page: does the theme persist?
6. Hard refresh: does the theme persist?

**How the system works**:
- Middleware reads `theme-preference` cookie → sets `x-theme` header
- `src/app/layout.tsx` reads `x-theme` → sets `html className`
- Dark mode: `html.dark` class → `html.dark { ... }` CSS tokens active
- Light mode: no `html.dark` class → `:root { ... }` CSS tokens active
- App routes (`/org/*`) default to "light", cookie can override to "dark"
- Marketing routes always light regardless of cookie

**Most likely remaining issue**: Investigate if Next.js App Router is re-hydrating/resetting the html class on client navigation. May need `suppressHydrationWarning` check or a client-side theme provider pattern.

## After Fixing Toggle — Phase 4 Items

Once toggle is confirmed working, move to Phase 4:

1. **Onboarding cluster (Slice 14)** — `company-onboarding-workspace.tsx`, `design-onboarding-wizard.tsx`, `option-card.tsx`, `personal-onboarding-wizard.tsx`, `stepper.tsx` — token migration to Section V
2. **Roadmap cluster (Slice 15)** — `roadmap-card.tsx`, `roadmap-detail-panel.tsx`, `roadmap-modal.tsx`, `roadmap-stage-board.tsx`
3. **Files cluster (Slice 16)** — `file-cards.tsx`, `file-library.tsx`, `file-preview-panel.tsx`, `folder-tree.tsx`, `upload-dialog.tsx`
4. **Departments cluster (Slice 17)** — `.animate-pixel-drift`, `.animate-pixel-wave` wiring, largest cluster

## Test Flows to Verify Current State

After any toggle fix, test these flows:
1. Visit `localhost:3000` → click "Run a Company" → arrives at `/login` ✓
2. Login (sandbox) → `/questions` wizard (5 steps, fade transitions) → `/org/[id]/onboarding`
3. Canvas: dot background responds to cursor ✓, department nodes lift on hover ✓
4. Click toggle → theme changes → navigate away → theme persists ← **this is the blocker**
5. Settings → save preferences → toast appears (not inline text) ✓
6. Side panel tabs → content fades in on switch ✓
7. Hamburger menu → nav drawer slides in with glass effect ✓

## Key Commands
```bash
cd c:\Users\ACER\STEVE
pnpm dev          # Start at localhost:3000
pnpm typecheck    # Must be 0 errors before stopping
```

## Do NOT touch
- `src/components/marketing/` — LOCKED (marketing is 100% done)
- `src/styles/tokens.css` — only add, never remove existing tokens
- `prisma/schema.prisma` — requires migration if changed
