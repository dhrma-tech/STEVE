# checkpoint-slice-17.md

## Phase
Slice 17 — Departments Cluster (Section A / G / L / P) — FINAL SLICE

## Status
Complete. `pnpm typecheck` exits 0. Zero legacy refs across all 6 department files.
**17/17 slices complete. Overhaul 100% done.**

## Files Changed
- `src/components/departments/department-board.tsx` (8 token passes)
- `src/components/departments/department-context-tabs.tsx` (6 token passes)
- `src/components/departments/department-cover.tsx` (full rewrite: token migration + pixel-drift DOM)
- `src/components/departments/department-detail-panel.tsx` (7 token passes)
- `src/components/departments/department-roadmap-strip.tsx` (3 token passes)
- `src/components/departments/department-sections.tsx` (8 token passes)
- `REGISTRY.md`, `CHANGES.md`, `checkpoint-slice-17.md`

## Token Migration Map

| Legacy | Section V | Context |
|---|---|---|
| `--app-border` | `--border-10` | All card/section/accordion borders |
| `--app-text` | `--foreground-80` | Primary text, ghost button text |
| `--app-text-50` | `--foreground-50` | Labels, descriptions, metadata |
| `--app-primary-light` | `--foreground-80` | Section icons, file icons |
| `rgba(255,255,255,0.04)` | `var(--foreground-3)` | Card/section bgs |
| `rgba(255,255,255,0.06)` | `var(--foreground-5)` | Ghost button hover |
| `rgba(255,255,255,0.07)` | `var(--foreground-8)` | Icon badge bgs |
| `rgba(0,0,0,0.12)` | `var(--foreground-inverse-10)` | Metric/detail inner panel bgs |
| `shadow-[rgba(0,0,0,0.24)_0_18px_48px]` | `shadow-[var(--tt-shadow-elevated-md)]` | Cover card elevation shadow |

## Structural Work: Pixel-Drift Particle DOM

### Deterministic particle generator

Two module-level helpers in `department-cover.tsx`:

```ts
function hashCode(str: string): number
  // LCG: maps slug string to unsigned 32-bit integer seed
  // h = (31 * h + charCode) | 0 iterated over each character

function lcg(seed: number): () => number
  // LCG: (seed * 1664525 + 1013904223) >>> 0 / 0xffffffff
  // Returns next value in [0, 1) range
  // Parameters: Numerical Recipes c=1013904223, a=1664525
```

**Why deterministic:** `Math.random()` would differ between server and client renders, causing hydration mismatches. The slug-seeded LCG produces the same 15 particles every time for a given department slug — stable SSR/hydration.

### Particle DOM structure

```tsx
// Ambient wave overlay (grid pattern drifts ±7px horizontally)
<div aria-hidden="true"
  className="animate-pixel-wave absolute inset-0 opacity-70"
  style={{ backgroundImage: "...", backgroundSize: "22px 22px" }}
/>

// Particle container
<div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
  {particles.map((p) => (
    <div
      key={p.id}
      className="animate-pixel-drift absolute size-[2px] rounded-sm bg-white"
      style={{
        left: `${p.x.toFixed(1)}%`,
        top: `${p.y.toFixed(1)}%`,
        animationDelay: `${p.delay}s`,
        "--department-pixel-start-x": `${p.startX}px`,
        "--department-pixel-start-y": `${p.startY}px`,
        "--department-pixel-dim-opacity": String(p.dimOpacity),
        "--department-pixel-bright-opacity": String(p.brightOpacity),
      } as React.CSSProperties}
    />
  ))}
</div>
```

### Particle parameter ranges (15 particles per cover)

| Property | Range | Distribution |
|---|---|---|
| `left` | 4%–92% | uniform (seeded) |
| `top` | 8%–84% | uniform (seeded) |
| `--department-pixel-start-x` | ±4px | uniform ±4 |
| `--department-pixel-start-y` | ±3px | uniform ±3 |
| `--department-pixel-dim-opacity` | 0.10–0.30 | uniform |
| `--department-pixel-bright-opacity` | 0.50–0.80 | uniform |
| `animationDelay` | 0–5s | uniform |

### Animation wiring

- `.animate-pixel-drift` → `department-workspace-pixel-drift` (6s, alternate, infinite) — per particle
- `.animate-pixel-wave` → `department-workspace-pixel-ambient-wave` (12s, ease-in-out, infinite) — grid overlay

Both utility classes and keyframes were already registered in `animations.css` (Slice 6b). Slice 17 only wires the DOM.

## Department Accent Colors (Section A)

`--department-accent` CSS custom property wired via `getDepartmentVisual(slug).cover.accent` with override from the `color` prop. This was already spec-aligned before Slice 17 — each department has a unique accent color set by the data layer. No token changes needed.

`text-white/62`, `text-white/14`, `text-white/50` in the cover content area are Tailwind opacity utilities on white — design-specific for the colored cover backgrounds, not legacy tokens.

## Assumptions Made

1. **`DepartmentCover` is a server component.** No `"use client"` directive. The LCG is computed in the render body without React hooks — stable across SSR and client hydration.

2. **`shadow-[rgba(0,0,0,0.24)_0_18px_48px]` → `--tt-shadow-elevated-md`.** The cover card shadow is a multi-layer elevated shadow. Per the cheat sheet: panel shadows → `--tt-shadow-elevated-md`. The value `rgba(0,0,0,0.24) 0 18px 48px` is a large elevated shadow, consistent with the `--tt-shadow-elevated-md` semantic.

3. **`animate-pixel-wave` on existing grid div (not a new div).** The ambient wave applies to the grid background, making it drift horizontally — exactly what "ambient pixel overlay on dept workspace home nodes" means. Adding a new empty div would have no visual effect.

4. **15 particles.** Within the Section P "12–20" recommendation. 15 provides good ambient density without performance overhead.

## Deviations From Spec

None.

## Verification

```
pnpm typecheck                                                                → exit 0
grep var(--app-|var(--brand-|rgba( across departments/                       → 0 results
department-cover.tsx: 15 particle divs + 1 wave overlay
All 6 files: clean
```

## OVERHAUL COMPLETE

All 17 slices done. All surfaces 100% spec-aligned.

| System | Status |
|---|---|
| CSS token system (319 vars) | ✅ Slice 1 |
| Font stack (6 families) | ✅ Slice 1 |
| 21 UI primitives | ✅ Slice 2 |
| Light/dark mode routing | ✅ Slice 3 |
| Marketing (15 pages) | ✅ Slice 3b |
| Settings | ✅ Slice 4 |
| App-shell chrome | ✅ Slice 5 |
| Canvas workspace | ✅ Slice 6a/6b |
| 36 Section L animations | ✅ Slice 6b |
| Agents | ✅ Slice 7 |
| Chat | ✅ Slice 8 |
| Notifications | ✅ Slice 9 |
| Command palette | ✅ Slice 10 |
| Integrations | ✅ Slice 11 |
| Side panel (5 tabs) | ✅ Slice 12 |
| Tasks | ✅ Slice 13 |
| Onboarding | ✅ Slice 14 |
| Roadmap | ✅ Slice 15 |
| Files/Library | ✅ Slice 16 |
| Departments + pixel-drift | ✅ Slice 17 |
