import { defineConfig } from "prisma/config";
import { databaseUrl } from "./src/lib/db/url";

// The Prisma CLI does not read .env by itself.
try {
  process.loadEnvFile();
} catch {
  /* no .env file: use the environment as is */
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    url: databaseUrl()
  }
});
