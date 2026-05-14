# checkpoint-slice-4.md

## Phase
Slice 4 — Settings Cluster (Section I)

## Status
Complete. `pnpm typecheck` exits 0. Zero legacy `--app-*` / `--brand-*` / hardcoded `rgba()` refs remain in either file.

## Scope
Re-skin `settings-shell.tsx` and `settings-sections.tsx` onto Section V / Section I tokens. No structural changes, no layout changes, no animation changes (settings has none).

## Files Changed
- `src/components/settings/settings-shell.tsx`
- `src/components/settings/settings-sections.tsx`
- `src/styles/tokens.css` (added `--background-settings`)
- `DECISIONS.md` (DECISION-56)
- `REGISTRY.md` (Slice 4 table)
- `CHANGES.md` (Slice 4 section)
- `checkpoint-slice-4.md` (this file)

## Token Migration Map

| Legacy | Section V | Notes |
|---|---|---|
| `--app-canvas` | `--background` | Page bg |
| `--app-panel` (shell) | `--background-sidepanel` | Shell sidebar + page header card |
| `--app-panel` (SettingsPanel) | `--background-settings` | New token `rgb(37,37,43)` per Section I |
| `--app-border` in SettingsPanel | `--border-8` | Section I: `rgba(255,255,255,0.08)` |
| `--app-border` elsewhere | `--border-10` | `rgba(255,255,255,0.1)` |
| `--app-text` | `--foreground-80` | |
| `--app-text-50` | `--foreground-50` | |
| `--app-primary-light` (sidebar icon) | `--foreground-80` | Near-white icon |
| `--app-primary-light` (StatusLine icon) | `--success-100` | CheckCircle2 = success |
| `--app-primary-light` (ExternalLinkRow) | `--tt-color-text-blue` | Blue link text per Section I |
| `--brand-300` focus rings | `--focused` | |
| `rgba(216,255,122,0.13)` active nav | `--foreground-5` | Section I active nav = `rgba(255,255,255,0.05)` |
| `rgba(255,255,255,0.06)` hover bgs | `--foreground-5` | |
| `rgba(255,255,255,0.04/.035)` subtle bgs | `--foreground-3` | |
| `rgba(239,68,68,0.38)` destructive border | `--tt-color-text-red-contrast` | |
| `rgba(239,68,68,0.08)` destructive bg | `--tt-color-text-red-contrast` | |
| `text-red-100` | `text-[var(--destructive)]` | DangerNote primary text |
| `text-red-100/65` | `text-[var(--foreground-50)]` | DangerNote detail text |

## Section I Spec Alignment

### SettingsPanel (section cards)
Per Section I: `background: rgb(37,37,43); border: 0.8px solid rgba(255,255,255,0.08); border-radius: 8-12px; padding: 16-20px.`
- `--background-settings` → `rgb(37,37,43)` ✓
- `--border-8` → `rgba(255,255,255,0.08)` ✓
- `rounded-[12px]` preserved ✓

### Settings sidebar nav
Per Section I: `Active: bg rgba(255,255,255,0.05), color rgba(255,255,255,0.8). Inactive: transparent, color rgba(255,255,255,0.5). Hover: bg rgba(255,255,255,0.05), color rgba(255,255,255,0.8).`
- Active: `--foreground-5` bg + `--foreground-80` text ✓
- Inactive: `--foreground-50` text + transparent ✓
- Hover: `--foreground-5` bg + `--foreground-80` text ✓
- Focus ring: `--focused` ✓
- Nav item radius: `rounded-[9px]` preserved (spec says 6px border-radius for nav items; existing uses 9px — kept per "no restructure" rule, see Deviation 2)

### KeyValueRows (data display grid)
- Outer border: `--border-10` ✓
- Row divider: `--border-10` ✓
- Row bg: `--foreground-3` (very subtle 3% overlay) ✓
- Label text: `--foreground-50` ✓
- Value text: `--foreground-80` ✓

