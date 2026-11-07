"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AksiBawah, KartuSiswa, SiswaLayout } from "@/components/layout/SiswaLayout";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon, type NamaIcon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Tombol } from "@/components/ui/Tombol";
import { KiranaError, type Attempt, type SesiSiswa, type Soal } from "@/lib/types";
import { ambilAttempt, kumpulkan } from "@/services/kirana";
import { useKuis } from "../KuisProvider";
import { LayarJaringan, LayarMemuat, LayarTidakValid } from "../LayarStatus";

/** C3 · Ringkasan sebelum mengumpulkan (desain baru, ikon kategori gaya lama). */
export function Ringkasan() {
  const { kode, keadaan, muatUlang, setAttempt } = useKuis();
  const router = useRouter();

  const siap = keadaan.fase === "siap" ? keadaan : null;
  const tujuan = !siap || !kode
    ? null
    : !siap.attempt
      ? `/kuis/${kode}`
      : siap.attempt.dikumpulkanPada
        ? `/kuis/${kode}/selesai`
        : siap.attempt.respons.length < 15 ? `/kuis/${kode}/kerjakan/${siap.attempt.urutanTerakhir}` : null;
  useEffect(() => {
    if (tujuan) router.replace(tujuan);
  }, [tujuan, router]);

  if (keadaan.fase === "memuat") return <LayarMemuat />;
  if (keadaan.fase === "tidak_valid") return <LayarTidakValid />;
  if (keadaan.fase === "jaringan") return <LayarJaringan pesan={keadaan.pesan} onCobaLagi={muatUlang} />;
  if (tujuan || !keadaan.attempt) return <LayarMemuat teks="Mengarahkan…" />;

  return <IsiRingkasan sesi={keadaan.sesi} soal={keadaan.soal} attempt={keadaan.attempt} onTersimpan={setAttempt} />;
}

function Kategori({
  ikon,
  label,
  jumlah,
  kelasBaris,
  kelasIkon,
  tebal = 3,
}: {
  ikon: NamaIcon;
  label: string;
  jumlah: number;
  kelasBaris: string;
  kelasIkon: string;
  tebal?: number;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-sm font-bold ${kelasBaris}`}>
      <dt className="flex items-center gap-2.5">
        {/* Ikon di container terpisah, bukan menyatu dengan teks */}
        <span aria-hidden="true" className={`flex size-[26px] flex-none items-center justify-center rounded-[7px] ${kelasIkon}`}>
          <Icon nama={ikon} ukuran={15} tebal={tebal} />
        </span>
        {label}
      </dt>
      <dd className="angka m-0 text-lg font-black">{jumlah}</dd>
    </div>
  );
}

function IsiRingkasan({
  sesi,
  soal,
  attempt,
  onTersimpan,
}: {
  sesi: SesiSiswa;
  soal: Soal[];
  attempt: Attempt;
  onTersimpan: (a: Attempt) => void;
}) {
  const router = useRouter();
  const [fase, setFase] = useState<"diam" | "memuat" | "gagal">("diam");
  const [pesan, setPesan] = useState("");

  // Hitung dari jawaban aktual. Soal tanpa respons dihitung sebagai dilewati.
  const responsSoal = soal.map((s) => attempt.respons.find((r) => r.soalId === s.id));
  const memilih = responsSoal.filter((r) => r?.jenis === "opsi").length;
  const diLuar = responsSoal.filter((r) => r?.jenis === "di_luar_opsi").length;
  const nomorDilewati = soal.filter((_, i) => !responsSoal[i] || responsSoal[i]!.jenis === "dilewati").map((s) => s.urutan);

  async function kirim() {
    if (fase === "memuat") return;
    setFase("memuat");
    try {
      await kumpulkan(sesi.kode);
      const terbaru = await ambilAttempt(sesi.kode);
      // Perbarui progres dulu agar halaman selesai langsung tahu jawaban sudah terkumpul.
      if (terbaru) onTersimpan(terbaru);
      router.push(`/kuis/${sesi.kode}/selesai`);
    } catch (err) {
      setPesan(
        err instanceof KiranaError && err.kodeError === "sesi_ditutup"
          ? "Sesi kuis ini sudah ditutup oleh guru. Jawaban tidak bisa dikumpulkan lagi."
          : "Jawaban belum berhasil dikumpulkan. Pilihanmu tetap tersimpan, silakan coba lagi.",
      );
      setFase("gagal");
    }
  }

  return (
    <SiswaLayout>
      <KartuSiswa labelledBy="judul-ringkasan">
        <div className="mx-auto">
          <Logo tinggi={40} />
        </div>

        <div className="flex flex-col gap-1">
          <p className="m-0 text-sm font-bold text-slate-500">
            {attempt.nama} · <span className="angka">{sesi.kode}</span>
          </p>
          <h1 id="judul-ringkasan" className="m-0 text-2xl font-extrabold text-navy">
            Soal {soal.length} dari {soal.length} selesai
          </h1>
          <p className="m-0 text-lg font-bold text-slate-600">Siap dikumpulkan?</p>
          <p className="m-0 text-xs text-slate-500">
            Periksa ringkasan di bawah. Jawaban yang sudah dilanjutkan terkunci.
          </p>
        </div>

        {fase === "gagal" && <ErrorBanner>{pesan}</ErrorBanner>}

        <dl className="m-0 flex flex-col gap-3 text-left">
          <Kategori
            ikon="centang"
            label="Memilih jawaban"
            jumlah={memilih}
            kelasBaris="border-emerald-200 bg-emerald-50 text-emerald-900"
            kelasIkon="bg-white text-emerald-700"
          />
          <Kategori
            ikon="tanya"
            label="Hasil tidak ada di pilihan"
            jumlah={diLuar}
            kelasBaris="border-amber-200 bg-amber-50 text-amber-900"
            kelasIkon="bg-white text-amber-700"
            tebal={2.75}
          />
          <Kategori
            ikon="panah-kanan"
            label="Dilewati"
            jumlah={nomorDilewati.length}
            kelasBaris="border-slate-200 bg-slate-50 text-slate-700"
            kelasIkon="bg-white text-slate-600"
            tebal={2.5}
          />
        </dl>

        {nomorDilewati.length > 0 && (
          <div className="flex flex-col gap-2 text-left">
            <span className="text-xs font-bold text-navy">Soal yang kamu lewati:</span>
            <div className="flex flex-wrap gap-2">
              {nomorDilewati.map((n) => (
                <span key={n} className="rounded-xl bg-slate-100 p-3">Soal {n}</span>
              ))}
            </div>
            <span className="text-xs text-slate-500">Tidak apa-apa jika memang belum bisa dijawab.</span>
          </div>
        )}

        <AksiBawah>
          <Tombol varian="biru" penuh tinggi={52} onClick={kirim} aria-busy={fase === "memuat"} aria-disabled={fase === "memuat"}>
            {fase === "memuat" ? "Mengumpulkan…" : fase === "gagal" ? "Coba kumpulkan lagi" : "Kumpulkan Jawaban"}
          </Tombol>

        </AksiBawah>
      </KartuSiswa>
    </SiswaLayout>
  );
}
