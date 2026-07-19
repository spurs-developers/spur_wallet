import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getBalances, listTransactions } from "@/lib/wallet";
import { computeOverview } from "@/lib/stats";
import { ASSETS, DEFAULT_ASSET, formatAsset } from "@/lib/assets";
import { Card, StatCard, TxnList, ASSET_ACCENT } from "@/components/wallet-ui";
import BalanceChart from "@/components/BalanceChart";

export default async function Overview() {
  const user = await requireUser();
  const [rows, txns] = await Promise.all([getBalances(user.sub), listTransactions(user.sub, { limit: 6 })]);
  const all = await listTransactions(user.sub, { limit: 500 });
  const ov = computeOverview(all, DEFAULT_ASSET);

  const byAsset = new Map(rows.map((r) => [r.asset, r.balance]));
  if (!byAsset.has(DEFAULT_ASSET)) byAsset.set(DEFAULT_ASSET, "0");
  const primary = byAsset.get(DEFAULT_ASSET) ?? "0";
  // Show all known currencies so the multi-currency wallet is visible.
  const currencies = Object.keys(ASSETS).map((code) => ({ code, balance: byAsset.get(code) ?? "0" }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>

      {/* Hero balance */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg shadow-emerald-600/20">
        <p className="text-sm text-emerald-50/80">Available balance</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">{formatAsset(primary, DEFAULT_ASSET)}</p>
        <p className="mt-1 text-sm text-emerald-50/70">Nigerian Naira · NGN</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Money in (30d)" value={formatAsset(ov.moneyIn, DEFAULT_ASSET)} accent="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Money out (30d)" value={formatAsset(ov.moneyOut, DEFAULT_ASSET)} />
        <StatCard label="Transactions" value={String(ov.count)} hint="All time, NGN" />
      </div>

      {/* Chart */}
      <Card className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Balance over time</h2>
          <span className="text-xs text-neutral-500">NGN</span>
        </div>
        <BalanceChart points={ov.series} symbol={ASSETS.NGN.symbol} />
      </Card>

      {/* Currencies */}
      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Your currencies</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {currencies.map(({ code, balance }) => (
            <Card key={code} className="p-4">
              <div className="flex items-center gap-2">
                <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold ${ASSET_ACCENT[code] ?? ""}`}>{ASSETS[code].symbol}</span>
                <div>
                  <div className="text-xs text-neutral-500">{ASSETS[code].name}</div>
                  <div className="text-[11px] uppercase text-neutral-400">{code}</div>
                </div>
              </div>
              <div className="mt-3 text-lg font-semibold">{formatAsset(balance, code)}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Recent activity</h2>
          <Link href="/dashboard/transactions" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">View all</Link>
        </div>
        <Card>
          <TxnList txns={txns} empty="No transactions yet. Add money to get started." />
        </Card>
      </div>
    </div>
  );
}
