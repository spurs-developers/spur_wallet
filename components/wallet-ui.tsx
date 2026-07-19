import type { ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Transaction } from "@/lib/db/schema";
import { formatAsset } from "@/lib/assets";

export const SOURCE_LABEL: Record<string, string> = {
  top_up: "Top-up",
  gift_card: "Gift card",
  crypto_deposit: "Crypto deposit",
  payment: "Payment",
  withdrawal: "Withdrawal",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  conversion: "Conversion",
};

// Accent per asset — used for the balance chips (not for chart series).
export const ASSET_ACCENT: Record<string, string> = {
  NGN: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  USD: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  USDT: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  BTC: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/40 ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold tracking-tight ${accent ?? ""}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </Card>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function TxnList({ txns, empty }: { txns: Transaction[]; empty?: string }) {
  if (txns.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-neutral-500">{empty ?? "No transactions yet."}</p>;
  }
  return (
    <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
      {txns.map((t) => {
        const credit = t.direction === "credit";
        return (
          <li key={t.reference} className="flex items-center gap-3 px-5 py-3.5">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${credit ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"}`}>
              {credit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{t.description ?? SOURCE_LABEL[t.source] ?? t.source}</div>
              <div className="text-xs text-neutral-500">
                {SOURCE_LABEL[t.source] ?? t.source} · {new Date(t.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className={`text-sm font-semibold ${credit ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-800 dark:text-neutral-200"}`}>
                {credit ? "+" : "-"}{formatAsset(t.amount, t.asset)}
              </div>
              <div className="text-[11px] text-neutral-400">{t.asset}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
