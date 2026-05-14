# CLAUDE.md — Cofounder Design System Overhaul

> Last updated: Slice 13 complete (2026-05-15)
> Read this before touching any file in this session.

---

## Project identity

This is **STEVE** — a full Cofounder.co clone built over 17 phases. Product is functionally complete. The current work is a **UI/UX design-token overhaul** to match `report100.txt` (the spec, Sections A–V).

---

## Current overhaul state

| Slice | Scope | Status |
|---|---|---|
| Slice 1 | Design tokens + typography | ✅ |
| Slice 2 | 21 UI primitives | ✅ |
| Slice 3 / 3b | Light-mode system + 15 marketing files | ✅ |
| Slice 4 | Settings cluster | ✅ |
| Slice 5 | App-shell cluster | ✅ |
| Slice 6a / 6b | Canvas cluster (tokens + animations) | ✅ |
| Slice 7 | Agents cluster | ✅ |
| Slice 8 | Chat cluster | ✅ |
| Slice 9 | Notifications cluster | ✅ |
| Slice 10 | Command-palette cluster | ✅ |
| Slice 11 | Integrations cluster | ✅ |
| Slice 12 | Side-panel cluster | ✅ |
| Slice 13 | Tasks cluster | ✅ |
| Slice 14+ | 4 remaining clusters | 📋 |

**Progress: 13/17 slices complete (76%). ~82% spec alignment.**

---

## Design system foundation (what's done)

### Token layer (`src/styles/tokens.css`)
319 Section V dark tokens + Section B light tokens + legacy `:root` shim. Additional named tokens: `--border-subtle`, `--background-settings`. **Legacy shim stays until all 4 remaining clusters are done.**

### Animation layer (`src/styles/animations.css`)
36 Section L keyframes + utility classes. Wired so far: `canvasDashFlow` (orbital edges), `animate-agent-pulse` (running agents), `animate-agent-cue-pop` (workspace dialog), `animate-typing-dot` (chat typing indicator), `animate-attention-slide-up` + `animate-attention-item` (inbox panel/items).

### Z-index (`src/lib/z-index.ts`) — Section S complete, 17 constants.

### Migrated clusters

| Cluster | Files | Spec |
|---|---|---|
| UI primitives (21) | `src/components/ui/*.tsx` | ✅ J/K/N |
| Marketing (15) | `src/components/marketing/*`, `src/app/(marketing)/*` | ✅ B |
| Settings | `settings-shell.tsx`, `settings-sections.tsx` | ✅ I |
| App-shell | 5 files + `z-index.ts` | ✅ D/E/F/S |
| Canvas | 4 files + `animations.css` (36 kf) | ✅ D/E/H/L/S |
| Agents | 5 files | ✅ H/I/J/L |
| Chat | 4 files | ✅ N/L |
| Notifications | `inbox-panel.tsx` | ✅ N/O/S |
| Command-palette | `command-palette.tsx` | ✅ E/M/U |
| Integrations | `integration-center.tsx`, `postiz-integration.tsx` | ✅ M/N |
| Side-panel | `canvas-side-panel.tsx` | ✅ F/U/S |
| Tasks | 4 files | ✅ M/R/T |

---

## What's pending (4 clusters)

| Cluster | Key files | Size | Spec | Priority |
|---|---|---|---|---|
| **onboarding** | `company-onboarding-workspace.tsx`, `design-onboarding-wizard.tsx`, `option-card.tsx`, `personal-onboarding-wizard.tsx`, `stepper.tsx` | medium | M 2–7, A/Q | ⭐ next |
| **roadmap** | `roadmap-card.tsx`, `roadmap-detail-panel.tsx`, `roadmap-modal.tsx`, `roadmap-stage-board.tsx` | medium | K, F, L | ⭐ next |
| **files** | `file-cards.tsx`, `file-library.tsx`, `file-preview-panel.tsx`, `folder-tree.tsx`, `upload-dialog.tsx` | medium | F (Library) | ⭐ next |
| **departments** | `department-board.tsx`, `department-cover.tsx`, `department-context-tabs.tsx`, `department-detail-panel.tsx`, `department-roadmap-strip.tsx`, `department-sections.tsx` | large | G, B, L | final |

