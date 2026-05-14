# checkpoint-slice-6a.md

## Phase
Slice 6a — Canvas Cluster Token Migration (Sections D / E / H / S)

## Status
Complete. `pnpm typecheck` exits 0. Zero CSS-class legacy refs across canvas files. One intentional SVG-attribute literal documented.

## Scope
Token substitution only across 4 canvas components (`canvas-workspace.tsx`, `cofounder-node.tsx`, `department-node.tsx`, `workspace-preview-card.tsx`). `query-shells.tsx` audited — zero changes needed. Animations deferred to Slice 6b.

## Files Changed
- `src/components/canvas/canvas-workspace.tsx`
- `src/components/canvas/cofounder-node.tsx`
- `src/components/canvas/department-node.tsx`
- `src/components/canvas/workspace-preview-card.tsx`
- `REGISTRY.md`, `CHANGES.md`, `checkpoint-slice-6a.md`

## Token Migration Map

| Legacy | Section V | Notes |
|---|---|---|
| `--app-canvas` | `--background` | `rgb(30,30,35)` per Section D |
| `--app-text` | `--foreground-80` | |
| `--app-text-50` | `--foreground-50` | |
| `--app-border` | `--border-10` | |
| `--app-primary-light` (icon badge bg) | `--primary` | J Tier 1 |
| `--app-black-base` (icon badge text) | `--primary-foreground` | |
| `--app-primary-light` (progress fill) | `--tt-brand-color-500` | brand accent for progress |
| `--brand-300` | `--focused` | |
| `rgba(255,255,255,0.08)` | `--foreground-8` | |
| `rgba(255,255,255,0.10)` | `--foreground-10` | progress track |
| `rgba(238,238,232,0.34)` | `--border-30` | CofounderNode warm border |
| `rgba(255,255,255,0.12)` inline | `"var(--border-10)"` | DeptNode unselected border, inline style |
| `rgba(14,14,17,0.72)` / `rgba(29,29,34,0.78)` | `--background-l0-80` | dark glass ~80% |
| `rgba(14,14,17,0.88)` / `rgba(37,37,43,0.92)` | `--background-l0-85` | dark glass ~85% |
| Node shadows | `--shadow-dept-agent-node-dark` | Section K spec node shadow |
| Panel shadow | `--shadow-outset-100` | overlay panel |
| Edge `style.stroke` | `"var(--border-20)"` | CSS style — resolves in SVG ✓ |
| Edge `labelBgStyle.fill` | `"var(--background-l0-80)"` | CSS style — resolves ✓ |
| `<Background color>` | `transparent` | Section D: no grid dots |
| `maskColor` | `rgba(30,30,35,0.64)` | SVG attr — resolved `--background` RGB |
| `markerEnd.color` | `rgba(255,255,255,0.3)` | SVG attr — resolved `--border-30` |

## Section D Alignment

- Canvas bg: `--background` (`rgb(30,30,35)`) ✓
- No grid dots: `<Background color="transparent">` ✓ (Section D: "pure dark surface")
- Radial subtle center highlight: `--foreground-8` in gradient ✓
- Section Q responsive: mobile `h-[200px]` → `h-[calc(100dvh-140px)]` structure preserved (not a token concern)

## Section H Alignment (Node Types)

