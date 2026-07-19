import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/wallet";
import { ASSETS, formatAsset } from "@/lib/assets";
import { Card, PageHeader } from "@/components/wallet-ui";
import { sendMoneyAction } from "../actions";

export default async function SendPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireUser();
  const { ok, error } = await searchParams;
  const balances = await getBalances(user.sub);
  const held = balances.length ? balances : [{ asset: "NGN", balance: "0" }];

  return (
    <div className="max-w-lg">
      <PageHeader title="Send money" subtitle="Transfer to another Spurs user by email — instant and free." />

      {ok && <Banner tone="ok">Money sent successfully.</Banner>}
      {error && <Banner tone="err">{error}</Banner>}

      <Card className="p-6">
        <form action={sendMoneyAction} className="space-y-4">
          <Field label="Recipient email">
            <input name="email" type="email" required placeholder="them@example.com" className="input" />
          </Field>

          <div className="grid grid-cols-[1fr_110px] gap-3">
            <Field label="Amount">
              <input name="amount" inputMode="decimal" required placeholder="0.00" className="input" />
            </Field>
            <Field label="Currency">
              <select name="asset" defaultValue="NGN" className="input">
                {held.map((b) => <option key={b.asset} value={b.asset}>{b.asset}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Note (optional)">
            <input name="note" maxLength={140} placeholder="What's it for?" className="input" />
          </Field>

          <button className="flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 text-sm font-medium text-white transition hover:bg-emerald-700">
            Send money
          </button>
        </form>
      </Card>

      <div className="mt-4 text-sm text-neutral-500">
        You hold:{" "}
        {held.map((b, i) => (
          <span key={b.asset}>{i > 0 ? " · " : ""}<span className="font-medium text-neutral-700 dark:text-neutral-300">{formatAsset(b.balance, b.asset)}</span></span>
        ))}
      </div>
      <p className="mt-1 text-xs text-neutral-400">Recipients must have signed in to a Spurs product at least once. {Object.keys(ASSETS).length} currencies supported.</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function Banner({ tone, children }: { tone: "ok" | "err"; children: React.ReactNode }) {
  const cls = tone === "ok"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300";
  return <div className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${cls}`}>{children}</div>;
}
