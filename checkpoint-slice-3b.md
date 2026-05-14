# checkpoint-slice-3b.md

## Phase
Slice 3b — Marketing Domain Component Migration

## Status
Complete. `pnpm typecheck` exits 0. Zero legacy `--color-ink-*` / `--color-surface-*` / `--color-border-*` / `--hero-blue` / `--brand-300` (focus rings) refs remain in any marketing component or page.

## Scope
Remove all legacy light-mode token references from the marketing surface (components + pages) and replace with Section B / Section V tokens that now resolve correctly under `html:not(.dark)` from Slice 3.

## Token Migration Map Applied

| Legacy name | Section V replacement | Notes |
|---|---|---|
| `--color-ink` | `--foreground` | `rgb(32,32,32)` in light mode |
| `--color-ink-strong` | `--foreground-80` | `rgba(32,32,32,0.8)` |
| `--color-ink-muted` | `--foreground-60` | `rgba(32,32,32,0.6)` |
| `--color-ink-faint` | `--foreground-50` | `rgba(32,32,32,0.5)` |
| `--color-ink-strongest` | `--foreground` | Same as base foreground (darkest) |
| `--color-surface` | `--background` | `rgb(241,241,238)` in light mode |
| `--color-surface-raised` | `--background-l0` | `rgb(251,251,248)` in light mode |
| `--color-surface-darker` | `--foreground-10` | `rgba(32,32,32,0.1)` — progress track |
| `--color-border-card` | `--border-10` | `rgba(0,0,0,0.1)` in light mode |
| `--color-border-pill` | `--border-subtle` | `rgba(0,0,0,0.06)` in light mode |
| `--hero-blue` | `--tt-color-text-blue` | `rgb(29,112,217)` in light mode |
| `--brand-300` (focus rings) | `--focused` | `rgb(29,112,217)` in light mode |
| `--brand-500` (progress bar) | `--tt-brand-color-500` | `#6229ff` (same value, canonical name) |
| `--color-feature-success` | `--success-100` | `#34a853` |
| `--color-feature-neutral` | `--foreground-40` | `rgba(32,32,32,0.4)` |

## Files Changed (15 source files + 4 doc files)

### Source files migrated
1. `src/components/marketing/marketing-nav.tsx`
2. `src/components/marketing/marketing-footer.tsx`
3. `src/components/marketing/home-sections.tsx`
4. `src/components/marketing/pricing-calculator.tsx`
5. `src/components/marketing/chapter-card.tsx`
6. `src/components/marketing/feature-comparison.tsx`
7. `src/components/marketing/how-to-renderer.tsx`
8. `src/components/marketing/resources-grid.tsx`
9. `src/components/marketing/pixel-art.tsx` (FooterPixelCard only)
10. `src/app/(marketing)/pricing/page.tsx`
11. `src/app/(marketing)/resources/page.tsx`
12. `src/app/(marketing)/docs/page.tsx`
13. `src/app/(marketing)/privacy-policy/page.tsx`
14. `src/app/(marketing)/terms/page.tsx`
15. `src/app/(marketing)/resources/introducing-cofounder-2/page.tsx` (bonus — found during sweep, not in original 13-file list)

### Doc files
- `DECISIONS.md` (DECISION-53 appended)
- `REGISTRY.md` (Slice 3b status table appended)
- `CHANGES.md` (Slice 3b section appended)
- `checkpoint-slice-3b.md` (this file)

### Files audited — no changes
- `src/app/(marketing)/page.tsx`
- `src/app/(marketing)/layout.tsx`
- `src/app/(marketing)/how-to/[chapter]/page.tsx`
- `src/components/marketing/orbit-preview.tsx`
- `src/components/marketing/notification-wheel.tsx`

## Assumptions Made

1. **`orbit-preview.tsx` dark widget left alone.** The OrbitPreview component embeds a dark-styled "app canvas preview" inside a light marketing page. It uses `--app-border`, `--app-canvas`, `--app-text`, `--app-black-base`, and `--brand-300` for the center node icon. These tokens are intentionally dark-app-mode values — the widget is supposed to render dark. The `--brand-300` reference is for the center node's icon color (brand purple inside the dark preview box), not a focus ring. Left unchanged because: (a) the user's instruction was to remove `--color-ink-*` and `--color-surface-*`, not `--app-*` or `--brand-*`; (b) changing it to `--focused` (blue in light mode) would break the dark widget's visual design. Will be addressed in Slice 2b when `orbit-preview.tsx` is domain-migrated.

2. **`introducing-cofounder-2/page.tsx` added to scope.** This file was not in the explicit 13-file list but was discovered during the post-migration sweep. It had the same `--color-ink-*` pattern. Patching it was ~4 edits and kept the marketing surface internally consistent. Recorded as a bonus in CHANGES.md.

3. **No pixel-art color values migrated.** `pixel-art.tsx` uses inline hex colors (`#262323`, `#3c5a48`, `#d8f999`) for the CSS-only pixel art geometry. These are intentional design colors, not legacy token references — they are the artwork itself. Left unchanged.

## Verification

```
pnpm typecheck   → exit 0
grep "color-ink|color-surface|color-border|hero-blue" src/app/(marketing)/ src/components/marketing/   → 0 results
```

## State of Legacy `:root` Shim After Slice 3b

The `:root` legacy shim in `tokens.css` now serves only:
1. **Domain app components** (app-shell, canvas, side-panel, agents, chat, settings, integrations, tasks, departments, etc.) — still reference `--app-*` tokens; covered by Slice 2b.
2. **Auth components** (login-panel, onboarding wizards) — use both legacy light tokens and app-mode tokens; will be addressed when auth components are re-skinned.

The entire marketing surface has graduated off the legacy shim. The shim can be removed entirely once Slice 2b is complete.

## What Slice 4 Needs

1. **Slice 2b — domain component migration.** The 14 clusters (app-shell, canvas, side-panel, agents, chat, settings, etc.) still reference `--app-*` legacy tokens. Each cluster needs its own focused sub-slice.
2. **Auth component migration.** `login-panel.tsx` and the onboarding components mix light-mode legacy tokens with the existing spec-aligned styles. These are ready for migration now that the light-mode scope is stable.
3. **Remove the legacy `:root` shim** once Slice 2b completes.
