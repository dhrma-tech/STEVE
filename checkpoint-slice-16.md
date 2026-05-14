# checkpoint-slice-16.md

## Phase
Slice 16 — Files Cluster (Section M / N / U)

## Status
Complete. `pnpm typecheck` exits 0. Zero legacy `--app-*`/`--brand-*` refs. Only `rgba(216,255,122,*)` remains — intentional design-specific lime selection highlight.

## Files Changed
- `src/components/files/file-cards.tsx` (7 passes)
- `src/components/files/folder-tree.tsx` (6 passes)
- `src/components/files/upload-dialog.tsx` (3 passes)
- `src/components/files/file-library.tsx` (7 passes)
- `src/components/files/file-preview-panel.tsx` (10 passes)
- `REGISTRY.md`, `CHANGES.md`, `checkpoint-slice-16.md`

## Token Migration Map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | All section/card/panel/input borders |
| `--app-text` | `--foreground-80` | File name, preview text, ghost button, status label |
| `--app-text-50` | `--foreground-50` | File metadata, folder labels, stat eyebrows, share URL |
| `--app-primary-light` | `--foreground-80` | File type icons, folder/layer icons, Files/Search/Link2 icons |
| `--brand-300` | `--focused` | File card + folder button focus-visible rings |
| `rgba(255,255,255,0.04)` | `var(--foreground-3)` | Unselected card/section bgs, stat cards, version row bgs |
| `rgba(255,255,255,0.05)` | `var(--foreground-5)` | Folder button hover bg (0.05 ≈ 0.06 → foreground-5) |
| `rgba(255,255,255,0.06)` | `var(--foreground-5)` | Header icon badge bg, ghost button hover |
| `rgba(255,255,255,0.07)` | `var(--foreground-8)` | File/preview icon badge bg (0.07 ≈ 0.08) |
| `rgba(0,0,0,0.12)` | `var(--foreground-inverse-10)` | Version history section bg |
| `rgba(0,0,0,0.14)` | `var(--foreground-inverse-10)` | Preview block bg (0.14 ≈ 0.12, rounds to inverse-10) |
| `rgba(0,0,0,0.22)` | `var(--foreground-inverse-20)` | Code/text preview inner bg (0.22 ≈ 0.20, rounds to inverse-20) |

## Tokens Kept as Literals

`rgba(216,255,122,0.46)`, `rgba(216,255,122,0.1)`, `rgba(216,255,122,0.12)` — lime/neon selection highlight for selected file card and selected folder button. Design-specific choice with no Section V semantic equivalent. Present in `file-cards.tsx` and `folder-tree.tsx`.

## Assumptions Made

1. **`rgba(0,0,0,0.14)` → `--foreground-inverse-10`.** Preview section bg sits between inverse-10 (0.12) and inverse-20 (0.16). Semantically it's a standard dark inner panel — inverse-10 is the correct tier.

2. **`rgba(0,0,0,0.22)` → `--foreground-inverse-20`.** Code preview bg is intentionally darker than the surrounding preview block. At 0.22 it's between inverse-20 (0.16) and inverse-30 (`bg-black/35` = 0.35). inverse-20 is the correct tier — it provides the "code block is darker" visual without being as opaque as a code editor bg.

3. **`rgba(255,255,255,0.05)` → `--foreground-5`.** Folder button hover bg at 0.05. Nearest token is foreground-5 (5–6% range). Correct.

4. **`--app-primary-light` → `--foreground-80` for all icons.** All icon occurrences (file type icon, folder icon, Files header icon, Search icon, Link2 icon) are icon/label context. Consistent with all prior cluster migrations.

## Deviations From Spec

1. **`rgba(0,0,0,0.14)` and `rgba(0,0,0,0.22)` are non-standard values** with no exact Section V token matches. Rounded to nearest semantically appropriate tier. Documented above.

## Verification

```
pnpm typecheck                                                            → exit 0
grep var(--app-|var(--brand- across files/                               → 0 results
rgba(216,255,122,*) retained (design-specific lime selection, 2 files)
```

## Remaining Domain Cluster (1 pending)

departments
