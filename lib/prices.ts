import { ASSETS, getAsset } from "@/lib/assets";

/**
 * Live market prices for the crypto assets, quoted in USD. Primary source is the
 * Binance public ticker (real spot prices + 24h change), cached briefly; if it's
 * unreachable we fall back to recent static prices so the wallet still works
 * offline. USDT is treated as the USD peg.
 */
export interface Quote {
  asset: string;
  priceUsd: number;
  change24h: number; // percent
}

// asset -> Binance spot symbol (USDT pair). USDT itself is the $1 peg.
const SYMBOL: Record<string, string> = { BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT" };
const FALLBACK_USD: Record<string, number> = { BTC: 65000, ETH: 3200, SOL: 150, USDT: 1 };

const BINANCE = process.env.SPURS_PRICE_URL ?? "https://api.binance.com/api/v3/ticker/24hr";
const USD_NGN = Number(process.env.SPURS_USD_NGN ?? 1650);
const TTL_MS = 5_000;

type Cache = { at: number; quotes: Record<string, Quote> };
const g = globalThis as unknown as { _spursPrices?: Cache };

function cryptoCodes(): string[] {
  return Object.values(ASSETS).filter((a) => a.kind === "crypto").map((a) => a.code);
}

export async function getQuotes(): Promise<Record<string, Quote>> {
  const now = Date.now();
  if (g._spursPrices && now - g._spursPrices.at < TTL_MS) return g._spursPrices.quotes;

  const codes = cryptoCodes();
  const quotes: Record<string, Quote> = {};
  // USDT is the peg.
  quotes.USDT = { asset: "USDT", priceUsd: 1, change24h: 0 };

  const symbols = codes.filter((c) => SYMBOL[c]).map((c) => SYMBOL[c]);
  try {
    const url = `${BINANCE}?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
    // No Next fetch-cache here: we keep our own TTL cache above, and mixing the
    // cache layer with an AbortSignal can swallow the timeout and hang.
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
      headers: { accept: "application/json", "user-agent": "spurs-wallet/1.0" },
    });
    if (res.ok) {
      const rows: { symbol: string; lastPrice: string; priceChangePercent: string }[] = await res.json();
      const bySymbol = new Map(rows.map((r) => [r.symbol, r]));
      for (const c of codes) {
        if (c === "USDT") continue;
        const r = bySymbol.get(SYMBOL[c]);
        quotes[c] = r
          ? { asset: c, priceUsd: Number(r.lastPrice), change24h: Number(r.priceChangePercent) }
          : { asset: c, priceUsd: FALLBACK_USD[c] ?? 0, change24h: 0 };
      }
      g._spursPrices = { at: now, quotes };
      return quotes;
    }
  } catch {
    // fall through to fallback
  }

  for (const c of codes) {
    if (c === "USDT") continue;
    quotes[c] = { asset: c, priceUsd: FALLBACK_USD[c] ?? 0, change24h: 0 };
  }
  g._spursPrices = { at: now, quotes };
  return quotes;
}

export function usdNgnRate(): number {
  return USD_NGN;
}

/** USD value of an integer minor-unit balance in a given asset. */
export function valueUsd(minor: string | bigint, asset: string, quotes: Record<string, Quote>): number {
  const a = getAsset(asset);
  if (a.kind === "fiat") return asset === "USD" ? Number(minor) / 100 : Number(minor) / 100 / USD_NGN;
  const units = Number(minor) / 10 ** a.decimals;
  const price = quotes[asset]?.priceUsd ?? FALLBACK_USD[asset] ?? 0;
  return units * price;
}

export function fmtUsd(v: number): string {
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtNgn(v: number): string {
  return "₦" + Math.round(v).toLocaleString("en-US");
}
