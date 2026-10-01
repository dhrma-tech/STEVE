# STEVE incident runbook

For whoever is on call. Each section says how to notice the problem, what to do first, and how to confirm it is fixed.

**Where to look first**
- `/status`: database, agent workers and job queue, in plain words. `/api/health` returns the same as JSON, with HTTP 503 when the database is down. Point your uptime monitor at it.
- Mission Control → **Health**: run success rate, run time, cost per run and by model, approval wait, suspected injections, backup-model turns, limit stops.
- Mission Control → **Security** → Audit log: every agent tool call, approval, and change to policy, credentials, integrations and automations.
- Logs: one JSON line per event in production (`LOG_FORMAT=json`), with `runId`, `sessionId`, `orgId` and `jobId`. Unexpected errors also go to Sentry when `SENTRY_DSN` is set.

---

## 1. Agents are doing something they should not

**First:** stop everything for the affected org. Use Mission Control → **Pause all agents** (owners and admins). Every run stops at its next step and nothing new starts. To stop all orgs at once, set `AGENTS_PAUSED=1` and restart.

**Then:**
- Check the audit log (filter "Agent tool calls") and the run's timeline in Mission Control to see what ran.
- If an outside action was approved by mistake, undo it in that service, then revoke any "always approve" rule (Settings → agent policy).
- If the run read outside content first (a webhook, a web page), look for an `injection_suspected` event. Tainted runs cannot auto-run outside actions, so an outside action that ran was approved by a person.

**Confirm:** no runs are in `running` in Health or Mission Control. Then resume.

## 2. Spend is running away

- Lower the daily budget or the per-run cap (Mission Control → Agent controls), or pause.
- Health → "Cost by model" shows where the money goes. `MODEL_WORKER` / `MODEL_PLANNER` and their `_EFFORT` settings move tiers to cheaper models without a deploy of code.
- A trigger firing in a loop is capped by `TRIGGER_MAX_PER_HOUR` (default 30). Turn the trigger off in Mission Control → Automations.

## 3. Model provider outage

- Each tier has a fallback model (`MODEL_<TIER>_FALLBACK`). Turns move to it automatically after retries, and Health → "Fallback turns" shows it happening.
- If both are down, runs wait (`TransientModelError`) and the job queue retries with backoff. Nothing is lost.
- If it lasts, pause agents so approvals and schedules do not pile up.

## 4. Database down or slow

- `/api/health` returns 503 and `/status` shows Database Down.
- Check the provider's status page and connection limits. Restart app servers if the connection pool is exhausted.
- Runs are durable: when the database returns, the worker sweep re-queues stuck runs and finishes interrupted close-outs. Do not delete `Job` rows by hand.

## 5. Workers stopped (queue backing up)

- `/status` shows "Agent workers: Down" or "Job queue: Degraded" (the oldest due job is more than 5 minutes old).
- With `AGENT_WORKER=external`, start or restart `pnpm worker` processes. Inline workers restart with the web server.
- Jobs whose worker died are re-queued after their lease expires. Runs that failed after 5 attempts are failed with a reason; retry them from Mission Control.

## 6. Webhook flood or abuse

- Inbound endpoints are rate limited (`RATE_LIMIT_HOOK`, default 120 per minute per endpoint) and capped per trigger per hour.
- Rotate the trigger's URL (Automations → **New URL**) and update the sender. Add a signing secret if the trigger has none.
- Public API keys are limited per key (`RATE_LIMIT_API_READ` / `RATE_LIMIT_API_WRITE`). Revoke a misused key in Automations → API.

## 7. A credential leaked

| What leaked | Do this |
|---|---|
| An org's integration token | Revoke it at the provider, reconnect the integration (OAuth or a new key), and check the audit log for `tool.*` calls you do not recognise. |
| A channel URL or webhook signing secret | Delete the channel and create a new one (new secret). |
| A trigger endpoint URL | Rotate it (Automations → **New URL**). |
| A public API key | Revoke it (Automations → API). |
| `SECRETS_MASTER_KEYS` (the master key) | Rotate the master key (section 8) *and* rotate every org credential at its provider, since the stored values could be decrypted. |
| `AUTH_SECRET` | Change it. All sessions and one-tap links stop working. If `SECRETS_MASTER_KEYS` is not set, the vault key is derived from `AUTH_SECRET`: set `SECRETS_MASTER_KEYS` first (with the old derived key still readable, see section 8), run `pnpm secrets:rotate`, then change `AUTH_SECRET`. |

## 8. Rotate the master key

1. Generate a key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
2. Put it first in the key ring, keeping the old key: `SECRETS_MASTER_KEYS="k2:<new>,k1:<old>"`. Moving off the derived default? Keep reading old values with `SECRETS_ENCRYPTION_KEY` set as before, or derive from `AUTH_SECRET`, until rotation finishes.
3. Deploy, then run `pnpm secrets:rotate`. It re-encrypts every stored secret with the new key and reports how many it changed and how many it could not read.
4. When it reports 0 unreadable values, remove the old key from `SECRETS_MASTER_KEYS` and deploy again.

The same command also moves credentials that older versions kept in plain integration settings into the vault.

## 9. Backups and restore

- **Backups:** run `pnpm db:backup` on a schedule (cron, Task Scheduler or your host's jobs). It writes `backups/steve-<time>.dump` (compressed, custom format) and keeps the last `BACKUP_KEEP` (default 14). Copy the files off the machine. `pg_dump` must be the server's major version or newer (`PG_DUMP` sets its path). A managed Postgres's own point-in-time recovery is the first line; these dumps are the second.
- **Restore:**
  1. Pause agents and stop workers.
  2. Restore: `pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" backups/steve-<time>.dump`.
  3. Run `pnpm db:migrate`, which applies any migrations newer than the dump.
  4. Start workers. The sweep picks up interrupted runs.
- **Test the restore** into a scratch database once a quarter.

## 10. Data requests

- **Retention:** Mission Control → Security → Data sets how long run activity and webhook events are kept (7, 30, 90 or 365 days). The worker applies it hourly. "Remove email addresses and phone numbers" redacts them before storage from then on; card numbers are always removed.
- **Delete an organization's data:** deleting the organization row cascades to everything it owns (runs, events, tasks, files, secrets, audit log). Take a backup first if you may need it.

## 11. After the incident

Write down what happened, when it was noticed, what fixed it, and what will stop it happening again. Link the relevant audit log entries and runs.
