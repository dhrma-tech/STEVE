# STEVE

An AI company operating system. A founder describes an idea, STEVE generates a business plan and brand kit, and a team of department agents (engineering, marketing, sales, and more) plans and executes the work on a live canvas, with approvals, budgets and a full audit trail.

Built with Next.js (App Router), TypeScript, Tailwind, Prisma on Postgres, pg-boss and the Claude API.

## Getting started

```bash
pnpm install
cp .env.example .env      # fill in the values you need
pnpm db:local             # optional: local Postgres in .pgdata/
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev                  # app on http://localhost:3000
pnpm worker               # agent job worker (separate terminal)
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js dev server, production build, production server |
| `pnpm worker` | Runs the agent job worker |
| `pnpm verify` | Typecheck + lint + tests (what CI runs) |
| `pnpm typecheck` · `lint` · `test` | Individual checks |
| `pnpm eval` / `eval:live` | Agent evals (scripted / against the real API) |
| `pnpm db:migrate` · `db:seed` · `db:backup` | Database migrations, seed data, backup |
| `pnpm secrets:rotate` | Re-encrypt stored credentials with a new master key |

## Project structure

```
src/
  app/          Routes: (marketing), (auth), org/[orgId]/…, api/
  components/   UI grouped by feature (canvas, agents, chat, mission, settings…); ui/ holds primitives
  lib/          Domain logic by feature (agents, ai, automations, security, observability…)
  data/         Static seed/config data (departments, agents)
  styles/       tokens.css, animations.css, motion.css, globals.css
  worker/       Agent job worker entry point
prisma/         Schema, migrations, seed
scripts/        DB, eval and secrets tooling
tests/          Test DB setup
docs/           Product, architecture, design and ops docs
public/         Static media
```

## Documentation

See [docs/README.md](docs/README.md).
