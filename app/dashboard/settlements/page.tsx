import { Landmark, Plus, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listTransactions } from "@/lib/wallet";
import { formatAsset } from "@/lib/assets";
import { Card, StatCard, PageHeader } from "@/components/wallet-ui";

// Settlements = money moved out of the wallet to a bank account (withdrawals).
export default async function SettlementsPage() {
  const user = await requireUser();
  const all = await listTransactions(user.sub, { limit: 200 });
  const settlements = all.filter((t) => t.source === "withdrawal");

  const total = settlements.reduce((s, t) => s + BigInt(t.amount), 0n).toString();

  return (
    <div>
      <PageHeader
        title="Settlements"
        subtitle="Withdraw your balance to a bank account."
        action={
          <button disabled className="flex h-9 cursor-not-allowed items-center gap-2 rounded-lg bg-neutral-200 px-3.5 text-sm font-medium text-neutral-500 dark:bg-neutral-800">
            <Plus size={16} /> Withdraw
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Settled (all time)" value={formatAsset(total, "NGN")} />
        <StatCard label="Pending" value={formatAsset("0", "NGN")} hint="Nothing in transit" />
        <StatCard label="Payout schedule" value="Manual" hint="Automatic payouts coming" />
      </div>

      <Card className="mt-6">
        <div className="border-b border-neutral-100 px-5 py-3.5 text-sm font-medium dark:border-neutral-800">Payout history</div>
        {settlements.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-neutral-800"><Landmark size={22} /></span>
            <p className="mt-4 text-sm font-medium">No settlements yet</p>
            <p className="mt-1 max-w-xs text-sm text-neutral-500">
              Add a bank account to withdraw your wallet balance. Bank payouts are rolling out soon.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {settlements.map((t) => (
              <li key={t.reference} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800"><Landmark size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{t.description ?? "Withdrawal"}</div>
                  <div className="text-xs text-neutral-500">{new Date(t.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-sm font-semibold">-{formatAsset(t.amount, t.asset)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-neutral-200 px-4 py-3 text-sm text-neutral-500 dark:border-neutral-800">
        <Clock size={15} /> Bank payouts settle within 24 hours once enabled.
      </div>
    </div>
  );
}
