import type { Transaction } from "@/lib/db/schema";
import { getAsset } from "@/lib/assets";

export interface Overview {
  moneyIn: string; // minor units (last 30d)
  moneyOut: string;
  net: string;
  count: number;
  series: { t: number; v: number }[]; // balanceAfter in MAJOR units over time
}

/** Derive Overview stats + a balance-over-time series for one asset from the ledger. */
export function computeOverview(txns: Transaction[], asset = "NGN"): Overview {
  const decimals = getAsset(asset).decimals;
  const scale = 10 ** decimals;
  const rows = txns.filter((t) => t.asset === asset);

  const cutoff = Date.now() - 30 * 86_400_000;
  let inSum = 0n;
  let outSum = 0n;
  for (const t of rows) {
    if (new Date(t.createdAt).getTime() < cutoff) continue;
    if (t.direction === "credit") inSum += BigInt(t.amount);
    else outSum += BigInt(t.amount);
  }

  // Chronological balance points (rows arrive newest-first).
  const series = [...rows]
    .reverse()
    .map((t) => ({ t: new Date(t.createdAt).getTime(), v: Number(BigInt(t.balanceAfter)) / scale }));

  return {
    moneyIn: inSum.toString(),
    moneyOut: outSum.toString(),
    net: (inSum - outSum).toString(),
    count: rows.length,
    series,
  };
}
