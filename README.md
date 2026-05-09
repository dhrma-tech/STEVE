# STEVE Cofounder Build

This repository is the Cofounder.co-style product build requested from the four source-note documents. The notes are treated as source of truth; `docs/implementation-plan.md` is the execution law.

## Current Status
- Phase 0: deep read complete.
- Phase 1: planning docs complete.
- Execution Phase 1: project setup in progress.

## Local Setup

```bash
pnpm install
copy .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Verification

```bash
pnpm typecheck
pnpm lint
```

## Persistent Build Files
- `SCRATCHPAD.md`
- `OPEN-QUESTIONS.md`
- `DECISIONS.md`
- `checkpoint-*.md`
- `docs/`

