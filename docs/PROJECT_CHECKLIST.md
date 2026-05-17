# COFOUNDER.CO (STEVE) — Complete Project Status

## PHASE 1: Design Token Overhaul ✅ 100%

| Slice | Scope | Status |
|---|---|---|
| 1 | Design tokens + typography | ✅ |
| 2 | 21 UI primitives | ✅ |
| 3 / 3b | Light-mode system + 15 marketing files | ✅ |
| 4 | Settings cluster | ✅ |
| 5 | App-shell cluster | ✅ |
| 6a / 6b | Canvas cluster (tokens + animations) | ✅ |
| 7 | Agents cluster | ✅ |
| 8 | Chat cluster | ✅ |
| 9 | Notifications cluster | ✅ |
| 10 | Command-palette cluster | ✅ |
| 11 | Integrations cluster | ✅ |
| 12 | Side-panel cluster | ✅ |
| 13 | Tasks cluster | ✅ |
| 14 | Onboarding cluster | ⏳ Pending |
| 15 | Roadmap cluster | ⏳ Pending |
| 16 | Files cluster | ⏳ Pending |
| 17 | Departments cluster | ⏳ Pending (hardest — pixel animations) |

---

## PHASE 2: Core UX Fixes ✅ 100% (10/10)

- [x] Toast notification system (sonner installed, Toaster in root layout)
- [x] Button `loading` prop + built-in spinner
- [x] Button `disabled:cursor-not-allowed`
- [x] Error state contrast (dark mode visible)
- [x] Specific wizard error messages per step
- [x] OptionCard `aria-pressed` accessibility
- [x] Progress bar `aria-label` + `aria-valuenow`
- [x] Locked task buttons: aria-label + title tooltip
- [x] Advisor chat errors surface as toast (not silent)
- [x] Settings index page inline (no blank redirect flash)

---

## PHASE 3: Delight & Polish 🟡 93% (14/15)

### Tier 1 — Critical ✅ 3/3
- [x] Settings StatusLine → toast
- [x] Tab content fade keyframe defined
- [x] Skeleton shimmer token fix

### Tier 2 — High Impact ✅ 5/5
- [x] Wizard step fade transition
- [x] Department node hover lift
- [x] Toast dark mode theme-aware
- [x] Advisor chat auto-grow textarea
- [x] CanvasControls visual consistency

### Tier 3 — Polish ✅ 6/7
- [x] Stepper check-pop animation
- [x] Questions page entrance animation
- [x] Nav drawer active-click flash
- [x] Empty departments popover state
- [x] LoadingState border light mode
- [x] Bottom controls mobile offset
- [ ] **Dark mode toggle** ← BLOCKER (pointer-events fixed, middleware fixed, still reported broken)

**Est. time remaining**: ~30 min (just the toggle debug)

---

## PHASE 4: Next Improvements (not started)

### Remaining Slices (from CLAUDE.md)
- [ ] Slice 14: Onboarding cluster — `company-onboarding-workspace.tsx`, `design-onboarding-wizard.tsx`, `option-card.tsx`, `personal-onboarding-wizard.tsx`, `stepper.tsx`
- [ ] Slice 15: Roadmap cluster — 4 files
- [ ] Slice 16: Files cluster — 5 files
- [ ] Slice 17: Departments cluster — 6 files + pixel-drift animation wiring (Section L)

### Additional UX Work
- [ ] Onboarding `/org/[orgId]/onboarding` — company questions wizard, design vibe, department activation
- [ ] GitHub OAuth credentials in `.env.local` (currently using sandbox fallback)
- [ ] Landing page (`cofounder-landing` Vite app at port 5173) — Features/HowItWorks/Testimonials sections built but could be refined
- [ ] Mobile responsive audit (canvas on small screens)
- [ ] Keyboard navigation full audit
- [ ] Lighthouse performance scores

---

## TECH DEBT & KNOWN ISSUES

- [ ] **Dark mode toggle** — still being debugged (see NEXT_SESSION_PROMPT.md)
- [ ] Legacy `:root` shim in `tokens.css` — stays until all 4 remaining clusters done (per CLAUDE.md rule)
- [ ] `src/app/api/auth/github/route.ts` — resets sandbox user onboarding on every click (intentional dev workaround, remove before production)
- [ ] `src/app/org/[orgId]/settings/page.tsx` — now renders preferences inline but `getPreferencesSettings` must handle missing data gracefully
- [ ] `cofounder-landing` (Vite, port 5173) is a separate project at `c:\Users\ACER\cofounder-landing` — not connected to STEVE backend

---

## QUICK REFERENCE: Key Files

| File | Purpose |
|---|---|
| `src/styles/tokens.css` | 319 dark tokens + light tokens + legacy shim |
| `src/styles/animations.css` | All keyframes + utility animation classes |
| `src/middleware.ts` | Route theme routing (ALWAYS_LIGHT vs preference cookie) |
| `src/app/layout.tsx` | Root layout, Toaster, html theme class |
| `src/components/app-shell/app-shell.tsx` | Main shell: nav drawer, floating controls |
| `src/components/canvas/canvas-workspace.tsx` | ReactFlow canvas, CanvasControls, InteractiveBackground |
| `src/components/canvas/interactive-background.tsx` | Cursor-reactive dot grid animation |
| `src/components/ui/theme-toggle.tsx` | Dark/light toggle button |
| `src/components/side-panel/canvas-side-panel.tsx` | Right panel: Home/AI/Tasks/Files tabs |
| `src/lib/auth/session.ts` | Session + destinationForSession routing |
| `src/app/api/questions/submit/route.ts` | Onboarding: creates profile + org in one shot |
| `prisma/schema.prisma` | SQLite DB schema |

---

## ENVIRONMENT

- Platform: Windows 11, PowerShell
- Working dir: `c:\Users\ACER\STEVE`
- Node: pnpm workspace
- DB: SQLite (`prisma/dev.db`) via Prisma
- Auth: Custom HMAC-SHA256 sessions (no NextAuth)
- GitHub OAuth: NOT configured (uses sandbox fallback)
- Landing page: separate Vite project at `c:\Users\ACER\cofounder-landing`
