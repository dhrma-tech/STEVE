import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyMigrations } from "./migrate-lib";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const databasePath = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;
const resolvedDatabasePath = resolve("prisma", databasePath);

const result = applyMigrations({ databasePath: resolvedDatabasePath, log: (message) => console.log(message) });

if (!result.upToDate) {
  writeFileSync(resolve("prisma", ".migration-applied"), new Date().toISOString());
  console.log(`Database ready: ${resolvedDatabasePath}`);
}
