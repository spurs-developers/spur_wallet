"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ASSETS } from "@/lib/assets";
import { startTopupAction } from "@/app/dashboard/actions";

const FIAT = Object.values(ASSETS).filter((a) => a.kind === "fiat");
const QUICK = [1000, 5000, 10000, 25000];

export default function AddMoney() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3.5 text-sm font-medium text-white transition hover:bg-emerald-700"
      >
        <Plus size={16} /> Add money
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add money</h2>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <X size={16} />
              </button>
            </div>
            <p className="mt-1 text-sm text-neutral-500">Top up with card, bank transfer or USSD via Spurs Pay.</p>

            <form action={startTopupAction} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Amount</label>
                <div className="flex gap-2">
                  <input
                    name="amount" value={amount} onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal" required placeholder="0.00" autoFocus
                    className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  <select name="asset" defaultValue="NGN" className="h-11 rounded-lg border border-neutral-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-950">
                    {FIAT.map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {QUICK.map((q) => (
                  <button key={q} type="button" onClick={() => setAmount(String(q))}
                    className="rounded-lg border border-neutral-200 py-1.5 text-xs font-medium text-neutral-600 hover:border-emerald-500 hover:text-emerald-600 dark:border-neutral-700 dark:text-neutral-300">
                    {q.toLocaleString()}
                  </button>
                ))}
              </div>

              <button type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-medium text-white transition hover:bg-emerald-700">
                Continue to payment
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
