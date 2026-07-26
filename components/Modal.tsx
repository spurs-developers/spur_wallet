// components/Modal.tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** id of the element that labels the dialog (usually your <h2>) */
  titleId: string;
  children: ReactNode;
  className?: string;
}

/**
 * Accessible modal primitive: portals to document.body (so it can't be clipped
 * or out-z-indexed by an ancestor), traps Tab focus inside the panel, closes on
 * Escape or backdrop click, locks background scroll, and restores focus to
 * whatever triggered it on close.
 */
export default function Modal({ open, onClose, titleId, children, className = "" }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false); // in the DOM at all
  const [visible, setVisible] = useState(false); // transitioned in

  // Mount/unmount with a short exit transition, and remember what to refocus.
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const timeout = setTimeout(() => setMounted(false), 150);
    return () => clearTimeout(timeout);
  }, [open]);

  // Lock background scroll while the modal is in the DOM.
  useEffect(() => {
    if (!mounted) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [mounted]);

  // Move focus into the panel on open (unless something inside already has
  // it, e.g. an autoFocus input); restore focus to the trigger on close.
  useEffect(() => {
    if (visible) {
      if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
    } else if (!open) {
      triggerRef.current?.focus?.();
    }
  }, [visible, open]);

  // Escape closes.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  // Keep Tab cycling within the panel.
  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-150 ${visible ? "opacity-100" : "opacity-0"}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trapTab}
        className={`w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl outline-none transition-all duration-150 dark:border-neutral-800 dark:bg-neutral-900 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        } ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}