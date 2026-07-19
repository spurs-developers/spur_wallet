"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, ExternalLink } from "lucide-react";

// Spurs account avatar + popover. Meant to be consistent across every Spurs app
// (accounts, baas, pay, wallet) — same avatar, same "Manage your Spurs Account".
const ACCOUNTS_URL = "http://localhost:8000/me";

export default function AccountMenu({ name, email }: { name?: string; email?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (name ?? email ?? "?").charAt(0).toUpperCase();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-semibold text-white ring-offset-2 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:ring-offset-neutral-950"
        title={email}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col items-center gap-2 border-b border-neutral-100 px-5 py-5 dark:border-neutral-800">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xl font-semibold text-white">
              {initial}
            </span>
            <div className="text-center">
              <div className="text-sm font-medium">{name ?? "Your account"}</div>
              <div className="text-xs text-neutral-500">{email}</div>
            </div>
            <a
              href={ACCOUNTS_URL}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Manage your Spurs Account <ExternalLink size={12} />
            </a>
          </div>
          <a
            href="/auth/logout"
            className="flex items-center gap-2 px-5 py-3 text-sm text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <LogOut size={15} /> Sign out
          </a>
        </div>
      )}
    </div>
  );
}
