# CLAUDE.md — STEVE Frontend Redesign

> Last updated: 2026-10-02 — repo cleaned and docs reorganised; full frontend redesign starting.
> Read this before touching any file in this session.

---

## Project identity

This is **STEVE** — a full Cofounder.co clone built over 17 phases. Product is functionally complete. The current work is a **complete frontend redesign**, designed in Claude Design and implemented here. Features, functionality and backend stay exactly as they are; only the UI changes.

---

## Current work — frontend redesign (Claude Design)

**Workflow:** design system lives in a Claude Design design-system project → screens are designed there one area at a time → each design link is handed over here and implemented → component changes sync back to the design system.

**Order:** design system → app shell + Canvas → Mission Control → Settings → Onboarding → Marketing.

### Frontend-only boundary (enforced by a PreToolUse hook)

Hook: `.claude/settings.json` → `.claude/hooks/frontend-guard.js` (local only — `.claude/` is gitignored). It blocks Edit/Write outside the allowed paths, including `route.ts` and `action(s).ts` files under `src/app`. To pause it, run `/hooks` and disable it, or set `"disableAllHooks": true` in `.claude/settings.local.json`.

| Can change | Can't change |
|---|---|
| `src/components/**` | `src/lib/**` |
| `src/styles/**` | `src/app/api/**` |
| `src/app/**/page.tsx`, `layout.tsx` (markup only) | `prisma/**` |
| `public/**` | `src/data/**`, data loading, server actions |
| `CLAUDE.md`, design docs | Props/contracts sent to the backend, route URLs |

Inside allowed files: keep every data fetch, handler, API call, query param and prop contract intact. Restyle and restructure the markup around them.

### Redesign rules

1. **Frontend only.** No backend, API, schema, data-loading or routing changes. Every existing feature must still work.
2. **Structural changes allowed** in the UI (layouts, page composition, components). The old "re-skin only" rule (DECISION-62/63) and the "marketing locked" rule are lifted for the redesign.
3. **Design system first.** Tokens and primitives come from the Claude Design design-system project; screens use them, not one-off values.
4. **No hardcoded values** — colors, shadows, spacing, easing → tokens.
5. **One area per slice.** Typecheck after each, compare against the design, stop and report.
6. Every state gets designed and built: empty, loading, error, mobile.

---

## Repository map

| Path | What |
|---|---|
| `src/app/` | Routes: `(marketing)`, `(auth)`, `org/[orgId]/…`, `api/` |
| `src/components/` | UI by feature; `ui/` = primitives |
| `src/lib/` | Domain logic (agents, ai, policy, automations, security…) — off-limits during redesign |
| `src/styles/` | `tokens.css`, `animations.css`, `motion.css`, `globals.css` |
| `docs/` | Index at `docs/README.md` — product, architecture, design, runbook, decision log |
| `docs/decisions.md` | Decision log. `DECISION-NN` references in code/docs point here (latest: DECISION-65) |
| `docs/architecture/agent-orchestration.md` | The multi-agent system spec + per-phase notes (§12) incl. what was deferred |

Housekeeping (2026-10-02): checkpoints, phase plans, scratchpad, registry, slice change logs, status/gap reports and phase smoke-test artifacts were deleted — they're in git history (commit `d5b4dbe` and earlier) if ever needed. `report100.txt` (the A–V spec referenced in `tokens.css`, `animations.css`, `z-index.ts` comments) is **not in the repo**; treat those section letters as historical labels.

---

## Project history (short)

1. **17-phase build** — full Cofounder.co clone (marketing, auth, onboarding, canvas, departments, roadmap, tasks, agents, chat, files, settings, billing, integrations).
2. **Token overhaul, slices 1–17** — every cluster migrated to Section V tokens; complete.
3. **Multi-agent system** — v1 (router, tools, runner, streaming, approvals, memory) then v2 orchestration phases 0–10 (run service, policy engine, Postgres + pg-boss queue, delegation, orchestrator, shared memory, Mission Control, model tiers + evals, schedules/triggers/public API, vault/OAuth/rate limits/audit). Built on stacked branches up to `phase-10-hardening`; **not merged to `main`**.
4. **Frontend redesign** — current work (above).

---

## Open items (not redesign work — don't fix during UI slices)

