# checkpoint-3.md

## Phase
Execution Phase 2 - Design System

## Status
Complete.

## What Was Built
- Loaded font variables for Plus Jakarta Sans, Figtree, IBM Plex Mono, and Pixelify Sans through `next/font/google`.
- Expanded CSS token coverage for marketing, app, feature-blue, app glass, caret, font, and motion tokens.
- Added the required motion keyframes and reduced-motion CSS handling.
- Built base UI primitives under `src/components/ui`.
- Built local motion primitives under `src/components/motion`.
- Created `src/lib/design/tokens.ts` as the typed token mirror.
- Created `REGISTRY.md` with every built component, status, file path, and planned usage.

## Verification Pass
| Requirement | Status | Notes |
|---|---|---|
| Tokens match `docs/design-system.md` | built | CSS variables and `src/lib/design/tokens.ts` cover marketing/app colors, radii, blur, type, breakpoints, and motion duration tokens. |
| Fonts implemented | built | Plus Jakarta Sans, Figtree, IBM Plex Mono, and Pixelify Sans load via `next/font/google`; Departure Mono absence is logged as [ASSUMPTION-08]. |
| Base components are responsive and accessible | built | Radix powers dialogs, menus, tabs, accordion, select, switch/toggle, slider, avatar, tooltip, and progress. Form fields include labels/descriptions/errors; icon buttons include labels/tooltips. |
| Marketing button styles exist | built | `Button` supports light surface and dark gradient CTA variants. |
| Hero notification pill exists | built | `HeroNotificationPill` implements the verified white translucent glass pill dimensions and blur. |
| Pricing card primitive exists | built | `PricingCard` implements the responsive 350px marketing card and highlighted wrapper. |
| Feature callout exists | built | `FeatureCallout` implements the blue callout primitive. |
| App panel/card primitives exist | built | `AppPanel`, `AppViewport`, and `AppSplit` cover the dark app surface and split layout. |
| Modal/confirmation primitives exist | built | `Dialog` wrappers and `ConfirmationDialog` are available for destructive flows. |
| Status badge system exists | built | `Badge` and `StatusBadge` cover task/run states. |
| Responsive app/public containers exist | built | `MarketingContainer`, `MarketingNavContainer`, `AppViewport`, and `AppSplit` are registered. |
| Reduced motion supported | built | CSS `prefers-reduced-motion` disables nonessential motion; Framer wrappers check `useReducedMotion`. |
| `REGISTRY.md` lists every component with status and planned usage | built | Registry created at repo root. |
| No duplicate component abstractions | built | All Phase 2 primitives compose from the registry and Radix where behavior is interactive. |
| TypeScript compiles | built | `pnpm typecheck` passed. |
| Lint passes | built | `pnpm lint` passed. |
| Production build passes | built | `pnpm build` passed. |
| Health endpoint still works | built | `GET http://127.0.0.1:3000/api/health` returned `{ ok: true }`. |

## Assumptions Made This Phase
- [ASSUMPTION-08] Departure Mono is kept in the CSS stack for future licensed asset insertion; IBM Plex Mono is the loaded fallback.

## Deviations From Plan
- Added `src/components/ui/container.tsx` and `src/components/ui/hero-notification-pill.tsx` in addition to the explicit file list because Phase 2 requires responsive containers and the verified hero notification pill primitive.

## Decisions Added
- [DECISION-16] Use Radix UI primitives for interactive controls.
- [DECISION-17] Use `lucide-react` as the icon set.
- [DECISION-18] Use `framer-motion` behind local motion wrappers.
- [ASSUMPTION-08] Font fallback strategy for missing Departure Mono.

## Open Questions Raised
- [QUESTION-13] Departure Mono is named in the notes, but no licensed local font file is present.

## What The Next Phase Depends On
- Re-read `SCRATCHPAD.md`, this checkpoint, `REGISTRY.md`, `docs/product-spec.md`, `docs/source-analysis.md`, and Execution Phase 3 in `docs/implementation-plan.md`.
- Build public website routes using registered components and original/generated visual assets.
