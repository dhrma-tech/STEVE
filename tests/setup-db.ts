import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";
import { applyMigrations } from "../prisma/migrate-lib";

// Every test file gets its own real SQLite database with the real migrations applied, so queue, lease and
// atomic-update behavior is exercised against real SQL. It is deleted when the file's tests finish.
const dir = mkdtempSync(join(tmpdir(), "steve-test-"));
const databasePath = join(dir, "test.db").split("\\").join("/");

applyMigrations({ databasePath, backup: false });
process.env.DATABASE_URL = `file:${databasePath}`;
process.env.STEVE_TEST_DB_PATH = databasePath;

afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* Windows may still hold the file for a moment; the OS temp cleaner will get it */
  }
});
