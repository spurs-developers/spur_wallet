// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ArrowLeftRight, Send, Repeat, Landmark, Settings, Wallet, Bitcoin,
} from "lucide-react";

export const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/dashboard/crypto", label: "Crypto", icon: Bitcoin },
  { href: "/dashboard/send", label: "Send", icon: Send },
  { href: "/dashboard/convert", label: "Convert", icon: Repeat },
  { href: "/dashboard/settlements", label: "Settlements", icon: Landmark },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

/** Shared nav list — used by the desktop Sidebar and the mobile sheet. */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-2">
      {NAV.map((item) => {
        const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            <Icon size={17} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-neutral-200 bg-white md:flex dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex h-16 items-center gap-2 px-5 font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-white"><Wallet size={15} /></span>
        Spurs Wallet
      </div>
      <NavLinks />
      <div className="border-t border-neutral-200 px-5 py-4 text-xs text-neutral-400 dark:border-neutral-800">
        Part of Spurs Cloud
      </div>
    </aside>
  );
}