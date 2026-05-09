import Database from "better-sqlite3";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const databasePath = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;
const resolvedDatabasePath = resolve("prisma", databasePath);
const migrationPath = resolve("prisma", "migrations", "20260508000000_init", "migration.sql");

mkdirSync(dirname(resolvedDatabasePath), { recursive: true });

const db = new Database(resolvedDatabasePath);
const migrationSql = readFileSync(migrationPath, "utf8");

db.exec("PRAGMA foreign_keys = OFF;");
db.exec(migrationSql);
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS "_local_migrations" (
    id TEXT NOT NULL PRIMARY KEY,
    appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
db.prepare("INSERT OR REPLACE INTO _local_migrations (id) VALUES (?)").run("20260508000000_init");
db.close();

writeFileSync(resolve("prisma", ".migration-applied"), new Date().toISOString());
console.log(`Applied migration ${migrationPath} to ${resolvedDatabasePath}`);

