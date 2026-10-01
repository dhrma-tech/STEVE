/**
 * `pnpm db:backup`: a compressed, restorable dump of the database (pg_dump custom format).
 *
 *   BACKUP_DIR   where dumps go (default ./backups, git-ignored)
 *   BACKUP_KEEP  how many dumps to keep (default 14; older ones are deleted)
 *   PG_DUMP      path to pg_dump (default: pg_dump on PATH, else the newest C:\Program Files\PostgreSQL\<v>\bin)
 *
 * pg_dump must be the same major version as the server or newer. Restore (see docs/runbook.md):
 *   pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" backups/steve-<time>.dump
 *
 * Schedule it (cron, Task Scheduler, or your host's job runner) and copy the files off the machine; a managed
 * Postgres (Supabase, RDS, Neon) also keeps its own point-in-time backups, which this complements.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import "./load-env";
import { databaseUrl } from "../src/lib/db/url";

function findPgDump(): string {
  if (process.env.PG_DUMP?.trim()) return process.env.PG_DUMP.trim();
  const onPath = spawnSync(process.platform === "win32" ? "where" : "which", ["pg_dump"], { encoding: "utf8" });
  if (onPath.status === 0 && onPath.stdout.trim()) return onPath.stdout.trim().split(/\r?\n/)[0];
  const root = "C:\Program Files\PostgreSQL";
  if (process.platform === "win32" && existsSync(root)) {
    const versions = readdirSync(root).filter((v) => existsSync(join(root, v, "bin", "pg_dump.exe"))).sort((a, b) => Number(b) - Number(a));
    if (versions[0]) return join(root, versions[0], "bin", "pg_dump.exe");
  }
  throw new Error("pg_dump not found. Install the PostgreSQL client tools or set PG_DUMP.");
}

function main() {
  const url = databaseUrl();
  const dir = resolve(process.env.BACKUP_DIR ?? "backups");
  const keep = Math.max(1, Number(process.env.BACKUP_KEEP ?? 14) || 14);
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = join(dir, `steve-${stamp}.dump`);
  const pgDump = findPgDump();

  console.log(`Backing up to ${file} with ${pgDump} ...`);
  const result = spawnSync(pgDump, ["--format=custom", "--compress=6", "--no-owner", `--file=${file}`, url], { stdio: "inherit" });
  if (result.status !== 0) {
    if (existsSync(file)) unlinkSync(file);
    throw new Error(`pg_dump exited with ${result.status ?? result.error?.message}. (It must be the server's major version or newer.)`);
  }
  console.log(`Done: ${(statSync(file).size / 1024 / 1024).toFixed(1)} MB.`);

  const dumps = readdirSync(dir).filter((name) => /^steve-.*\.dump$/.test(name)).sort().reverse();
  for (const old of dumps.slice(keep)) {
    unlinkSync(join(dir, old));
    console.log(`Removed old backup ${old}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
