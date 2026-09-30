/**
 * `pnpm db:import-sqlite [path/to/dev.db]`: copy every row from the old SQLite database into the Postgres at
 * DATABASE_URL. Run it once, after `pnpm db:migrate`, against an empty database. The SQLite file is only read.
 *
 * Foreign keys are checked by Postgres as usual, so rows go in parent-first; a table that is not in the Postgres
 * schema is skipped with a note. Finished runs are marked as closed out so the sweeper does not redo them.
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { databaseUrl } from "../src/lib/db/url";

type Column = { name: string; type: string };

const sqlitePath = resolve(process.argv[2] ?? "prisma/dev.db");

function toValue(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return null;
  if (type.startsWith("timestamp")) {
    const date = typeof value === "number" || /^\d+$/.test(String(value)) ? new Date(Number(value)) : new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new Error(`Not a date: ${String(value)}`);
    // Prisma keeps UTC in `timestamp(3)` columns.
    return date.toISOString().replace("T", " ").replace("Z", "");
  }
  if (type === "boolean") return value === 1 || value === "1" || value === true || value === "true";
  if (type === "integer" || type === "bigint") return Math.trunc(Number(value));
  if (type === "double precision" || type === "real" || type === "numeric") return Number(value);
  return typeof value === "string" ? value : String(value);
}

/** Tables ordered so every table comes after the tables its foreign keys point at. */
async function tableOrder(client: pg.Client): Promise<string[]> {
  const tables = (
    await client.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'")
  ).rows.map((row) => row.tablename);
  const deps = new Map<string, Set<string>>(tables.map((table) => [table, new Set<string>()]));
  const fks = await client.query<{ child: string; parent: string }>(`
    SELECT tc.table_name AS child, ccu.table_name AS parent
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`);
  for (const { child, parent } of fks.rows) if (child !== parent) deps.get(child)?.add(parent);

  const ordered: string[] = [];
  const done = new Set<string>();
  const visit = (table: string, path: Set<string>) => {
    if (done.has(table) || path.has(table)) return;
    path.add(table);
    for (const parent of deps.get(table) ?? []) visit(parent, path);
    path.delete(table);
    done.add(table);
    ordered.push(table);
  };
  for (const table of tables) visit(table, new Set());
  return ordered;
}

/** Self-referencing tables (folders, sessions) need parents inserted before children. */
function sortSelfReferencing(table: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const parentKey = table === "Folder" ? "parentFolderId" : table === "TaskSession" ? "parentSessionId" : null;
  if (!parentKey) return rows;
  const byId = new Map(rows.map((row) => [row.id, row]));
  const out: Record<string, unknown>[] = [];
  const seen = new Set<unknown>();
  const place = (row: Record<string, unknown>, depth = 0) => {
    if (seen.has(row.id) || depth > 50) return;
    const parent = row[parentKey] ? byId.get(row[parentKey]) : undefined;
    if (parent) place(parent, depth + 1);
    seen.add(row.id);
    out.push(row);
  };
  for (const row of rows) place(row);
  return out;
}

async function main() {
  if (!existsSync(sqlitePath)) throw new Error(`No SQLite database at ${sqlitePath}`);
  const sqlite = new Database(sqlitePath, { readonly: true });
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();

  try {
    const sqliteTables = new Set(
      (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name)
    );
    const order = await tableOrder(client);

    const nonEmpty: string[] = [];
    for (const table of order) {
      if (Number((await client.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n) > 0) nonEmpty.push(table);
    }
    if (nonEmpty.length > 0) throw new Error(`The Postgres database is not empty (${nonEmpty.join(", ")}). Import into a fresh database.`);

    await client.query("BEGIN");
    let total = 0;
    for (const table of order) {
      if (!sqliteTables.has(table)) {
        console.log(`  ${table}: not in the SQLite database, skipped`);
        continue;
      }
      const columns = (
        await client.query<Column>(
          "SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
          [table]
        )
      ).rows;
      const sqliteColumns = new Set((sqlite.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map((c) => c.name));
      const shared = columns.filter((column) => sqliteColumns.has(column.name));

      let rows = sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
      rows = sortSelfReferencing(table, rows);
      for (const row of rows) {
        const names = shared.map((c) => `"${c.name}"`).join(", ");
        const params = shared.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(
          `INSERT INTO "${table}" (${names}) VALUES (${params})`,
          shared.map((column) => toValue(row[column.name], column.type))
        );
      }
      total += rows.length;
      console.log(`  ${table}: ${rows.length}`);
    }
    // Runs that already ended were closed out by the old runtime.
    await client.query(`UPDATE "Run" SET "closedOutAt" = COALESCE("finishedAt", "updatedAt") WHERE "status" IN ('completed', 'failed', 'cancelled')`);
    await client.query("COMMIT");
    console.log(`Imported ${total} rows from ${sqlitePath}.`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
    sqlite.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
