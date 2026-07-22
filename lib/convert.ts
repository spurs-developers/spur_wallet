import "server-only";
import { getAsset } from "@/lib/assets";
import { getQuotes, usdNgnRate, type Quote } from "@/lib/prices";

/**
 * Convert between any two held assets at live market rates.
 *
 * Everything is priced through USD: crypto from the live spot feed, USD at par,
 * NGN via the configured USD/NGN rate. Replaces the old static FX table so a
 * conversion reflects the same prices shown on the Crypto page.
 */

/** USD value of an integer minor-unit amount. */
function toUsd(minor: bigint, asset: string, quotes: Record<string, Quote>): number {
  const a = getAsset(asset);
  const units = Number(minor) / 10 ** a.decimals;
  if (a.kind === "fiat") return asset === "USD" ? units : units / usdNgnRate();
  return units * (quotes[asset]?.priceUsd ?? 0);
}

/** Integer minor units of `asset` representing a USD value. */
function fromUsd(usd: number, asset: string, quotes: Record<string, Quote>): bigint {
  const a = getAsset(asset);
  let units: number;
  if (a.kind === "fiat") units = asset === "USD" ? usd : usd * usdNgnRate();
  else {
    const price = quotes[asset]?.priceUsd ?? 0;
    if (price <= 0) throw new Error(`No live price for ${asset} right now`);
    units = usd / price;
  }
  return BigInt(Math.floor(units * 10 ** a.decimals));
}

export interface ConversionQuote {
  fromMinor: bigint;
  toMinor: bigint;
  feePercent: number;
  rate: number; // 1 unit of `from` expressed in `to`
}

/**
 * Quote a conversion at market, minus the platform conversion fee.
 * Pure calculation — does not touch the ledger.
 */
export async function quoteConversion(
  from: string,
  to: string,
  fromMinor: bigint,
  feePercent: number,
): Promise<ConversionQuote> {
  if (from === to) throw new Error("Pick two different currencies");
  if (fromMinor <= 0n) throw new Error("Enter a valid amount");

  const quotes = await getQuotes();
  const usd = toUsd(fromMinor, from, quotes);
  if (usd <= 0) throw new Error("Amount too small to convert");

  const net = usd * (1 - Math.max(0, feePercent) / 100);
  const toMinor = fromUsd(net, to, quotes);
  if (toMinor <= 0n) throw new Error("Amount too small to convert");

  // Display rate: how much `to` one whole unit of `from` buys (after fee).
  const oneUnit = 10n ** BigInt(getAsset(from).decimals);
  const rateMinor = fromUsd(toUsd(oneUnit, from, quotes) * (1 - feePercent / 100), to, quotes);
  const rate = Number(rateMinor) / 10 ** getAsset(to).decimals;

  return { fromMinor, toMinor, feePercent, rate };
}

/** Live indicative rates for display: 1 unit of `from` in `to` (no fee). */
export async function marketRates(pairs: [string, string][]): Promise<{ from: string; to: string; rate: number }[]> {
  const quotes = await getQuotes();
  return pairs.map(([from, to]) => {
    const oneUnit = 10n ** BigInt(getAsset(from).decimals);
    const minor = fromUsd(toUsd(oneUnit, from, quotes), to, quotes);
    return { from, to, rate: Number(minor) / 10 ** getAsset(to).decimals };
  });
}

/** Convenience: quote using the platform's configured fee. */
export async function convertAtMarket(
  from: string,
  to: string,
  fromMinor: bigint,
  feePercent: number,
): Promise<ConversionQuote> {
  return quoteConversion(from, to, fromMinor, feePercent);
}
