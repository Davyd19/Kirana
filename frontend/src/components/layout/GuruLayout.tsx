"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { DataDemoBadge } from "@/components/ui/DataDemoBadge";
import { Dialog } from "@/components/ui/Dialog";
import { Icon, type NamaIcon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Tombol } from "@/components/ui/Tombol";
import type { AuthState } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { keluar, resetDataDemo } from "@/services/kirana";

/** Menu sidebar lama (nama, ikon, urutan). Pengaturan Akun sudah dihapus. */
const MENU: { href: string; label: string; ikon: NamaIcon }[] = [
  { href: "/guru/dashboard", label: "Dashboard", ikon: "dashboard" },
  { href: "/guru/sesi", label: "Sesi Kuis", ikon: "sesi" },
  { href: "/guru/hasil", label: "Hasil & Diagnosis", ikon: "hasil" },
  { href: "/guru/panduan", label: "Panduan Penggunaan", ikon: "panduan" },
];

/**
 * Halaman yang memakai gaya lama penuh (latar abu #F5F6F8):
 * Detail Sesi (B4), Hasil & Diagnosis (D1), Panduan (D3).
 * Halaman lain memakai latar putih desain baru.
 */
function pakaiGayaLama(pathname: string): boolean {
  if (pathname === "/guru/panduan") return true;
  if (/^\/guru\/hasil(\/[^/]+)?$/.test(pathname)) return true;
  return /^\/guru\/sesi\/[^/]+$/.test(pathname) && pathname !== "/guru/sesi/buat";
}

function Memuat({ teks }: { teks: string }) {
  return (
    <div role="status" aria-live="polite" className="gaya-baru flex min-h-screen items-center justify-center bg-white text-[15px] text-slate-600">
      {teks}
    </div>
  );
}

