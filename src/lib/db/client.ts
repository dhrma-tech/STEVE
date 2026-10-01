import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "./url";

// The web server, the agent worker and live event streams share one Postgres. Each process keeps a small pool;
// PRISMA_POOL_MAX raises it for a busy worker.
const poolMax = Math.floor(Number(process.env.PRISMA_POOL_MAX));
const adapter = new PrismaPg({
  connectionString: databaseUrl(),
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10
});

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
