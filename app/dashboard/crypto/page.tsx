import { ArrowUpFromLine } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/wallet";
import { listWithdrawals, networksFor } from "@/lib/crypto";
import { ASSETS, formatAssetDisplay } from "@/lib/assets";
import { getQuotes, usdNgnRate } from "@/lib/prices";
import { Card, PageHeader } from "@/components/wallet-ui";
import CryptoActions from "./CryptoActions";
import LiveMarket from "./LiveMarket";

export const dynamic = "force-dynamic";

const CRYPTO_ORDER = ["BTC", "ETH", "USDT", "SOL"].filter((c) => c in ASSETS);

export default async function CryptoPage() {
  const user = await requireUser();
  const [balances, quotes, withdrawals] = await Promise.all([
    getBalances(user.sub), getQuotes(), listWithdrawals(user.sub, 20),
  ]);

  const balMap = new Map(balances.map((b) => [b.asset, b.balance]));
  const rows = CRYPTO_ORDER.map((code) => ({
    code, name: ASSETS[code].name, symbol: ASSETS[code].symbol, balance: balMap.get(code) ?? "0",
  }));

  const cryptoAssets = CRYPTO_ORDER.map((code) => ({
    code, name: ASSETS[code].name, symbol: ASSETS[code].symbol, networks: networksFor(code),
  }));
  const sandbox = process.env.NODE_ENV !== "production";

  return (
    <div>
      <PageHeader title="Crypto" subtitle="Hold, receive and send crypto — live market prices, on-chain deposits and withdrawals." />

      {/* Portfolio + markets, live-updating */}
      <LiveMarket rows={rows} initialQuotes={quotes} initialUsdNgn={usdNgnRate()} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Receive &amp; send</h2>
          <CryptoActions assets={cryptoAssets} sandbox={sandbox} />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Recent withdrawals</h2>
          <Card>
            {withdrawals.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-12 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-neutral-800"><ArrowUpFromLine size={22} /></span>
                <p className="mt-3 text-sm font-medium">No withdrawals yet</p>
                <p className="mt-1 max-w-xs text-sm text-neutral-500">Crypto you send on-chain shows up here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {withdrawals.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800"><ArrowUpFromLine size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">-{formatAssetDisplay(w.amount, w.asset)} <span className="text-xs font-normal text-neutral-500">on {w.network}</span></div>
                      <div className="truncate text-xs text-neutral-500">to {w.toAddress.slice(0, 16)}… · {new Date(w.createdAt).toLocaleString()}</div>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium capitalize text-emerald-600 dark:text-emerald-400">{w.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