**Needs credentials / external action**
- Provider credentials: GitHub OAuth, Stripe, Vercel, Supabase, Postiz, S3. Code paths exist; sandbox adapters run when keys are absent.
- No live agent run or live eval with a real `ANTHROPIC_API_KEY` yet.
- No real OAuth round trip with any provider. Supabase still needs the service role key pasted; Vercel installs may need team id.
- Licensed fonts (Departure Mono, ppmondwest/Neoris) — currently fallbacks (DECISION-03).
- Legal review of `/privacy-policy` and `/terms` (current copy is unreviewed default text).

**Deferred by design (agent system)**
- Plain chat (`/api/ai/chat`) and onboarding idea/branding generators still call local Ollama, not the model tiers.
- Embeddings for knowledge search; metrics computed on read (no metrics store); cloud KMS adapter (seam only).
- Run detail lacks file/code diffs; no retry-from-middle-step; no role editor UI; no people as plan owners.
- No WhatsApp/mobile push, no approve-from-Slack, no native Svix verification for Resend inbound.
- Rate limits cover only expensive/sensitive routes; scheduled backups rely on the host scheduler.

---

## Design system foundation (pre-redesign baseline)

### Token layer (`src/styles/tokens.css`)
319 Section V dark tokens + Section B light tokens + legacy `:root` shim. Additional named tokens: `--border-subtle`, `--background-settings`. **Legacy shim is partially retired:** dead `--app-*`, `--brand-*`, `--warning`, `--danger` aliases were deleted (zero consumers). Still live and kept: `--terminal-*`, `--color-*`, `--hero-blue`, `--feature-blue-*`, `--running`, `--success`, `--caret`.

### Animation layer (`src/styles/animations.css`)
36 Section L keyframes + utility classes. Wired so far: `canvasDashFlow` (orbital edges), `animate-agent-pulse` (running agents), `animate-agent-cue-pop` (workspace dialog), `animate-typing-dot` (chat typing indicator), `animate-attention-slide-up` + `animate-attention-item` (inbox panel/items).

### Z-index (`src/lib/z-index.ts`) — Section S complete, 17 constants.

---

## Token migration cheat sheet

| Legacy | Section V |
|---|---|
| `--app-border` | `--border-10` |
| `--app-text` | `--foreground-80` |
| `--app-text-50` | `--foreground-50` |
| `--app-canvas` | `--background` |
| `--app-panel` | `--background-sidepanel` |
| `--app-black-base` | `--card` |
| `--app-primary-light` (icons/text) | `--foreground-80` |
| `--app-primary-light` (selected border) | `--primary` |
| `--app-primary-light` (links) | `--tt-color-text-blue` |
| `--brand-300` focus rings | `--focused` |
| `--danger` | `--destructive` |
| `--warning` | `--alert` |
| `rgba(255,255,255,0.03/.04)` | `--foreground-3` |
| `rgba(255,255,255,0.05/.06)` | `--foreground-5` |
| `rgba(255,255,255,0.07/.08)` | `--foreground-8` |
| `rgba(255,255,255,0.10/.12)` | `--foreground-10` |
| `rgba(0,0,0,0.12)` | `--foreground-inverse-10` |
| `rgba(0,0,0,0.16)` | `--foreground-inverse-20` |
| `rgba(239,68,68,0.36/.12)` | `--tt-color-text-red-contrast` (border+bg) + `--destructive` (text) |
| `rgba(245,158,11,0.38/.1)` | `--tt-color-text-yellow-contrast` (border+bg) + `--alert` (text) |
| `text-red-100` | `text-[var(--destructive)]` |
| `#ffd27c` | `var(--alert)` |
| `#9df0b4` | `var(--tt-color-text-green-contrast)` |
| Glass bgs `rgba(…,0.72–0.92)` | `--background-l0-{80,85}` |
| `bg-black/35` | `--foreground-inverse-30` |
| Node shadows | `--shadow-dept-agent-node-dark` |
| Panel shadows | `--shadow-outset-100`, `--tt-shadow-elevated-md` |
| z-index values | import from `src/lib/z-index.ts` |

---

## Carried-over token rules

1. **Legacy `:root` shim:** remaining live aliases migrate only when their consumers do.
2. **SVG attribute values** use resolved literals (DECISION-60).
3. **z-index** values come from `src/lib/z-index.ts`, never inline.

---

## Housekeeping rules

- Don't create checkpoint, scratchpad or per-phase status files in the repo root. Progress lives in this file (short) and in git commits.
- New docs go under `docs/` in the matching folder and get a line in `docs/README.md`.
- Decisions get a new `DECISION-NN` entry in `docs/decisions.md`.
