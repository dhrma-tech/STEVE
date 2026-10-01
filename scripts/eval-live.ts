/**
 * Live agent evals: the eval scenarios against a real model (src/lib/agents/evals). Outside services stay stand-ins,
 * so nothing is emailed, deployed or charged; model calls are real and cost money (roughly a few cents per scenario).
 *
 *   pnpm eval:live                      all live scenarios
 *   pnpm eval:live -t sales             scenarios whose id matches
 *   EVAL_REPORT=evals-live.json ...     also write the summary as JSON
 *
 * Needs ANTHROPIC_API_KEY and the test database (TEST_DATABASE_URL, or `pnpm db:local`).
 */
import { spawnSync } from "node:child_process";

if (!process.env.ANTHROPIC_API_KEY?.trim()) {
  console.error("ANTHROPIC_API_KEY is not set. Live evals call the real model; set the key and try again.");
  process.exit(1);
}

const result = spawnSync("pnpm", ["exec", "vitest", "run", "src/lib/agents/evals", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, EVAL_LIVE: "1" }
});
process.exit(result.status ?? 1);
