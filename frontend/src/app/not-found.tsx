import { KartuSiswa, SiswaLayout } from "@/components/layout/SiswaLayout";
import { Logo } from "@/components/ui/Logo";
import { TombolLink } from "@/components/ui/Tombol";

export default function NotFound() {
  return (
    <SiswaLayout>
      <KartuSiswa labelledBy="judul-404">
        <div className="mx-auto">
          <Logo tinggi={48} />
        </div>
        <h1 id="judul-404" className="m-0 text-2xl font-extrabold text-navy">
          Halaman tidak ditemukan
        </h1>
        <p className="m-0 text-sm leading-relaxed text-slate-600">
          Alamat yang dibuka tidak ada. Periksa kembali tautannya atau kembali ke beranda.
        </p>
        <TombolLink href="/" varian="navy" penuh tinggi={48}>
          Kembali ke beranda
        </TombolLink>
      </KartuSiswa>
    </SiswaLayout>
  );
}
