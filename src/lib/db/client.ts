import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { resolve } from "node:path";

const sqliteFile = process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./dev.db";
const sqliteUrl = resolve("prisma", sqliteFile);
// The web server, the agent worker and live event streams all use this file at once. A generous busy
// timeout lets a writer wait for another writer instead of failing, and WAL (set by the migration script)
// lets readers proceed while a write is in flight.
const adapter = new PrismaBetterSqlite3({ url: sqliteUrl, timeout: 15_000 });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
