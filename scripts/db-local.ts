/**
 * `pnpm db:local`: run a private Postgres for development in `.pgdata/` (port 54320, user and password `steve`,
 * database `steve`). Leave it running in its own terminal; Ctrl+C stops it. Use this until DATABASE_URL points
 * at another Postgres (your own server, Supabase, ...).
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const databaseDir = resolve(".pgdata");
const firstRun = !existsSync(resolve(databaseDir, "PG_VERSION"));

const cluster = new EmbeddedPostgres({
  databaseDir,
  user: "steve",
  password: "steve",
  port: 54320,
  persistent: true,
  onLog: () => undefined,
  onError: (message) => console.error(String(message))
});

async function main() {
  if (firstRun) {
    console.log(`Creating a new Postgres cluster in ${databaseDir} ...`);
    await cluster.initialise();
  }
  await cluster.start();
  if (firstRun) await cluster.createDatabase("steve");
  console.log("Postgres is running: postgresql://steve:steve@localhost:54320/steve");
  if (firstRun) console.log("Next, in another terminal: pnpm db:migrate && pnpm db:seed (or pnpm db:import-sqlite to bring over dev.db).");

  const stop = async () => {
    console.log("Stopping Postgres ...");
    await cluster.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
  setInterval(() => undefined, 1 << 30);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
