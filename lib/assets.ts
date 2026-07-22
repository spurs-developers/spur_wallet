// The assets a Spurs Wallet can hold. Decimals live here so amounts stay exact
// integer minor units everywhere else. Add a row to support a new currency.
export type AssetKind = "fiat" | "crypto";

export interface Asset {
  code: string;
  name: string;
  kind: AssetKind;
  decimals: number;      // exact minor-unit precision (storage)
  displayDecimals?: number; // max decimals shown in the UI (defaults to decimals)
  symbol: string;
}

export const ASSETS: Record<string, Asset> = {
  NGN: { code: "NGN", name: "Nigerian Naira", kind: "fiat", decimals: 2, symbol: "₦" },
  USD: { code: "USD", name: "US Dollar", kind: "fiat", decimals: 2, symbol: "$" },
  USDT: { code: "USDT", name: "Tether USD", kind: "crypto", decimals: 6, displayDecimals: 2, symbol: "₮" },
  BTC: { code: "BTC", name: "Bitcoin", kind: "crypto", decimals: 8, displayDecimals: 8, symbol: "₿" },
  ETH: { code: "ETH", name: "Ethereum", kind: "crypto", decimals: 18, displayDecimals: 6, symbol: "Ξ" },
  SOL: { code: "SOL", name: "Solana", kind: "crypto", decimals: 9, displayDecimals: 4, symbol: "◎" },
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

/** Compact display: trims to the asset's displayDecimals, dropping trailing zeros. */
export function formatAssetDisplay(minor: string | bigint | number, code: string): string {
  const asset = getAsset(code);
  const show = asset.displayDecimals ?? asset.decimals;
  const neg = BigInt(minor) < 0n;
  const abs = neg ? -BigInt(minor) : BigInt(minor);
  const base = 10n ** BigInt(asset.decimals);
  const whole = abs / base;
  let fracStr = "";
  if (show > 0 && asset.decimals > 0) {
    const fracFull = (abs % base).toString().padStart(asset.decimals, "0");
    const trimmed = fracFull.slice(0, show).replace(/0+$/, "");
    if (trimmed) fracStr = "." + trimmed;
  }
  return `${neg ? "-" : ""}${asset.symbol}${whole.toLocaleString("en-US")}${fracStr}`;
}

/** Convert a human decimal string (e.g. "0.005") to exact minor units for an asset. */
export function toMinorUnits(value: string, code: string): bigint {
  const asset = getAsset(code);
  const [whole = "0", frac = ""] = value.trim().replace(/,/g, "").split(".");
  const fracPadded = (frac + "0".repeat(asset.decimals)).slice(0, asset.decimals);
  return BigInt(whole || "0") * 10n ** BigInt(asset.decimals) + BigInt(fracPadded || "0");
}
