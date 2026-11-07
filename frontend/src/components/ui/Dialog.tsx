"use client";

import { useEffect, useRef, type ReactNode } from "react";

const FOKUSABEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog modal dengan focus trap, Esc untuk menutup, dan fokus kembali ke
 * elemen pemicu setelah ditutup.
 * - `layarPenuh`: menutup seluruh layar (dipakai QR layar penuh).
 * - `laci`: panel setinggi layar dari kiri (sidebar guru di HP/tablet).
 */
export function Dialog({
  buka,
  onTutup,
  labelledBy,
  describedBy,
  label,
  layarPenuh = false,
  laci = false,
  className = "",
  children,
}: {
  buka: boolean;
  onTutup: () => void;
  labelledBy?: string;
  describedBy?: string;
  label?: string;
  layarPenuh?: boolean;
  laci?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tutupRef = useRef(onTutup);

  useEffect(() => {
    tutupRef.current = onTutup;
  }, [onTutup]);

  useEffect(() => {
    if (!buka) return;
    const pemicu = document.activeElement as HTMLElement | null;
    const kotak = ref.current;
    const pertama = kotak?.querySelector<HTMLElement>(FOKUSABEL);
    (pertama ?? kotak)?.focus();
    const overflowLama = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        tutupRef.current();
        return;
      }
      if (e.key !== "Tab" || !kotak) return;
      const daftar = Array.from(kotak.querySelectorAll<HTMLElement>(FOKUSABEL));
      if (daftar.length === 0) return;
      const awal = daftar[0];
      const akhir = daftar[daftar.length - 1];
      if (e.shiftKey && document.activeElement === awal) {
        e.preventDefault();
        akhir.focus();
      } else if (!e.shiftKey && document.activeElement === akhir) {
        e.preventDefault();
        awal.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowLama;
      pemicu?.focus?.();
    };
  }, [buka]);

  if (!buka) return null;

  if (layarPenuh) {
    return (
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        tabIndex={-1}
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-white p-6 text-center ${className}`}
      >
        {children}
      </div>
    );
  }

  if (laci) {
    return (
      <div
        className="fixed inset-0 z-50 flex justify-start bg-[rgba(20,27,45,0.55)]"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onTutup();
        }}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-label={label}
          tabIndex={-1}
          className={`flex h-full w-[min(300px,86vw)] flex-col overflow-y-auto ${className}`}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,27,45,0.55)] p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onTutup();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-label={label}
        tabIndex={-1}
        className={`flex w-full max-w-[440px] flex-col gap-3.5 rounded-[18px] bg-surface p-7 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
