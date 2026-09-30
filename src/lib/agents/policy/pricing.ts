/**
 * Approximate model prices in USD per million tokens, used to enforce run budgets.
 * These are estimates for guardrails, not billing: check the provider price pages and
 * update this table when models or prices change. Unknown models use the most
 * expensive tier so an unrecognized model cannot slip under a budget.
 */

type Price = { inputPerMTok: number; outputPerMTok: number };

const PRICES: Array<{ match: RegExp; price: Price }> = [
  { match: /^claude-opus/i, price: { inputPerMTok: 15, outputPerMTok: 75 } },
  { match: /^claude-sonnet/i, price: { inputPerMTok: 3, outputPerMTok: 15 } },
  { match: /^claude-haiku/i, price: { inputPerMTok: 1, outputPerMTok: 5 } },
  { match: /^gpt-4o-mini/i, price: { inputPerMTok: 0.15, outputPerMTok: 0.6 } },
  { match: /^gpt-4o/i, price: { inputPerMTok: 2.5, outputPerMTok: 10 } }
];

const FALLBACK_PRICE: Price = { inputPerMTok: 15, outputPerMTok: 75 };

export function priceFor(modelId: string, provider: string): Price {
  if (provider === "ollama") return { inputPerMTok: 0, outputPerMTok: 0 };
  return PRICES.find((entry) => entry.match.test(modelId))?.price ?? FALLBACK_PRICE;
}

/** Cost in cents (fractional) for one model call. */
export function estimateCostCents(params: {
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  const price = priceFor(params.modelId, params.provider);
  const usd = (params.inputTokens * price.inputPerMTok + params.outputTokens * price.outputPerMTok) / 1_000_000;
  return usd * 100;
}
