import type { ReactNode } from "react";

/**
 * Kerangka halaman berkartu di tengah, gaya baru (A2, A3, C1, C3).
 * Latar putih, kartu bergaris slate-200 dengan sudut 24px.
 * Di ≤600px kartu menjadi penuh lebar tanpa bingkai.
 * `atas` diletakkan di atas kartu (misalnya tautan "Kembali ke beranda").
 */
export function SiswaLayout({ children, atas }: { children: ReactNode; atas?: ReactNode }) {
  return (
    <div className="gaya-baru box-border flex min-h-screen flex-col items-center bg-white px-6 py-8 max-[600px]:px-0 max-[600px]:pt-3 max-[600px]:pb-0">
      {atas && <div className="mb-4 flex w-full max-w-md justify-start max-[600px]:px-4">{atas}</div>}
      <main className="flex w-full flex-1 items-center justify-center max-[600px]:items-stretch">{children}</main>
    </div>
  );
}

export function KartuSiswa({
  children,
  lebarMaks = 448,
  labelledBy,
  rataTengah = true,
}: {
  children: ReactNode;
  lebarMaks?: number;
  labelledBy?: string;
  rataTengah?: boolean;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      style={{ maxWidth: lebarMaks }}
      className={`box-border flex w-full flex-col gap-5 rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-soft max-[600px]:max-w-none! max-[600px]:flex-1 max-[600px]:rounded-none max-[600px]:border-0 max-[600px]:px-4 max-[600px]:pt-4 max-[600px]:pb-[calc(24px+env(safe-area-inset-bottom,0px))] max-[600px]:shadow-none ${
        rataTengah ? "text-center" : ""
      }`}
    >
      {children}
    </section>
  );
}

/** Tombol aksi yang menempel di bawah layar pada ≤600px. */
export function AksiBawah({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 max-[600px]:sticky max-[600px]:bottom-0 max-[600px]:mt-auto max-[600px]:bg-white max-[600px]:pt-3 max-[600px]:pb-[env(safe-area-inset-bottom,0px)]">
      {children}
    </div>
  );
}

/** Gelembung info turquoise di kartu siswa (desain baru). */
export function GelembungInfo({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-turquoise/30 bg-turquoise-light px-3 py-2.5 text-xs font-bold text-turquoise-ink">
      {children}
    </div>
  );
}
