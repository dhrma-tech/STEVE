import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, inject } from "vitest";

// Every test file gets its own real Postgres database, cloned from the migrated template made by
// tests/global-setup.ts, so queue, lease and atomic-update behavior is exercised against real SQL.
// The databases are dropped together when the run ends (tests/global-setup.ts).
const TEMPLATE_DB = "steve_test_template";
const adminUrl = inject("pgAdminUrl");
const database = `steve_test_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

async function adminQuery(sql: string): Promise<void> {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

// Several files clone the template at once; Postgres refuses a clone while another is reading the template.
for (let attempt = 0; ; attempt++) {
  try {
    await adminQuery(`CREATE DATABASE ${database} TEMPLATE ${TEMPLATE_DB}`);
    break;
  } catch (error) {
    if (attempt >= 30 || !/being accessed by other users/.test(String(error))) throw error;
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
  }
}

const url = new URL(adminUrl);
url.pathname = `/${database}`;
process.env.DATABASE_URL = url.toString();

afterAll(async () => {
  const { prisma } = await import("@/lib/db/client");
  await prisma.$disconnect();
});
