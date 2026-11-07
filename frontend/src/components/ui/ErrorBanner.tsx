import type { ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Pesan galat yang diumumkan pembaca layar (role="alert").
 * `aksi` opsional, misalnya tombol "Coba lagi".
 */
export function ErrorBanner({ children, aksi, id }: { children: ReactNode; aksi?: ReactNode; id?: string }) {
  return (
    <div
      id={id}
      role="alert"
      className="flex flex-wrap items-start gap-2.5 rounded-input border-[1.5px] border-danger bg-danger-soft px-3.5 py-3 text-left text-sm font-semibold text-danger-ink"
    >
      <Icon nama="peringatan" ukuran={18} tebal={2.5} className="mt-px flex-none text-danger" />
      <span className="min-w-0 flex-1">{children}</span>
      {aksi}
    </div>
  );
}
