"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { getAsset, formatAssetDisplay } from "@/lib/assets";
import AssetIcon from "@/components/AssetIcon";

interface Quote { priceUsd: number; change24h: number }
interface Row { code: string; name: string; symbol: string; balance: string }

const fmtUsd = (v: number) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNgn = (v: number) => "₦" + Math.round(v).toLocaleString("en-US");

function valueUsd(balance: string, code: string, q?: Quote): number {
  const units = Number(balance) / 10 ** getAsset(code).decimals;
  return units * (q?.priceUsd ?? 0);
}

/** Live-updating markets + holdings. Polls /api/prices and re-values in place. */
export default function LiveMarket({
  rows, initialQuotes, initialUsdNgn,
}: { rows: Row[]; initialQuotes: Record<string, Quote>; initialUsdNgn: number }) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [usdNgn, setUsdNgn] = useState(initialUsdNgn);
  const [flash, setFlash] = useState<Record<string, "up" | "down">>({});
  const prev = useRef(initialQuotes);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/prices", { cache: "no-store" });
        if (!res.ok) return;
        const data: { quotes: Record<string, Quote>; usdNgn: number } = await res.json();
        if (!active) return;
        // flash price direction
        const f: Record<string, "up" | "down"> = {};
        for (const [code, q] of Object.entries(data.quotes)) {
          const p = prev.current[code]?.priceUsd;
          if (p != null && q.priceUsd !== p) f[code] = q.priceUsd > p ? "up" : "down";
        }
        prev.current = data.quotes;
        setQuotes(data.quotes);
        setUsdNgn(data.usdNgn);
        setFlash(f);
        setTimeout(() => active && setFlash({}), 700);
      } catch { /* keep last known */ }
    };
    const id = setInterval(tick, 5_000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const totalUsd = rows.reduce((s, r) => s + valueUsd(r.balance, r.code, quotes[r.code]), 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-neutral-500">Crypto portfolio value</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{fmtUsd(totalUsd)}</p>
            <p className="text-sm text-neutral-500">≈ {fmtNgn(totalUsd * usdNgn)}</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-indigo-500 opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-indigo-500" /></span>
            Live · updates every 5s
          </span>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Markets &amp; holdings</h2>
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="px-5 py-3 font-medium">Asset</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">24h</th>
                <th className="px-5 py-3 text-right font-medium">Holdings</th>
                <th className="px-5 py-3 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.map((r) => {
                const q = quotes[r.code];
                const up = (q?.change24h ?? 0) >= 0;
                const fl = flash[r.code];
                return (
                  <tr key={r.code}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <AssetIcon code={r.code} size={16} className="size-8" />
                        <div><div className="font-medium">{r.name}</div><div className="text-xs text-neutral-500">{r.code}</div></div>
                      </div>
                    </td>
                    <td className={`px-5 py-3 tabular-nums transition-colors ${fl === "up" ? "text-emerald-600" : fl === "down" ? "text-red-600" : ""}`}>{fmtUsd(q?.priceUsd ?? 0)}</td>
                    <td className={`px-5 py-3 tabular-nums ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      <span className="inline-flex items-center gap-1">{up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{(q?.change24h ?? 0).toFixed(2)}%</span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatAssetDisplay(r.balance, r.code)}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums">{fmtUsd(valueUsd(r.balance, r.code, q))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