**Note on departments:** Contains pixel-drift DOM animation wiring (`.animate-pixel-drift`, `.animate-pixel-wave`) — the only remaining Section L wiring. Heavier than the other three. Best tackled last.

---

## Resume instructions for Slice 14

1. Read `checkpoint-slice-13.md` — tasks cluster complete state.
2. Pick ONE cluster from onboarding / roadmap / files.
3. `ls` the cluster directory, grep for legacy tokens, build mapping.
4. Execute token migration + any animation wiring.
5. `pnpm typecheck` → must exit 0.
6. Update `REGISTRY.md`, append `CHANGES.md`, write `checkpoint-slice-14.md`.
7. Stop and await review.

---

## Token migration cheat sheet

| Legacy | Section V |
|---|---|
| `--app-border` | `--border-10` |
| `--app-text` | `--foreground-80` |
| `--app-text-50` | `--foreground-50` |
| `--app-canvas` | `--background` |
| `--app-panel` | `--background-sidepanel` |
| `--app-black-base` | `--card` |
| `--app-primary-light` (icons/text) | `--foreground-80` |
| `--app-primary-light` (selected border) | `--primary` |
| `--app-primary-light` (links) | `--tt-color-text-blue` |
| `--brand-300` focus rings | `--focused` |
| `--danger` | `--destructive` |
| `--warning` | `--alert` |
| `rgba(255,255,255,0.03/.04)` | `--foreground-3` |
| `rgba(255,255,255,0.05/.06)` | `--foreground-5` |
| `rgba(255,255,255,0.07/.08)` | `--foreground-8` |
| `rgba(255,255,255,0.10/.12)` | `--foreground-10` |
| `rgba(0,0,0,0.12)` | `--foreground-inverse-10` |
| `rgba(0,0,0,0.16)` | `--foreground-inverse-20` |
| `rgba(239,68,68,0.36/.12)` | `--tt-color-text-red-contrast` (border+bg) + `--destructive` (text) |
| `rgba(245,158,11,0.38/.1)` | `--tt-color-text-yellow-contrast` (border+bg) + `--alert` (text) |
| `text-red-100` | `text-[var(--destructive)]` |
| `#ffd27c` | `var(--alert)` |
| `#9df0b4` | `var(--tt-color-text-green-contrast)` |
| Glass bgs `rgba(…,0.72–0.92)` | `--background-l0-{80,85}` |
| `bg-black/35` | `--foreground-inverse-30` |
| Node shadows | `--shadow-dept-agent-node-dark` |
| Panel shadows | `--shadow-outset-100`, `--tt-shadow-elevated-md` |
| z-index values | import from `src/lib/z-index.ts` |

---

## Hard rules

1. **Re-skin only.** No structural rebuilds (see DECISION-62, DECISION-63).
2. **No hardcoded values** — every color, shadow, spacing, easing → token.
3. **Marketing locked.** 100% done. Do not touch.
4. **One cluster per slice.** Typecheck after each. Stop and report.
5. **Legacy `:root` shim stays** until all 4 remaining clusters are done.
6. **SVG attribute values** use resolved literals (DECISION-60).

---

## Key files

| File | What |
|---|---|
| `src/styles/tokens.css` | 319 dark tokens + light + legacy shim |
| `src/styles/animations.css` | 36 Section L keyframes + utility classes |
| `src/lib/z-index.ts` | Section S z-index constants |
| `report100.txt` | **The spec.** Sections A–V. |
| `checkpoint-slice-13.md` | Most recent checkpoint |
| `CHANGES.md` | All cluster logs + pending list |
