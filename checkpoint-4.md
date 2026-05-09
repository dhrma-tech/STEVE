# checkpoint-4.md

## Phase
Execution Phase 3 - Public Website

## Status
Complete.

## What Was Built
- Marketing route group layout with fixed navbar and footer.
- Homepage `/` with original CSS pixel-art hero, rotating notification pills, platform/orbit preview, value props, how-to chapter grid, roadmap preview, engineering demo, sales/marketing demo, scale demo, tools carousel, industry wordsearch, stats, and footer CTA.
- Pricing `/pricing` with three plan cards, cost calculator, feature comparison table, data graduation note, and 8-topic FAQ accordion.
- Pricing API at `/api/pricing/calculate`.
- Resources `/resources` and launch post `/resources/introducing-cofounder-2`.
- How-to routes `/how-to/start`, `/how-to/build`, `/how-to/sell`, and `/how-to/scale`, each with all required TOC topics, sticky desktop TOC, mobile `<details>` TOC, chapter art, callouts, progress indicator, and download CTA.
- Legal/docs routes: `/privacy-policy`, `/terms`, `/terms-of-service` redirect, and `/docs`.
- Registered all Phase 3 marketing components in `REGISTRY.md`.

## Verification Pass
| Requirement | Status | Notes |
|---|---|---|
| Every public route in product spec exists | built | Build output includes `/`, `/pricing`, `/resources`, launch post, 4 how-to routes, `/privacy-policy`, `/terms`, `/terms-of-service`, and `/docs`. |
| CTAs route correctly | built | Public CTAs point to `/login` for app entry or `/resources/introducing-cofounder-2` for launch content; `/docs` CTAs route internally. `/login` is intentionally built in Phase 4. |
| Pricing calculator computes category breakdown | built | `/api/pricing/calculate?plan=pro&businessSize=5` returns included usage, agents, token, compute, database, support, ad spend, data purchasing, subtotal, and total. |
| How-to pages include all listed TOC sections | built | Start, Build, Sell, and Scale use source-listed topics from `src/data/how-to-content.ts`. |
| Mobile menu works | built | Playwright opened the mobile menu and verified the Pricing link is visible. |
| SEO metadata present | built | Public pages define route metadata for title and description. |
| No copied proprietary assets | built | Visuals are original CSS pixel-art/interface mockups. Logged in DECISION-20. |
| Desktop routes smoke-tested | built | Playwright checked all public pages at 1440x1000: 200 status, one H1, no horizontal overflow. |
| Mobile routes smoke-tested | built | Playwright checked all public pages at 390x844: 200 status, one H1, no horizontal overflow. |
| Terms alias redirects | built | `curl -I /terms-of-service` returns 307 to `/terms`. |
| TypeScript and lint pass | built | `pnpm verify` passed. |
| Production build passes | built | `pnpm build` passed after clearing generated cache and pruning pnpm store. |
| Dev server available | built | `http://127.0.0.1:3000/` returns 200. |

## Assumptions Made This Phase
- [ASSUMPTION-09] Pricing formulas are sandbox estimates because exact source math is absent.
- [ASSUMPTION-10] Legal and docs pages are content shells derived from named product surfaces because exact reviewed copy is absent.

## Deviations From Plan
- `/terms-of-service` is implemented as a route handler redirect rather than a page component so it returns an actual 307 redirect instead of a meta-refresh page.
- Next typed routes were disabled because Phase 3 must include CTAs to `/login`, which is built in Phase 4.
- A production build initially failed with `ENOSPC`; `.next` output was removed and the pnpm store was pruned before rebuilding successfully.

## Decisions Added
- [DECISION-19] Disable Next typed routes during phase-gated implementation.
- [DECISION-20] Use original CSS pixel-art and interface mockups for public visuals.
- [DECISION-21] Use `/terms` as canonical and redirect `/terms-of-service`.
- [ASSUMPTION-09] Pricing calculator formulas are sandbox estimates.
- [ASSUMPTION-10] Legal and docs pages are content shells.

## Open Questions Raised
- [QUESTION-14] Pricing calculator exact formulas are not provided.
- [QUESTION-15] Exact legal and documentation copy is not provided.

## What The Next Phase Depends On
- Re-read `SCRATCHPAD.md`, this checkpoint, `REGISTRY.md`, `docs/product-spec.md`, `docs/source-analysis.md`, `docs/api-spec.md`, and Execution Phase 4 in `docs/implementation-plan.md`.
- Build `/login`, `/onboarding`, `/org/[orgId]/onboarding`, auth/session APIs, sandbox login, GitHub-ready auth surfaces, personal onboarding, company onboarding, department activation, and design onboarding.
