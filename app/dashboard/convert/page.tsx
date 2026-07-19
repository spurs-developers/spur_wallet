import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/wallet";
import { ASSETS, formatAsset } from "@/lib/assets";
import { rate } from "@/lib/fx";
import { Card, PageHeader } from "@/components/wallet-ui";
import { convertAction } from "../actions";

export default async function ConvertPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireUser();
  const { ok, error } = await searchParams;
  const balances = await getBalances(user.sub);
  const codes = Object.keys(ASSETS);

  return (
    <div className="max-w-lg">
      <PageHeader title="Convert" subtitle="Exchange between your currencies at the going rate." />

      {ok && <Banner tone="ok">Conversion complete.</Banner>}
      {error && <Banner tone="err">{error}</Banner>}

      <Card className="p-6">
        <form action={convertAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-neutral-500">From</span>
              <select name="from" defaultValue="NGN" className="input">
                {codes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-neutral-500">To</span>
              <select name="to" defaultValue="USD" className="input">
                {codes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-neutral-500">Amount to convert</span>
            <input name="amount" inputMode="decimal" required placeholder="0.00" className="input" />
          </label>

          <button className="flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 text-sm font-medium text-white transition hover:bg-emerald-700">
            Convert
          </button>
        </form>
      </Card>

      <div className="mt-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Indicative rates</h2>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          {[["NGN", "USD"], ["USD", "NGN"], ["USD", "BTC"], ["USDT", "NGN"]].map(([f, t]) => (
            <div key={f + t} className="flex justify-between rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
              <span className="text-neutral-500">1 {f}</span>
              <span className="font-medium">{rate(f, t).toLocaleString("en-US", { maximumFractionDigits: 8 })} {t}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        You hold:{" "}
        {(balances.length ? balances : [{ asset: "NGN", balance: "0" }]).map((b, i) => (
          <span key={b.asset}>{i > 0 ? " · " : ""}{formatAsset(b.balance, b.asset)}</span>
        ))}
      </p>
    </div>
  );
}

function Banner({ tone, children }: { tone: "ok" | "err"; children: React.ReactNode }) {
  const cls = tone === "ok"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300";
  return <div className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${cls}`}>{children}</div>;
}
