# checkpoint-slice-11.md

## Phase
Slice 11 — Integrations Cluster (Section M Page 17 / N / V)

## Status
Complete. `pnpm typecheck` exits 0. Zero legacy refs in both integration files.

## Files Changed
- `src/components/integrations/integration-center.tsx`
- `src/components/integrations/postiz-integration.tsx`
- `REGISTRY.md`, `CHANGES.md`, `checkpoint-slice-11.md`

Note: `src/app/org/[orgId]/integrations/postiz/page.tsx` has no legacy tokens — bare server wrapper, not modified.

## Token Migration Map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | All section/card/channel-row borders (both files) |
| `--app-panel` | `--background-sidepanel` | Section + provider card backgrounds (both files) |
| `--app-canvas` | `--background` | postiz `<main>` page background |
| `--app-text-50` | `--foreground-50` | Labels, descriptions, metadata text (both files) |
| `--app-text` | `--foreground-80` | Button/link text, hover targets (both files) |
| `--app-primary-light` | `--foreground-80` | Megaphone icon + inline status messages (both files) |
| `rgba(255,255,255,0.04)` | `var(--foreground-3)` | Metric card bg, channel item bg |
| `rgba(255,255,255,0.06)` | `var(--foreground-5)` | Ghost button hover bg |
| `rgba(255,255,255,0.08)` | `var(--foreground-8)` | Icon badge bg (postiz Megaphone) |

## Status Pills (Section N)

`statusVariant()` in `integration-center.tsx` maps integration status strings to Badge variants:
- `"connected"` → `"success"` (green)
- `"sandbox"` → `"warning"` (yellow)
- `"needs_setup"` / `"disconnected"` → `"neutral"` (gray)
- `"error"` → `"danger"` (red)
- default → `"neutral"`

All Badge variants already use Section N tokens (migrated in Slice 2). No changes to `statusVariant()` needed — it was already spec-correct.

## Primitives Already Migrated (No Changes Needed)

- `<Badge>` — migrated Slice 2, all status variants correct
- `<Button variant="app|ghost|danger">` — migrated Slice 2
- `<EmptyState>` — migrated Slice 2
- `<Input surface="dark">` — migrated Slice 2
- `<SelectField surface="dark">` — migrated Slice 2

## Assumptions Made

1. **`--app-primary-light` → `--foreground-80` for Megaphone icon and message text.** Both occurrences are icon/informational-text context (not selected border, not hyperlink). Consistent with Slices 7–10.

2. **`--app-panel` → `--background-sidepanel`.** The provider cards and section containers use the side-panel background (`rgb(30,30,35)` per Section D) — same surface as the chat panel, agent panel, and settings shell. Consistent with app-shell and settings cluster migrations.

3. **postiz `<main>` bg → `--background`.** The postiz page uses a full-page `<main>` element — this is a canvas-level background (`rgb(30,30,35)`), same as the canvas workspace and authenticated app shell. `--app-canvas` → `--background` per cheat sheet.

## Deviations From Spec

None. Two-file migration, no structural changes.

## Verification

```
pnpm typecheck                                                            → exit 0
grep "var(--app-|var(--brand-|rgba(255,255" integration-center.tsx        → 0 results
grep "var(--app-|var(--brand-|rgba(255,255" postiz-integration.tsx        → 0 results
```

## Remaining Domain Clusters (6 pending)

files · onboarding · roadmap · tasks · departments · side-panel
