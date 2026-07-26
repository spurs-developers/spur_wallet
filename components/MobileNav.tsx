// components/MobileNav.tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X, Wallet } from "lucide-react";
import { NavLinks } from "./Sidebar";

export default function MobileNav() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  function open() {
    setMounted(true);
    requestAnimationFrame(() => setVisible(true));
  }
  function close() {
    setVisible(false);
    setTimeout(() => setMounted(false), 200);
  }

  useEffect(() => {
    if (!mounted) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [mounted]);

  return (
    <>
      <button
        onClick={open}
        aria-label="Open menu"
        className="grid h-9 w-9 place-items-center rounded-lg text-neutral-600 hover:bg-neutral-100 md:hidden dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <Menu size={20} />
      </button>

      {mounted &&
        createPortal(
          <div
            className={`fixed inset-0 z-50 flex bg-black/50 transition-opacity duration-200 md:hidden ${
              visible ? "opacity-100" : "opacity-0"
            }`}
            onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
          >
            <div
              role="dialog"
              aria-modal="true"
              className={`flex h-full w-72 max-w-[80%] flex-col border-r border-neutral-200 bg-white transition-transform duration-200 dark:border-neutral-800 dark:bg-neutral-950 ${
                visible ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="flex h-16 items-center justify-between px-5">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-white">
                    <Wallet size={15} />
                  </span>
                  Spurs Wallet
                </span>
                <button
                  onClick={close}
                  aria-label="Close menu"
                  className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <X size={16} />
                </button>
              </div>
              <NavLinks onNavigate={close} />
              <div className="border-t border-neutral-200 px-5 py-4 text-xs text-neutral-400 dark:border-neutral-800">
                Part of Spurs Cloud
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}