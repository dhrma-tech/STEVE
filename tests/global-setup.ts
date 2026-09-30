import EmbeddedPostgres from "embedded-postgres";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import type { TestProject } from "vitest/node";
import { applyMigrationSql } from "../prisma/migrate-lib";

export const TEMPLATE_DB = "steve_test_template";

declare module "vitest" {
  export interface ProvidedContext {
    /** Superuser URL of the test cluster (its `postgres` database). */
    pgAdminUrl: string;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => (typeof address === "object" && address ? resolvePort(address.port) : reject(new Error("no port"))));
    });
  });
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

/**
 * One Postgres for the whole test run: TEST_DATABASE_URL (a superuser URL, as in CI) or a throwaway embedded
 * cluster. The migrations are applied once to a template database; each test file clones it (tests/setup-db.ts).
 */
export default async function setup(project: TestProject) {
  let adminUrl = process.env.TEST_DATABASE_URL?.trim();
  let cluster: EmbeddedPostgres | null = null;
  let dir: string | null = null;

  if (!adminUrl) {
    dir = mkdtempSync(join(tmpdir(), "steve-pg-"));
    const port = await freePort();
    cluster = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port, persistent: false, onLog: () => undefined });
    await cluster.initialise();
    await cluster.start();
    adminUrl = `postgresql://postgres:postgres@localhost:${port}/postgres`;
  }

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEMPLATE_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEMPLATE_DB}`);
  await admin.end();
  await applyMigrationSql(withDatabase(adminUrl, TEMPLATE_DB));

  project.provide("pgAdminUrl", adminUrl);

  return async () => {
    if (cluster) {
      await cluster.stop();
    } else {
      // A shared server (CI): remove this run's databases.
      const client = new pg.Client({ connectionString: adminUrl });
      await client.connect();
      const { rows } = await client.query<{ datname: string }>("SELECT datname FROM pg_database WHERE datname LIKE 'steve_test_%'");
      for (const { datname } of rows) await client.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
      await client.end();
    }
    if (dir) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* the OS temp cleaner will get it */
      }
    }
  };
}
