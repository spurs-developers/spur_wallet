// components/AddMoney.tsx
"use client";

import { useId, useState } from "react";
import { Plus, X, Landmark, Copy, Check } from "lucide-react";
import { ASSETS } from "@/lib/assets";
import { startTopupAction } from "@/app/dashboard/actions";
import Modal from "@/components/Modal";

const FIAT = Object.values(ASSETS).filter((a) => a.kind === "fiat");
const QUICK = [1000, 5000, 10000, 25000];

interface DedicatedAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-neutral-500">{label}</span>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className={`flex items-center gap-1.5 text-sm font-medium ${mono ? "font-mono" : ""}`}
      >
        {value}
        {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-neutral-400" />}
      </button>
    </div>
  );
}

export default function AddMoney({ account }: { account?: DedicatedAccount | null }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const titleId = useId();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3.5 text-sm font-medium text-white transition hover:bg-emerald-700"
      >
        <Plus size={16} /> Add money
      </button>

      <Modal open={open} onClose={() => setOpen(false)} titleId={titleId}>
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold">Add money</h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-500">Transfer to your dedicated account, or pay with card.</p>

        {account && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
              <Landmark size={13} /> Your dedicated account
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="divide-y divide-emerald-100 dark:divide-emerald-900/40">
                <CopyRow label="Bank" value={account.bankName} />
                <CopyRow label="Account number" value={account.accountNumber} mono />
                <CopyRow label="Account name" value={account.accountName} />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">
              Any transfer to this account tops up your wallet automatically.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
              <span className="text-xs text-neutral-400">or pay with card</span>
              <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
        )}

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
      </Modal>
    </>
  );
}