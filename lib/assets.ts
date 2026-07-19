// The assets a Spurs Wallet can hold. Decimals live here so amounts stay exact
// integer minor units everywhere else. Add a row to support a new currency.
export type AssetKind = "fiat" | "crypto";

export interface Asset {
  code: string;
  name: string;
  kind: AssetKind;
  decimals: number;
  symbol: string;
}

export const ASSETS: Record<string, Asset> = {
  NGN: { code: "NGN", name: "Nigerian Naira", kind: "fiat", decimals: 2, symbol: "₦" },
  USD: { code: "USD", name: "US Dollar", kind: "fiat", decimals: 2, symbol: "$" },
  USDT: { code: "USDT", name: "Tether USD", kind: "crypto", decimals: 6, symbol: "₮" },
  BTC: { code: "BTC", name: "Bitcoin", kind: "crypto", decimals: 8, symbol: "₿" },
};

export const DEFAULT_ASSET = "NGN";

export function isAsset(code: string): boolean {
  return code in ASSETS;
}

export function getAsset(code: string): Asset {
  const a = ASSETS[code];
  if (!a) throw new Error(`Unknown asset: ${code}`);
  return a;
}

/** Format integer minor units (string/bigint) into a human display value. */
export function formatAsset(minor: string | bigint | number, code: string): string {
  const asset = getAsset(code);
  const neg = BigInt(minor) < 0n;
  const abs = neg ? -BigInt(minor) : BigInt(minor);
  const base = 10n ** BigInt(asset.decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = asset.decimals > 0 ? "." + frac.toString().padStart(asset.decimals, "0") : "";
  const wholeStr = whole.toLocaleString("en-US");
  return `${neg ? "-" : ""}${asset.symbol}${wholeStr}${fracStr}`;
}
