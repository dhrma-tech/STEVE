# checkpoint-slice-13.md

## Phase
Slice 13 — Tasks Cluster (Section M Page 16 / R / T / V)

## Status
Complete. `pnpm typecheck` exits 0. Zero legacy refs across all 4 task files.

## Files Changed
- `src/components/tasks/task-cards.tsx` (10 passes)
- `src/components/tasks/task-workspace.tsx` (8 passes)
- `src/components/tasks/task-create-dialog.tsx` (4 passes)
- `src/components/tasks/task-detail-panel.tsx` (12 passes)
- `REGISTRY.md`, `CHANGES.md`, `checkpoint-slice-13.md`

## Token Migration Map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | All card/section/row/comment borders |
| `--app-text-50` | `--foreground-50` | All secondary/muted text |
| `--app-text` | `--foreground-80` | Button text, ghost hover targets |
| `--app-primary-light` (icons) | `--foreground-80` | CalendarDays, Sparkles, Filter, MessageSquare, Paperclip, ShieldAlert |
| `--app-primary-light` (selected border) | `--primary` | TaskRow selected border (task-cards.tsx only) |
| `--brand-300` | `--focused` | Focus-visible rings on interactive rows/buttons |
| `rgba(255,255,255,0.04)` | `var(--foreground-3)` | Unselected card/section bgs |
| `rgba(255,255,255,0.06)` | `var(--foreground-5)` | Icon badge bg, ghost button hover, subtask/session hover |
| `rgba(255,255,255,0.07)` | `var(--foreground-8)` | TaskRow hover (non-standard 0.07 → nearest token 0.08) |
| `rgba(255,255,255,0.08)` | `var(--foreground-8)` | TaskRow selected bg |
| `rgba(0,0,0,0.12)` | `var(--foreground-inverse-10)` | Board/calendar column bgs, inner section bgs, detail panel bg |
| `rgba(239,68,68,0.36)` | `var(--tt-color-text-red-contrast)` | Error block border |
| `rgba(239,68,68,0.12)` | `var(--tt-color-text-red-contrast)` | Error block bg |
| `text-red-100` | `text-[var(--destructive)]` | Error block text |
| `rgba(245,158,11,0.38)` | `var(--tt-color-text-yellow-contrast)` | Approval block border |
| `rgba(245,158,11,0.1)` | `var(--tt-color-text-yellow-contrast)` | Approval block bg |
| `#ffd27c` | `var(--alert)` | Approval amber text |
| `#9df0b4` | `var(--tt-color-text-green-contrast)` | Completed subtask check icon |

## Assumptions Made

1. **`rgba(255,255,255,0.07)` → `--foreground-8`.** Non-standard hover opacity (0.07) not in the cheat sheet. Rounded to nearest available token (`--foreground-8` = 0.08). Hover states benefit from slightly more visibility; rounding up is appropriate.

2. **`#ffd27c` → `--alert`.** Approval amber matches the `--alert` token semantic (attention-level warning, not a blocking error). Consistent with Section T approval semantics.

3. **`#9df0b4` → `--tt-color-text-green-contrast`.** Completed subtask check icon — a light pastel green consistent with success/complete states. Maps to the green text contrast token established in the Badge system (Slice 2). No other Section V green text token available at this opacity level.

4. **`rgba(245,158,11,0.38/.1)` → `--tt-color-text-yellow-contrast`.** Follows the same error-block pattern: `--tt-color-text-red-contrast` for red surfaces, `--tt-color-text-yellow-contrast` for yellow/amber surfaces. Both are translucent contrast tokens used for tinted surface border+bg.

5. **`--app-primary-light` → `--primary` for selected row border only.** All other icon/label occurrences in tasks → `--foreground-80`. The TaskRow selected border is identical to the ChatThread and TaskCard selected border patterns from Slices 7/8/11.

## Task Status (Section T)

`<StatusBadge>` (migrated Slice 2) handles status display semantics: pending/running/completed/blocked/cancelled each render via Badge variant. `taskStatusOptions` drives the SelectField values. No migration needed beyond the primitives already done.

## Deviations From Spec

1. **`rgba(255,255,255,0.07)` → `--foreground-8` (0.08).** Slight upward rounding — no token for 0.07. Documented above.

## Verification

```
pnpm typecheck                                                            → exit 0
grep in tasks/ for all legacy patterns                                    → 0 results
```

## Remaining Domain Clusters (4 pending)

files · onboarding · roadmap · departments
