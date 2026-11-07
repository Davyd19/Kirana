import type { ReactNode } from "react";
import { KartuSiswa, SiswaLayout } from "@/components/layout/SiswaLayout";
import { Icon, type NamaIcon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Tombol, TombolLink } from "@/components/ui/Tombol";

/** Kartu status di alur siswa (tautan tidak valid, sesi ditutup, gangguan). */
export function LayarStatus({
  ikon,
  warnaIkon = "bg-slate-100 text-slate-700",
  judul,
  children,
  aksi,
}: {
  ikon?: NamaIcon;
  warnaIkon?: string;
  judul: string;
  children?: ReactNode;
  aksi?: ReactNode;
}) {
  return (
    <SiswaLayout>
      <KartuSiswa labelledBy="judul-status">
        <div className="mx-auto">
          <Logo tinggi={40} />
        </div>
        {ikon && (
          <span className={`mx-auto flex size-13 items-center justify-center rounded-2xl ${warnaIkon}`}>
            <Icon nama={ikon} ukuran={26} tebal={2.2} />
          </span>
        )}
        <div role="alert" className="flex flex-col gap-2">
          <h1 id="judul-status" className="m-0 text-2xl font-extrabold text-navy">
            {judul}
          </h1>
          {children && <div className="text-sm leading-relaxed text-slate-600">{children}</div>}
        </div>
        {aksi && <div className="flex flex-col gap-2.5">{aksi}</div>}
      </KartuSiswa>
    </SiswaLayout>
  );
}

export function LayarMemuat({ teks = "Memuat kuis…" }: { teks?: string }) {
  return (
    <SiswaLayout>
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 text-sm text-slate-600">
        <Logo tinggi={56} tanpaNama dekoratif />
        {teks}
      </div>
    </SiswaLayout>
  );
}

export function LayarTidakValid() {
  return (
    <LayarStatus
      ikon="peringatan"
      judul="Tautan tidak dikenali"
      aksi={
        <TombolLink href="/join" varian="coral" penuh tinggi={52}>
          Masukkan kode kuis
        </TombolLink>
      }
    >
      Kode kuis tidak ditemukan. Periksa kembali kode yang dimasukkan, atau ketik kode yang ditulis gurumu.
    </LayarStatus>
  );
}

export function LayarJaringan({ pesan, onCobaLagi }: { pesan: string; onCobaLagi: () => void }) {
  return (
    <LayarStatus
      ikon="peringatan"
      warnaIkon="bg-danger-soft text-danger"
      judul="Koneksi terganggu"
      aksi={
        <Tombol varian="biru" penuh tinggi={52} onClick={onCobaLagi}>
          Coba lagi
        </Tombol>
      }
    >
      {pesan}
    </LayarStatus>
  );
}

export function LayarDitutup({ kode }: { kode: string }) {
  return (
    <LayarStatus
      ikon="gembok"
      warnaIkon="bg-amber-50 text-amber-800"
      judul="Sesi ini sudah ditutup"
      aksi={
        <TombolLink href="/join" varian="garis" penuh tinggi={52}>
          Masukkan kode lain
        </TombolLink>
      }
    >
      Sesi kuis ini sudah ditutup oleh guru. Kuis <span className="angka font-bold">{kode}</span> tidak menerima
      jawaban lagi. Minta tautan atau QR yang baru kepada gurumu.
    </LayarStatus>
  );
}
