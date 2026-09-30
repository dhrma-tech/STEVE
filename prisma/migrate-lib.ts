import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type MigrateResult = {
  applied: string[];
  upToDate: boolean;
  backupPath: string | null;
  totalMigrations: number;
};

/**
 * Apply every migration in prisma/migrations, in order, to a SQLite database file.
 * Progress is tracked in a `_local_migrations` table. An existing database is backed up first
 * (migrations can redefine tables), and a migration whose change is already present (a database
 * built by other means) is recorded instead of failing.
 */
export function applyMigrations(options: {
  databasePath: string;
  migrationsDir?: string;
  /** Copy an existing database before changing it. Default true. */
  backup?: boolean;
  log?: (message: string) => void;
}): MigrateResult {
  const log = options.log ?? (() => undefined);
  const databasePath = options.databasePath;
  const migrationsDir = options.migrationsDir ?? resolve("prisma", "migrations");

  const migrationIds = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  mkdirSync(dirname(databasePath), { recursive: true });
  const databaseExisted = existsSync(databasePath);

  const readApplied = (): Set<string> => {
    const db = new Database(databasePath);
    try {
      // WAL lets the web server, the worker and the SSE readers use the file at the same time.
      db.pragma("journal_mode = WAL");
      db.exec(`
        CREATE TABLE IF NOT EXISTS "_local_migrations" (
          id TEXT NOT NULL PRIMARY KEY,
          appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const rows = db.prepare("SELECT id FROM _local_migrations").all() as Array<{ id: string }>;
      return new Set(rows.map((row) => row.id));
    } finally {
      db.close();
    }
  };

  const applied = readApplied();
  const pending = migrationIds.filter((id) => !applied.has(id));

  if (pending.length === 0) {
    log(`Database is up to date (${migrationIds.length} migrations): ${databasePath}`);
    return { applied: [], upToDate: true, backupPath: null, totalMigrations: migrationIds.length };
  }

  let backupPath: string | null = null;
  if (databaseExisted && options.backup !== false) {
    backupPath = `${databasePath}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    copyFileSync(databasePath, backupPath);
    log(`Backed up existing database to ${backupPath}`);
  }

  const db = new Database(databasePath);
  const done: string[] = [];
  try {
    for (const id of pending) {
      const sql = readFileSync(resolve(migrationsDir, id, "migration.sql"), "utf8");
      db.exec("PRAGMA foreign_keys = OFF;");
      try {
        db.exec(sql);
        log(`Applied migration ${id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/already exists|duplicate column/i.test(message)) {
          log(`Migration ${id} was already present in the schema (${message}); marking as applied.`);
        } else {
          throw error;
        }
      } finally {
        db.exec("PRAGMA foreign_keys = ON;");
      }
      db.prepare("INSERT OR REPLACE INTO _local_migrations (id) VALUES (?)").run(id);
      done.push(id);
    }
  } finally {
    db.close();
  }

  return { applied: done, upToDate: false, backupPath, totalMigrations: migrationIds.length };
}