/** Isi sidebar: dipakai di sidebar desktop dan laci (drawer) HP/tablet. */
function IsiSidebar({
  auth,
  pathname,
  onNavigasi,
  onKeluar,
  onReset,
}: {
  auth: AuthState;
  pathname: string;
  onNavigasi?: () => void;
  onKeluar: () => void;
  onReset: () => void;
}) {
  const inisial = auth.guru.nama.replace(/^(Bu|Pak)\s+/i, "").charAt(0).toUpperCase();
  return (
    <div className="flex min-h-full flex-col gap-5 px-4 py-5">
      <div className="flex items-center justify-between gap-2">
        <Link href="/guru/dashboard" aria-label="Kirana, ke dashboard" className="no-underline" onClick={onNavigasi}>
          <Logo tinggi={36} />
        </Link>
        <DataDemoBadge />
      </div>

      <Link
        href="/guru/sesi/buat"
        onClick={onNavigasi}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-navy text-sm font-extrabold text-white no-underline shadow-sm hover:bg-navy-hover"
      >
        <Icon nama="tambah" ukuran={18} tebal={2.5} />
        Buat Sesi Baru
      </Link>

      <nav aria-label="Menu guru" className="flex flex-col gap-1">
        {MENU.map((m) => {
          const aktif = pathname === m.href || pathname.startsWith(m.href + "/");
          return (
            <Link
              key={m.href}
              href={m.href}
              onClick={onNavigasi}
              aria-current={aktif ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm no-underline ${
                aktif
                  ? "border-slate-200 bg-white font-extrabold text-navy shadow-xs"
                  : "border-transparent font-semibold text-slate-600 hover:bg-white hover:text-navy"
              }`}
            >
              <span className={aktif ? "text-turquoise-ink" : ""}>
                <Icon nama={m.ikon} />
              </span>
              {m.label}
              {aktif && <span aria-hidden="true" className="ml-auto size-2 rounded-full bg-turquoise" />}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2.5 rounded-xl bg-white p-3">
          <span
            aria-hidden="true"
            className="flex size-9 flex-none items-center justify-center rounded-full bg-navy font-bold text-white"
          >
            {inisial}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-bold text-navy">{auth.guru.nama}</span>
            <span className="truncate text-xs text-slate-500">{auth.guru.email}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onKeluar}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold text-rose-700 hover:bg-white"
        >
          <Icon nama="keluar" />
          Keluar
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-white hover:text-navy"
        >
          <Icon nama="muat-ulang" ukuran={16} />
          Reset data demo
        </button>
      </div>
    </div>
  );
}

/**
 * Kerangka halaman guru: sidebar vertikal kiri (struktur lama, warna baru).
 * - ≥1024px: sidebar tetap di kiri.
 * - <1024px: bar atas dengan tombol menu yang membuka sidebar sebagai laci.
 * Tidak ada navigasi bawah. Rute /guru/* dilindungi di sisi client.
 */
export function GuruLayout({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [laciBuka, setLaciBuka] = useState(false);
  const [konfirmasiReset, setKonfirmasiReset] = useState(false);
  const [mereset, setMereset] = useState(false);
  // Dinaikkan setelah reset data demo agar halaman aktif dipasang ulang dan memuat seed baru.
  const [versiData, setVersiData] = useState(0);

  useEffect(() => {
    if (auth === null) router.replace("/login");
  }, [auth, router]);

  if (auth === undefined) return <Memuat teks="Memuat…" />;
  if (auth === null) return <Memuat teks="Mengarahkan ke halaman masuk…" />;

  async function onKeluar() {
    setLaciBuka(false);
    await keluar();
    router.replace("/login");
  }

  async function onReset() {
    if (mereset) return;
    setMereset(true);
    await resetDataDemo();
    setVersiData((v) => v + 1);
    setMereset(false);
    setKonfirmasiReset(false);
    router.push("/guru/dashboard");
  }

  const props = {
    auth,
    pathname,
    onKeluar,
    onReset: () => {
      setLaciBuka(false);
      setKonfirmasiReset(true);
    },
  };

  return (
    <div className="flex min-h-screen bg-slate-50 max-lg:flex-col">
      {/* Sidebar desktop */}
      <aside
        aria-label="Navigasi guru"
        className="gaya-baru sticky top-0 hidden h-screen w-[248px] flex-none overflow-y-auto border-r border-slate-200 bg-slate-50 lg:block"
      >
        <IsiSidebar {...props} />
      </aside>

      {/* Bar atas HP/tablet */}
      <header className="gaya-baru sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setLaciBuka(true)}
          aria-label="Buka menu"
          aria-expanded={laciBuka}
          className="flex size-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-navy"
        >
          <Icon nama="menu" ukuran={22} />
        </button>
        <Link href="/guru/dashboard" aria-label="Kirana, ke dashboard" className="no-underline">
          <Logo tinggi={32} />
        </Link>
        <DataDemoBadge />
      </header>

      <Dialog buka={laciBuka} onTutup={() => setLaciBuka(false)} laci label="Navigasi guru" className="gaya-baru bg-slate-50">
        <div className="flex justify-end px-4 pt-3">
          <button
            type="button"
            onClick={() => setLaciBuka(false)}
            aria-label="Tutup menu"
            className="flex size-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-navy"
          >
            <Icon nama="tutup" ukuran={20} />
          </button>
        </div>
        <IsiSidebar {...props} onNavigasi={() => setLaciBuka(false)} />
      </Dialog>

      <Dialog
        buka={konfirmasiReset}
        onTutup={() => !mereset && setKonfirmasiReset(false)}
        labelledBy="reset-judul"
        describedBy="reset-isi"
        className="gaya-baru"
      >
        <h2 id="reset-judul" className="m-0 text-xl font-extrabold text-navy">
          Kembalikan data demo?
        </h2>
        <p id="reset-isi" className="m-0 text-sm leading-relaxed text-slate-600">
          Semua sesi dan pengumpulan di browser ini kembali ke data awal (KRN-4821 dan tiga sesi lain). Sesi yang
          kamu buat akan terhapus. Kamu tetap masuk sebagai {auth.guru.nama}.
        </p>
        <div className="mt-1.5 flex flex-wrap justify-end gap-2.5">
          <Tombol varian="garis" tinggi={44} onClick={() => setKonfirmasiReset(false)} disabled={mereset}>
            Batal
          </Tombol>
          <Tombol varian="navy" tinggi={44} onClick={onReset} aria-busy={mereset} aria-disabled={mereset}>
            {mereset ? "Mengembalikan…" : "Ya, reset data"}
          </Tombol>
        </div>
      </Dialog>

      <div className={`min-w-0 flex-1 ${pakaiGayaLama(pathname) ? "bg-page" : "bg-white"}`}>
        <main
          key={versiData}
          className="mx-auto box-border flex max-w-[1120px] flex-col gap-7 px-10 pt-8 pb-12 max-[700px]:px-4 max-[700px]:pt-5 max-[700px]:pb-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
