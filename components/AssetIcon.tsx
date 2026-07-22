import { Bitcoin, Gem, CircleDollarSign, Zap, Banknote, DollarSign, Coins, type LucideIcon } from "lucide-react";

/**
 * Token/currency marks. Lucide ships a real Bitcoin glyph; it has no brand icons
 * for ETH/SOL/USDT, so each gets a semantically apt lucide icon plus its brand
 * colour — consistent iconography instead of raw currency symbols.
 */
const ICONS: Record<string, { icon: LucideIcon; cls: string }> = {
  BTC: { icon: Bitcoin, cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  ETH: { icon: Gem, cls: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  USDT: { icon: CircleDollarSign, cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  SOL: { icon: Zap, cls: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400" },
  NGN: { icon: Banknote, cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  USD: { icon: DollarSign, cls: "bg-green-500/15 text-green-600 dark:text-green-400" },
};

export default function AssetIcon({ code, size = 16, className = "" }: { code: string; size?: number; className?: string }) {
  const { icon: Icon, cls } = ICONS[code] ?? { icon: Coins, cls: "bg-neutral-500/15 text-neutral-500" };
  return (
    <span className={`grid place-items-center rounded-full ${cls} ${className}`}>
      <Icon size={size} />
    </span>
  );
}
