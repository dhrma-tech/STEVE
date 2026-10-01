/**
 * Model prices in USD per million tokens, used to enforce run budgets and to report cost.
 * Claude prices are the first-party API rates from the Claude API reference (2026-09); OpenAI prices are estimates.
 * These guard budgets, they are not billing: update this table when models or prices change. Unknown models use the
 * most expensive tier so an unrecognized model cannot slip under a budget.
 *
 * Prompt caching: cache writes (5-minute TTL) cost 1.25x input; cache reads cost a model-specific fraction of input
 * (0.05x on Claude Opus 5.5, 0.025x on Claude Fable 5.1, 0.1x elsewhere).
 */

type Price = { inputPerMTok: number; outputPerMTok: number; cacheReadPerMTok: number; cacheWritePerMTok: number };

const price = (input: number, output: number, cacheReadFactor = 0.1): Price => ({
  inputPerMTok: input,
  outputPerMTok: output,
  cacheReadPerMTok: input * cacheReadFactor,
  cacheWritePerMTok: input * 1.25
});

/** Most specific first. */
const PRICES: Array<{ match: RegExp; price: Price }> = [
  { match: /^claude-(fable|mythos)-5-1/i, price: price(10, 50, 0.025) },
  { match: /^claude-(fable|mythos)-5/i, price: price(10, 50) },
  { match: /^claude-opus-5-5/i, price: price(4, 20, 0.05) },
  { match: /^claude-opus-(5|4-[6-8])/i, price: price(5, 25) },
  { match: /^claude-sonnet-5/i, price: price(2, 10) },
  { match: /^claude-sonnet-4-6/i, price: price(3, 15) },
  { match: /^claude-haiku-4-5/i, price: price(1, 5) },
  { match: /^claude-sonnet/i, price: price(3, 15) },
  { match: /^gpt-4o-mini/i, price: price(0.15, 0.6, 0.5) },
  { match: /^gpt-4o/i, price: price(2.5, 10, 0.5) }
];

const FALLBACK_PRICE: Price = price(15, 75);

export function priceFor(modelId: string, provider: string): Price {
  if (provider === "ollama") return { inputPerMTok: 0, outputPerMTok: 0, cacheReadPerMTok: 0, cacheWritePerMTok: 0 };
  return PRICES.find((entry) => entry.match.test(modelId))?.price ?? FALLBACK_PRICE;
}

/** Cost in cents (fractional) for one model call. Input tokens exclude cached tokens, which are priced separately. */
export function estimateCostCents(params: {
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}): number {
  const p = priceFor(params.modelId, params.provider);
  const usd =
    (params.inputTokens * p.inputPerMTok +
      params.outputTokens * p.outputPerMTok +
      (params.cacheReadTokens ?? 0) * p.cacheReadPerMTok +
      (params.cacheWriteTokens ?? 0) * p.cacheWritePerMTok) /
    1_000_000;
  return usd * 100;
}
