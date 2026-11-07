"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { KartuSiswa, SiswaLayout } from "@/components/layout/SiswaLayout";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Tombol, TombolLink } from "@/components/ui/Tombol";
import { lepasAttempt } from "@/services/kirana";
import { useKuis } from "../KuisProvider";
import { LayarJaringan, LayarMemuat, LayarTidakValid } from "../LayarStatus";

/** C3 · Konfirmasi pengumpulan berhasil. Tidak ada diagnosis untuk siswa. */
export function Selesai() {
  const { kode, keadaan, muatUlang } = useKuis();
  const router = useRouter();
  const [melepas, setMelepas] = useState(false);

  const siap = keadaan.fase === "siap" ? keadaan : null;
  const belumKumpul = !!siap && !siap.attempt?.dikumpulkanPada;
  useEffect(() => {
    if (belumKumpul && kode && !melepas) router.replace(`/kuis/${kode}`);
  }, [belumKumpul, kode, melepas, router]);

  if (keadaan.fase === "memuat") return <LayarMemuat />;
  if (keadaan.fase === "tidak_valid") return <LayarTidakValid />;
  if (keadaan.fase === "jaringan") return <LayarJaringan pesan={keadaan.pesan} onCobaLagi={muatUlang} />;
  if (!keadaan.attempt?.dikumpulkanPada) return <LayarMemuat teks="Mengarahkan…" />;

  const { sesi, attempt } = keadaan;

  async function siswaLain() {
    setMelepas(true);
    await lepasAttempt(sesi.kode);
    muatUlang();
    router.push(`/kuis/${sesi.kode}`);
  }

  return (
    <SiswaLayout>
      <KartuSiswa labelledBy="judul-selesai">
        <div className="mx-auto">
          <Logo tinggi={40} />
        </div>
        <div role="status" className="flex flex-col items-center gap-4 py-4">
          <span className="flex size-22 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <Icon nama="centang" ukuran={44} tebal={2.5} />
          </span>
          <h1 id="judul-selesai" className="m-0 text-2xl font-extrabold text-navy">
            Jawabanmu sudah dikumpulkan.
          </h1>
          <p className="m-0 text-sm leading-relaxed text-slate-600">
            Terima kasih, {attempt.nama}. Gurumu akan membahas hasilnya bersamamu.
          </p>
          <span className="text-xs text-slate-500">
            Kode kuis <span className="angka font-bold">{sesi.kode}</span> · {sesi.jumlahSoal} soal
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          <TombolLink href="/" varian="garis" penuh tinggi={48}>
            Kembali ke beranda
          </TombolLink>
          {sesi.status === "terbuka" && (
            <Tombol varian="garis" penuh tinggi={48} onClick={siswaLain} aria-busy={melepas} className="border-transparent! text-sm text-slate-600">
              Siswa lain di perangkat ini? Mulai sebagai siswa lain
            </Tombol>
          )}
        </div>
      </KartuSiswa>
    </SiswaLayout>
  );
}
