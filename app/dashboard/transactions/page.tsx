import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listTransactions } from "@/lib/wallet";
import { ASSETS } from "@/lib/assets";
import { Card, TxnList, PageHeader } from "@/components/wallet-ui";

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ asset?: string }> }) {
  const user = await requireUser();
  const { asset } = await searchParams;
  const active = asset && asset in ASSETS ? asset : undefined;
  const txns = await listTransactions(user.sub, { asset: active, limit: 200 });

  const chips = [{ code: "", label: "All" }, ...Object.keys(ASSETS).map((c) => ({ code: c, label: c }))];

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Every credit and debit across your wallet." />

      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((c) => {
          const on = (c.code || undefined) === active;
          return (
            <Link
              key={c.label}
              href={c.code ? `/dashboard/transactions?asset=${c.code}` : "/dashboard/transactions"}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                on
                  ? "border-emerald-500 bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "border-neutral-200 text-neutral-600 hover:border-neutral-300 dark:border-neutral-700 dark:text-neutral-400"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      <Card>
        <TxnList txns={txns} empty={active ? `No ${active} transactions yet.` : "No transactions yet."} />
      </Card>
    </div>
  );
}
