import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

/** Migration folder names in the order they apply. */
export function migrationIds(migrationsDir = resolve("prisma", "migrations")): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Apply every migration's SQL, in order, to an empty Postgres database. Used to build the test template
 * database quickly; real environments use `prisma migrate deploy` (`pnpm db:migrate`), which also keeps
 * Prisma's migration ledger.
 */
export async function applyMigrationSql(connectionString: string, migrationsDir = resolve("prisma", "migrations")): Promise<string[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const ids = migrationIds(migrationsDir);
    for (const id of ids) {
      await client.query(readFileSync(resolve(migrationsDir, id, "migration.sql"), "utf8"));
    }
    return ids;
  } finally {
    await client.end();
  }
}
