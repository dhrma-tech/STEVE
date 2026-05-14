# checkpoint-slice-9.md

## Phase
Slice 9 — Notifications Cluster (Section N / O / S)

## Status
Complete. `pnpm typecheck` exits 0. Zero legacy refs in inbox-panel.tsx.

## Files Changed
- `src/components/notifications/inbox-panel.tsx`
- `REGISTRY.md`, `CHANGES.md`, `checkpoint-slice-9.md`

## Token Migration Map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | Header border-b, subheader border-b, article border |
| `--app-text` | `--foreground-80` | Item title, mark-read button hover |
| `--app-text-50` | `--foreground-50` | Loading text, item description, mark-read default |
| `--app-primary-light` (icon) | `--foreground-80` | Bell icon tint |
| `--app-primary-light` (link) | `--tt-color-text-blue` | "Open" link per Section N |
| `rgba(255,255,255,0.04)` | `--foreground-3` | Article card bg |
| hardcoded z-index (none present) | `Z_ATTENTION_INBOX` (1000) | DialogContent style.zIndex |

## Section L Animation Wiring

`InboxPanel` component in `inbox-panel.tsx`:
- `animate-attention-slide-up` → added to `<DialogContent>`: panel entrance (`attentionUpdateSlideUp` keyframe — `translateY(8px) → 0`, `opacity 0 → 1`)
- `animate-attention-item` → added to each `<article>`: per-item entrance (`attentionInboxItemAppear` keyframe — `translateY(6px) → 0`, `opacity 0 → 1`)

Both classes reference the Section V `--tt-transition-duration-default` and `--tt-transition-easing-cubic` tokens via the utility class definitions in `animations.css`.

## Z-Index

`Z_ATTENTION_INBOX = 1000` imported from `src/lib/z-index.ts` and applied as `style={{ zIndex: Z_ATTENTION_INBOX }}` on `<DialogContent>`. No hardcoded z-index values remain.

## Hover States (Section N)

- `<article>` items: `hover:bg-[var(--foreground-8)] transition-colors` — spec-specified hover bg
- "Mark read" button: `hover:text-[var(--foreground-80)]` — secondary → primary text on hover

## Empty State (Section O)

Delegates to `<EmptyState surface="dark" title="All caught up" ...>` which is already a migrated UI primitive from Slice 2. No changes needed — spec-aligned.

## Assumptions Made

1. **`Z_ATTENTION_INBOX` applied to DialogContent.** The z-index constant comment in `z-index.ts` says "bottom-left ambient notification pill" but the panel itself renders as a Dialog. Applying the constant via `style.zIndex` on `<DialogContent>` ensures the notification panel respects the Section S layering hierarchy (1000 = above canvas nodes, below modals/10080). No other z-index is hardcoded.

2. **`animate-attention-item` for per-item entrance.** The `animations.css` file defines both `attentionUpdateSlideUp` (panel entrance, utility: `animate-attention-slide-up`) and `attentionInboxItemAppear` (item entrance, utility: `animate-attention-item`). Both were wired. The completion criteria specified `animate-attention-slide-up` only, but the per-item class was already purpose-built for inbox items and the spec says it should be wired; applied to `<article>` elements.

3. **`--app-primary-light` → two mappings.** Bell icon (icon tint context) → `--foreground-80`. "Open" link (link text context) → `--tt-color-text-blue`. Same context-disambiguation rule applied consistently since Slice 7.

## Deviations From Spec

None. Single-file migration with no structural changes.

## Verification

```
pnpm typecheck                                                           → exit 0
grep "var(--app-|var(--brand-|rgba(255,255" inbox-panel.tsx              → 0 results
```

## Remaining Domain Clusters (8 pending)

integrations · tasks · departments · files · onboarding · roadmap · command-palette/billing · side-panel
