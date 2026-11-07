"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";

const TAUTAN_HALAMAN = [
  { href: "#beranda", label: "Beranda" },
  { href: "#cara-kerja", label: "Cara Kerja" },
  { href: "#tentang", label: "Tentang Kirana" },
];

const kelasTautan = "flex min-h-11 items-center text-sm font-semibold text-slate-600 no-underline hover:text-navy";
const kelasGuru =
  "inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-slate-200 px-4 text-sm font-bold text-navy no-underline hover:bg-slate-50";
const kelasSiswa =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-coral-red px-4 text-sm font-extrabold text-white no-underline shadow-xs hover:bg-coral-red-hover";

/** Navbar landing (desain baru). Di ≤860px berubah menjadi tombol menu. */
export function PublicNavbar() {
  const [buka, setBuka] = useState(false);
  const tutup = () => setBuka(false);

  return (
    <header className="gaya-baru sticky top-0 z-20 border-b border-slate-100 bg-white px-6">
      <div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between gap-4">
        <Link href="/" aria-label="Kirana, beranda" className="no-underline">
          <Logo tinggi={40} prioritas />
        </Link>

        <nav aria-label="Navigasi utama" className="flex items-center gap-8 max-[860px]:hidden">
          {TAUTAN_HALAMAN.map((t, i) => (
            <a
              key={t.href}
              href={t.href}
              className={i === 0 ? `${kelasTautan} font-bold! text-turquoise-ink!` : kelasTautan}
            >
              {t.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 max-[860px]:hidden">
          <Link href="/login" className={kelasGuru}>
            Masuk sebagai Guru
          </Link>
          <Link href="/join" className={kelasSiswa}>
            Masuk Kuis sebagai Siswa
          </Link>
        </div>

        <button
          type="button"
          aria-expanded={buka}
          aria-controls="menu-hp"
          aria-label={buka ? "Tutup menu" : "Buka menu"}
          onClick={() => setBuka((b) => !b)}
          className="hidden size-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-navy max-[860px]:inline-flex"
        >
          <Icon nama={buka ? "tutup" : "menu"} ukuran={22} />
        </button>
      </div>

      {buka && (
        <nav id="menu-hp" aria-label="Menu" className="hidden flex-col gap-1 pt-2 pb-4 max-[860px]:flex">
          {TAUTAN_HALAMAN.map((t) => (
            <a key={t.href} href={t.href} className={kelasTautan} onClick={tutup}>
              {t.label}
            </a>
          ))}
          <Link href="/login" className={`${kelasGuru} mt-2`} onClick={tutup}>
            Masuk sebagai Guru
          </Link>
          <Link href="/join" className={kelasSiswa} onClick={tutup}>
            Masuk Kuis sebagai Siswa
          </Link>
        </nav>
      )}
    </header>
  );
}