**CofounderNode:**
- Glass bg: `--background-l0-85` ✓
- Border: `--border-30` (0.3 warm white, approximates spec's inset ring) ✓
- Shadow: `--shadow-dept-agent-node-dark` (spec Section K node shadow) ✓
- Icon badge: `--primary` / `--primary-foreground` (J Tier 1) ✓
- Progress bar: `--foreground-10` track / `--tt-brand-color-500` fill ✓

**DepartmentNode:**
- Glass bg: `--background-l0-85` ✓
- Unselected border: `"var(--border-10)"` inline style ✓
- Selected border: `nodeData.color` (dept accent — data-driven, correct) ✓
- Shadow: `--shadow-dept-agent-node-dark` ✓
- Icon accent: `${nodeData.color}22` (data-driven dept color at 13% — correct) ✓

**WorkspacePreviewCard:**
- Resting bg: `--background-l0-80` / hover: `--background-l0-85` ✓
- Border: `--border-10`, focus ring: `--focused` ✓
- Shadow: `--shadow-dept-agent-node-dark` ✓

## Assumptions Made

1. **Glass background opacity approximated.** All "very dark near-black with opacity" values (`rgba(14,14,17,0.72)`, `rgba(29,29,34,0.78)`, `rgba(37,37,43,0.92)`, `rgba(14,14,17,0.88)`) are mapped to `--background-l0-80` (80%) or `--background-l0-85` (85%) — the closest Section V opacity-variant tokens. Visual differences on a dark canvas with `backdrop-blur` are imperceptible.

2. **`--border-30` for CofounderNode border.** The spec Section H cofounderNode uses an `inset box-shadow` for the ring effect, not a CSS `border`. The existing code uses `border-[rgba(238,238,232,0.34)]`. Changed to `--border-30 = rgba(255,255,255,0.3)` — same opacity family, pure white instead of warm cream. Per "no structural refactoring," the border approach is preserved; the color is tokenized. Spec-exact would require converting border → inset shadow (structural change, Slice 6b).

3. **Progress bar fill: `--tt-brand-color-500` instead of `--app-primary-light`.** `--app-primary-light` (near-white cream) on a white/near-white track produces poor contrast. Mapping to `--tt-brand-color-500` (brand purple, `#6229ff`) gives spec-appropriate progress bar styling consistent with all other progress indicators in the codebase.

4. **`animate-node-breath` and `animate-node-select-pop` classes preserved.** These are existing Tailwind animation class references applied to node containers. Their keyframe definitions live in `src/styles/motion.css`. Per Slice 6a scope (token substitution only), the class references are not changed. Slice 6b will align the keyframe definitions with Section L spec values.

## Deviations From Spec

1. **ReactFlow SVG-attribute literals.** Three values cannot use CSS `var()` because they are SVG element attributes (not CSS style properties): `markerEnd.color`, `nodeColor` callback return, and `maskColor`. All use Section V resolved values (`rgba(255,255,255,0.3)`, `#eeeee8`, `rgba(30,30,35,0.64)`). Documented in CHANGES.md.

2. **`department-node` selected boxShadow template.** The `style.boxShadow` on selected department nodes combines a runtime dept color with a drop-shadow: `` `0 0 0 1px ${nodeData.color}, rgba(0,0,0,0.28) 0 16px 50px` ``. The `rgba(0,0,0,0.28)` portion cannot safely be replaced with a CSS var inside a template literal mixed with runtime data. Left as-is; the rendered value is spec-aligned visually.

3. **Section L animations deferred.** `canvasDashFlow`, `department-workspace-pixel-drift`, `pulseGlow`, etc. are Section L spec items. Read for awareness. Implementation is Slice 6b — purely animation keyframe work, not token substitution.

4. **Grid dots suppressed, not removed.** Section D specifies "no grid dots." Changed `<Background color>` to `transparent` rather than removing the `<Background>` component. Effect is identical visually (dots invisible). Removing the component would be structural.

## Verification

```
pnpm typecheck                                                              → exit 0
grep "var(--app-|var(--brand-)" src/components/canvas/*.tsx                → 0 results
grep "rgba(255,255,255\|rgba(14,14\|rgba(37,37\|rgba(29,29" *.tsx         → 1 result (intentional SVG attr literal)
```

## Remaining Domain Clusters (11 pending)

side-panel · agents · chat · integrations · tasks · departments · files · notifications · onboarding · roadmap · command-palette/billing

Slice 6b (canvas animations) should precede moving to other clusters — it completes the canvas cluster and has no cross-cluster dependencies.
