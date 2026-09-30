/**
 * Runs once when the Next.js server starts. By default the server also works through agent jobs itself, so
 * `pnpm dev` and a single-server deployment need nothing else running. Set AGENT_WORKER=external when a separate
 * `pnpm worker` process (or a scheduled tick) does that work, or AGENT_WORKER=off to disable it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const mode = (process.env.AGENT_WORKER ?? "inline").toLowerCase();
  if (mode !== "inline") return;

  const { startInlineWorker } = await import("@/lib/agents/engine/worker");
  startInlineWorker((message) => console.log(`[agents] ${message}`));
}
