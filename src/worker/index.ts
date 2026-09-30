/**
 * Standalone agent worker: `pnpm worker`.
 *
 * Runs the same job loop the web server runs inline, in its own process. Start as many as you need; they
 * coordinate through the database, so a run can move between them and survives any of them stopping.
 * Set AGENT_WORKER=external on the web server when you use this.
 */
import { Worker } from "@/lib/agents/engine/worker";

const worker = new Worker({ keepProcessAlive: true, log: (message) => console.log(`[worker] ${message}`) });
worker.start();

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[worker] ${signal} received, finishing current jobs...`);
  await worker.stop();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
