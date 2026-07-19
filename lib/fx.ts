import { getAsset } from "@/lib/assets";

// Indicative USD price of 1 whole unit of each asset. In production this comes
// from a rates feed; here it's a static table so Convert works end to end.
const USD_PRICE: Record<string, number> = {
  NGN: 1 / 1600,
  USD: 1,
  USDT: 1,
  BTC: 60000,
};

/** Exchange rate: how many units of `to` equal one unit of `from`. */
export function rate(from: string, to: string): number {
  const f = USD_PRICE[from];
  const t = USD_PRICE[to];
  if (!f || !t) throw new Error("Unsupported conversion");
  return f / t;
}

/** Convert an integer minor-unit amount of `from` into minor units of `to`. */
export function convertMinor(from: string, to: string, fromMinor: number): number {
  const fMajor = fromMinor / 10 ** getAsset(from).decimals;
  const toMajor = fMajor * rate(from, to);
  return Math.round(toMajor * 10 ** getAsset(to).decimals);
}
