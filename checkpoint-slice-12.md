# checkpoint-slice-12.md

## Phase
Slice 12 — Side-Panel Cluster (Section F / U / S)

## Status
Complete. `pnpm typecheck` exits 0. Zero legacy refs in canvas-side-panel.tsx.

## Files Changed
- `src/components/side-panel/canvas-side-panel.tsx`
- `REGISTRY.md` (new entry added), `CHANGES.md`, `checkpoint-slice-12.md`

## Token Migration Map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | `<aside>` border-t/border-l, tab bar border-b, roadmap section border, icon badge border, MiniRow borders |
| `--app-panel` | `--background-sidepanel` | `<aside>` background |
| `--app-text` | `--foreground-80` | `<aside>` base text color |
| `--app-text-50` | `--foreground-50` | Roadmap subtitle, PanelHeading eyebrow, MiniRow detail |
| `--app-primary-light` | `--foreground-80` | PanelHeading icon badge tint (icon/label context) |
| `rgba(255,255,255,0.04)` | `var(--foreground-3)` | Roadmap progress card bg, MiniRow card bg |
| `rgba(255,255,255,0.06)` | `var(--foreground-5)` | PanelHeading icon badge bg |
| `--brand-300` | `--focused` | Suggested task focus-visible ring |

## Tab Pane Inventory

| Tab | Content | Token migration status |
|---|---|---|
| Home | Roadmap progress card + suggested task MiniRows + Ask Cofounder Textarea | ✅ migrated |
| AI | `<ChatWorkspace compact>` | Delegates to Slice 8 (migrated) |
| Company | StackStatus MiniRows + `<AgentControlCenter compact>` | MiniRow tokens ✅; AgentControlCenter delegates to Slice 7 (migrated) |
| Tasks | `<TaskWorkspace compact>` | Delegates to tasks cluster (Slice 13+, pending) |
| Library | `<FileLibrary compact>` | Delegates to files cluster (Slice 13+, pending) |

## Z-Index (Section S)

No hardcoded z-index in file. `<aside>` uses layout flow positioning inside the canvas workspace grid. `Z_RIGHT_SIDEBAR = 2000` exists in z-index.ts but is not applicable — the panel is not fixed/absolutely positioned.

## Primitives Already Migrated (No Changes Needed)

- `<Badge>` variants — Slice 2
- `<Button variant="app|ghost">` — Slice 2
- `<EmptyState surface="dark">` — Slice 2
- `<Progress>` — Slice 2
- `<Tabs>` / `<TabsList>` / `<TabsTrigger>` / `<TabsContent>` — Slice 2
- `<Textarea surface="dark">` — Slice 2

## Assumptions Made

1. **`--app-primary-light` → `--foreground-80` for icon badge.** PanelHeading renders icon badge tint — icon/label context per cheat sheet. Consistent with all prior clusters.

2. **No z-index import.** The `<aside>` sits in CSS grid layout flow. Fixed/absolute stacking is handled by the canvas overlay chrome, not the side panel itself.

3. **File real path.** CLAUDE.md listed this as `src/components/app-shell/canvas-side-panel.tsx` but actual location is `src/components/side-panel/canvas-side-panel.tsx`. Migrated at correct path. REGISTRY.md entry added at correct path.

## Deviations From Spec

None. Single-file migration, no structural changes.

## Verification

```
pnpm typecheck                                                            → exit 0
grep "var(--app-|var(--brand-|rgba(255,255" canvas-side-panel.tsx         → 0 results
```

## Remaining Domain Clusters (5 pending)

files · onboarding · roadmap · tasks · departments
