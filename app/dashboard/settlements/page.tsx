import { Landmark, Trash2, ArrowUpFromLine } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getBalance } from "@/lib/wallet";
import { formatAsset } from "@/lib/assets";
import { listBanks } from "@/lib/pay-client";
import { listBankAccounts, listSettlements } from "@/lib/settlements";
import { Card, StatCard, PageHeader } from "@/components/wallet-ui";
import { addBankAccountAction, removeBankAccountAction, withdrawAction } from "../actions";

export const dynamic = "force-dynamic";

// Settlements = money moved out of the wallet to a bank account (withdrawals),
// executed on Spurs Pay's bank rails.
export default async function SettlementsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireUser();
  const { ok, error } = await searchParams;
  const [balance, banks, accounts, history] = await Promise.all([
    getBalance(user.sub, "NGN"), listBanks(), listBankAccounts(user.sub), listSettlements(user.sub),
  ]);

  const paidOut = history.filter((s) => s.status === "successful").reduce((sum, s) => sum + BigInt(s.amount), 0n);
  const pending = history.filter((s) => s.status === "pending").reduce((sum, s) => sum + BigInt(s.amount), 0n);
  const input = "h-10 w-full rounded-lg border border-neutral-300 bg-transparent px-3 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700";
  const label = "mb-1.5 block text-xs font-medium text-neutral-500";

  return (
    <div>
      <PageHeader title="Settlements" subtitle="Withdraw your wallet balance to a bank account." />

      {ok && <div className="mb-4 rounded-lg bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">{ok}</div>}
      {error && <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Available to withdraw" value={formatAsset(balance, "NGN")} />
        <StatCard label="Withdrawn to date" value={formatAsset(paidOut.toString(), "NGN")} hint={pending > 0n ? `${formatAsset(pending.toString(), "NGN")} in transit` : undefined} />
        <StatCard label="Bank accounts" value={String(accounts.length)} hint={accounts.length ? "Verified" : "Add one below"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Withdraw */}
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Withdraw</h2>
          <Card className="p-5">
            {accounts.length === 0 ? (
              <p className="text-sm text-neutral-500">Add a bank account first — we verify it before any money moves.</p>
            ) : (
              <form action={withdrawAction} className="space-y-4">
                <label className="block">
                  <span className={label}>To account</span>
                  <select name="bankAccountId" className={input} required>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.bankName} ••{a.accountNumber.slice(-4)} — {a.accountName}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={label}>Amount (NGN)</span>
                  <input name="amount" inputMode="decimal" required placeholder="0.00" className={input} />
                  <span className="mt-1 block text-xs text-neutral-400">Available {formatAsset(balance, "NGN")}. Funds are returned if the bank rejects it.</span>
                </label>
                <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-medium text-white transition hover:bg-emerald-700">
                  <ArrowUpFromLine size={15} /> Withdraw to bank
                </button>
              </form>
            )}
          </Card>
        </div>

        {/* Bank accounts */}
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Bank accounts</h2>
          <Card className="p-5">
            <form action={addBankAccountAction} className="space-y-3">
              <label className="block">
                <span className={label}>Bank</span>
                <select name="bank" className={input} required>
                  <option value="">Select a bank…</option>
                  {banks.map((b) => <option key={b.code} value={`${b.code}|${b.name}`}>{b.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={label}>Account number</span>
                <input name="accountNumber" inputMode="numeric" maxLength={10} required placeholder="10 digits" className={input} />
              </label>
              <button className="h-10 w-full rounded-lg border border-neutral-300 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
                Verify &amp; add account
              </button>
            </form>

            {accounts.length > 0 && (
              <ul className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-neutral-800 dark:border-neutral-800">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800"><Landmark size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.accountName}</div>
                      <div className="text-xs text-neutral-500">{a.bankName} · ••{a.accountNumber.slice(-4)}</div>
                    </div>
                    <form action={removeBankAccountAction.bind(null, a.id)}>
                      <button className="text-neutral-400 transition hover:text-red-600" aria-label="Remove"><Trash2 size={15} /></button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* History */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Withdrawal history</h2>
        <Card>
          {history.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-12 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-neutral-800"><ArrowUpFromLine size={22} /></span>
              <p className="mt-3 text-sm font-medium">No withdrawals yet</p>
              <p className="mt-1 max-w-xs text-sm text-neutral-500">Money you send to your bank will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {history.map((s) => {
                const tone = s.status === "successful" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : s.status === "failed" ? "bg-red-500/10 text-red-600 dark:text-red-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400";
                return (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone}`}><ArrowUpFromLine size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">-{formatAsset(s.amount, s.currency)}</div>
                      <div className="truncate text-xs text-neutral-500">
                        {new Date(s.createdAt).toLocaleString()}
                        {s.failureReason ? ` · ${s.failureReason}` : ""}
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${tone}`}>{s.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
