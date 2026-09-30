/** Port and credentials of the Postgres that `pnpm db:local` runs when no other database is configured. */
export const LOCAL_DATABASE_URL = "postgresql://steve:steve@localhost:54320/steve";

/**
 * The Postgres connection string. `DATABASE_URL` wins; without it, development falls back to the local cluster
 * started by `pnpm db:local`. A leftover SQLite `file:` URL is rejected with a pointer to the import script.
 */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    if (env.NODE_ENV === "production") throw new Error("DATABASE_URL is not set. STEVE needs a Postgres connection string in production.");
    return LOCAL_DATABASE_URL;
  }
  if (url.startsWith("file:")) {
    throw new Error(
      `DATABASE_URL points at a SQLite file (${url}). STEVE now runs on Postgres: set DATABASE_URL to a postgresql:// URL ` +
        "(or remove it and run `pnpm db:local`), then `pnpm db:migrate` and `pnpm db:import-sqlite` to bring your data across."
    );
  }
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error("DATABASE_URL must be a postgresql:// connection string.");
  return url;
}
