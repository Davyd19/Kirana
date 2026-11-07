import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const kelasTautan = "flex min-h-11 items-center text-sm font-semibold text-slate-600 no-underline hover:text-navy";

export function PublicFooter() {
  return (
    <footer className="gaya-baru border-t border-slate-100 bg-white px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="flex flex-col gap-2">
          <Logo tinggi={36} />
          <span className="text-xs text-slate-500">Asesmen diagnostik matematika untuk guru SD</span>
        </div>
        <nav aria-label="Navigasi footer" className="flex flex-wrap gap-x-6 gap-y-1">
          <a href="#beranda" className={kelasTautan}>Beranda</a>
          <a href="#cara-kerja" className={kelasTautan}>Cara Kerja</a>
          <a href="#tentang" className={kelasTautan}>Tentang Kirana</a>
          <Link href="/login" className={kelasTautan}>Masuk sebagai Guru</Link>
          <Link href="/join" className={kelasTautan}>Masuk Kuis</Link>
        </nav>
      </div>
    </footer>
  );
}