### StatusLine (save feedback)
- Icon: `--success-100` (CheckCircle2 = green success) ✓
- Text: `--foreground-50` ✓

### ExternalLinkRow
- Text: `--tt-color-text-blue` = `rgb(29,112,217)` per Section I Company tab link style ✓

### DangerNote / Destructive confirmation
- Border: `--tt-color-text-red-contrast` ✓
- Bg: `--tt-color-text-red-contrast` ✓
- Primary text: `--destructive` = `lab(63.7053% 60.745 31.3109)` ✓
- Detail text: `--foreground-50` (muted secondary) ✓

## Assumptions Made

1. **`--app-primary-light` maps to three different tokens depending on context.** The legacy token was `#eeeee8e6` — a warm cream white. In dark mode it rendered as near-white (`≈ rgba(255,255,255,0.93)`). Three contexts used it with different semantic intent:
   - Sidebar header icon: near-white → `--foreground-80`
   - StatusLine CheckCircle: success indicator → `--success-100` (green is semantically correct)
   - ExternalLinkRow: link text → `--tt-color-text-blue` (Section I Company tab blue link style)

2. **Nav item radius kept at `rounded-[9px]`.** Section I sidebar nav spec says `border-radius: 6px`. The existing component uses 9px. Changing the radius is a visual change I could make, but the diff is cosmetic and the user's rule says "do not restructure." Noted here; can be corrected in a dedicated Section I detail pass.

3. **SettingsShell sidebar card.** Section I says "Left sidebar nav: width 200px, transparent bg." The existing component wraps the sidebar in a bordered panel at `xl:` breakpoint (`xl:bg-[var(--background-sidepanel)] xl:border`). Removing the border/bg would be a structural change. The spec intent is honored in spirit (dark, recessive sidebar) while keeping the existing bordered panel pattern. Noted for future cleanup.

4. **`rgba(255,255,255,0.035)` rounded to `--foreground-3` (0.03).** `--foreground-3 = #ffffff08 = rgba(255,255,255,0.031...)`. The difference (0.035 vs 0.031) is imperceptible. No token exists at exactly 0.035.

5. **`DangerNote` detail text changed from `text-red-100/65` to `text-[var(--foreground-50)]`.** `text-red-100` is a very light pink (Tailwind `#fee2e2`). In a dark-mode context this rendered as an almost-white pinkish tone. The Section I spec for destructive zones calls for `--destructive` (mid-red `#df5553`) as the text color. The detail text at reduced opacity is now muted foreground rather than pinkish — slightly less themed but more spec-consistent with the Section R destructive disabled state. Alternatives considered: `text-[var(--destructive)]/60` (Tailwind opacity modifier on CSS variable in arbitrary value — not reliable) and `opacity-60 text-[var(--destructive)]` (adds an opacity class — equivalent structural change). `--foreground-50` is the pragmatic choice.

## Deviations From Spec

1. **`--background-settings: rgb(37,37,43)` is a new token not in Section V.** Section I specifies this exact value for settings section card backgrounds but the Section V variable reference does not assign it a CSS variable name. Created analogously to `--border-subtle` and `--onboarding-warm-bg`. Documented as DECISION-56.

2. **Nav item border-radius: 9px vs spec's 6px.** Minor cosmetic deviation. Structural change deferred per "re-skin only" rule.

3. **Sidebar has a bordered panel wrapper at `xl:` breakpoint.** Section I calls for transparent sidebar bg. Existing bordered panel structure preserved per "no restructure" rule.

## Verification

```
pnpm typecheck                                                         → exit 0
grep "var(--app-|var(--brand-|var(--color-|rgba(239,68|rgba(255,255" settings-{shell,sections}.tsx   → 0 results
```

## Remaining Domain Clusters (13 pending)

Priority order per CHANGES.md:
app-shell · canvas · side-panel · agents · chat · integrations · tasks · departments · files · notifications · onboarding · roadmap · command-palette/billing
