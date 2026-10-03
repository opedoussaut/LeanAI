// Model price table used to turn measured or estimated tokens into an AI cost per decision.
// Illustrative and configurable: verify against the provider's official pricing page before quoting a figure.
// Source used for the defaults: public Gemini API price listings consulted on 3 October 2026 (Flash tier).
export const USD_TO_EUR = 0.92;   // stated conversion assumption
export const PRICES = {
  flash: { label: 'Gemini Flash tier', inPerMUsd: 1.5, outPerMUsd: 9.0, note: 'Flash-tier list price (per million tokens); thinking tokens are billed as output.' },
  'flash-lite': { label: 'Gemini Flash-Lite tier', inPerMUsd: 0.3, outPerMUsd: 2.5, note: 'Flash-Lite list price (per million tokens).' }
};
export const tokenCostEur = (tier, inputTokens, outputTokens) => {
  const p = PRICES[tier] ?? PRICES.flash;
  return (inputTokens * p.inPerMUsd + outputTokens * p.outPerMUsd) / 1e6 * USD_TO_EUR;
};
