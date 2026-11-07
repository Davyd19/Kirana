"use client";
import { namaKategori } from "@/lib/types";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AksiBawah, GelembungInfo, KartuSiswa, SiswaLayout } from "@/components/layout/SiswaLayout";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Tombol } from "@/components/ui/Tombol";
import { namaOperasiBersusun } from "@/lib/format";
import { KiranaError, type Attempt, type SesiSiswa } from "@/lib/types";
import { daftarkanPeserta, lepasAttempt } from "@/services/kirana";
import { LayarDitutup, LayarJaringan, LayarMemuat, LayarTidakValid } from "./LayarStatus";
import { useKuis } from "./KuisProvider";

/** C1 · Siswa mengisi nama (desain baru). */
export function IsiNama() {
  const { keadaan, muatUlang, setAttempt } = useKuis();

  if (keadaan.fase === "memuat") return <LayarMemuat />;
  if (keadaan.fase === "tidak_valid") return <LayarTidakValid />;
  if (keadaan.fase === "jaringan") return <LayarJaringan pesan={keadaan.pesan} onCobaLagi={muatUlang} />;

  const { sesi, attempt } = keadaan;
  if (sesi.status !== "terbuka" && !attempt) return <LayarDitutup kode={sesi.kode} />;

  return (
    <FormNama
      sesi={sesi}
      attempt={attempt}
      onLepas={async () => {
        await lepasAttempt(sesi.kode);
        muatUlang();
      }}
      onTerdaftar={setAttempt}
    />
  );
}

function FormNama({
  sesi,
  attempt,
  onLepas,
  onTerdaftar,
}: {
  sesi: SesiSiswa;
  attempt: Attempt | null;
  onLepas: () => void;
  onTerdaftar: (a: Attempt) => void;
}) {
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [dicoba, setDicoba] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const kosong = dicoba && !nama.trim();
  const terbuka = sesi.status === "terbuka";

  async function mulai(e: FormEvent) {
    e.preventDefault();
    if (memuat) return;
    setDicoba(true);
    if (!nama.trim()) {
      inputRef.current?.focus();
      return;
    }
    setMemuat(true);
    setGalat("");
    try {
      const a = await daftarkanPeserta(sesi.kode, nama);
      onTerdaftar(a);
      router.push(`/kuis/${sesi.kode}/kerjakan/1`);
    } catch (err) {
      setGalat(err instanceof KiranaError ? err.message : "Belum bisa mulai. Silakan coba lagi.");
      setMemuat(false);
    }
  }

  // Saat baru saja mendaftar (memuat), tetap tampilkan formulir sampai pindah ke soal 1.
  const sedangMengerjakan = attempt !== null && !attempt.dikumpulkanPada && !memuat;
  const sudahMengumpulkan = attempt !== null && !!attempt.dikumpulkanPada;

  return (
    <SiswaLayout>
      <KartuSiswa labelledBy="judul-nama">
        <p className="m-0 flex items-center justify-center gap-1.5 text-sm font-bold text-emerald-700">
          <Icon nama="centang" ukuran={16} tebal={3} />
          <span>
            Kamu masuk ke kuis <span className="angka">{sesi.kode}</span>
          </span>
        </p>

        <div className="animasi-melayang mx-auto flex h-24 items-center justify-center">
          <Logo tinggi={88} tanpaNama prioritas />
        </div>

        <GelembungInfo>
          {namaOperasiBersusun(sesi.operasi)} · {namaKategori(sesi.numberCategory)} · {sesi.jumlahSoal} soal · pilih satu jawaban tiap soal · boleh dilewati
        </GelembungInfo>

        {sedangMengerjakan ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 id="judul-nama" className="m-0 text-2xl font-extrabold text-navy">
                Lanjutkan sebagai {attempt.nama}?
              </h1>
              <p className="m-0 text-xs text-slate-500">
                Di perangkat ini ada pengerjaan yang belum dikumpulkan. Pilihanmu tetap tersimpan.
              </p>
            </div>
            <AksiBawah>
              <Tombol
                varian="coral"
                penuh
                tinggi={52}
                onClick={() => router.push(attempt.respons.length === 15 ? `/kuis/${sesi.kode}/konfirmasi` : `/kuis/${sesi.kode}/kerjakan/${attempt.urutanTerakhir || 1}`)}
              >
                Lanjutkan ke soal {attempt.urutanTerakhir || 1}
                <Icon nama="panah-kanan" ukuran={16} tebal={2.5} />
              </Tombol>
              <Tombol varian="garis" penuh tinggi={48} onClick={onLepas}>
                Mulai sebagai siswa lain
              </Tombol>
            </AksiBawah>
          </div>
        ) : sudahMengumpulkan ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 id="judul-nama" className="m-0 text-2xl font-extrabold text-navy">
                {attempt.nama} sudah mengumpulkan
              </h1>
              <p className="m-0 text-xs text-slate-500">
                Jawaban dari perangkat ini sudah dikumpulkan. Siswa lain bisa mulai mengerjakan di sini.
              </p>
            </div>
            <AksiBawah>
              {terbuka ? (
                <Tombol varian="coral" penuh tinggi={52} onClick={onLepas}>
                  Mulai sebagai siswa lain
                </Tombol>
              ) : (
                <p className="m-0 text-sm font-semibold text-slate-600">Sesi kuis ini sudah ditutup oleh guru.</p>
              )}
            </AksiBawah>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h1 id="judul-nama" className="m-0 text-2xl font-extrabold text-navy">
                Siapa Namamu?
              </h1>
              <p className="m-0 text-xs text-slate-500">
                Tidak perlu akun. Tulis nama panggilan atau kode siswa supaya gurumu bisa mengenali hasilmu.
              </p>
            </div>

            {galat && <ErrorBanner>{galat}</ErrorBanner>}

            <form noValidate onSubmit={mulai} className="flex flex-col gap-5 text-left" aria-busy={memuat}>
              <div className="flex flex-col gap-1">
                <label htmlFor="nama" className="text-xs font-bold text-navy">
                  Nama Panggilan <span aria-hidden="true" className="text-danger">*</span>
                  <span className="sr-only">(wajib)</span>
                </label>
                <input
                  ref={inputRef}
                  id="nama"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Rara"
                  autoComplete="nickname"
                  maxLength={40}
                  aria-required="true"
                  aria-invalid={kosong}
                  aria-describedby="nama-pesan"
                  className={`box-border h-[52px] w-full rounded-2xl bg-slate-50 px-4 text-base font-bold text-navy placeholder:font-semibold placeholder:text-slate-400 focus:border-turquoise focus:bg-white ${
                    kosong ? "border-2 border-danger" : "border-2 border-slate-200"
                  }`}
                />
                {kosong ? (
                  <span id="nama-pesan" role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                    <Icon nama="peringatan" ukuran={16} tebal={2.5} />
                    Isi namamu dulu sebelum mulai.
                  </span>
                ) : (
                  <span id="nama-pesan" className="text-xs text-slate-500">
                    {nama.trim() ? `Kamu akan tercatat sebagai “${nama.trim()}”.` : "Nama ini hanya terlihat oleh gurumu."}
                  </span>
                )}
              </div>

              <AksiBawah>
                <Tombol type="submit" varian="coral" penuh tinggi={52} aria-busy={memuat} aria-disabled={memuat}>
                  {memuat ? "Menyiapkan soal…" : "Mulai Mengerjakan"}
                  {!memuat && <Icon nama="panah-kanan" ukuran={16} tebal={2.5} />}
                </Tombol>
              </AksiBawah>
            </form>
          </>
        )}

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs">
          <Link href="/join" className="flex min-h-11 items-center font-bold text-turquoise-ink hover:underline">
            Bukan kuis ini? Masukkan kode lain
          </Link>
          <Link href="/" className="flex min-h-11 items-center font-semibold text-slate-500 hover:text-navy">
            Keluar ke beranda
          </Link>
        </div>
      </KartuSiswa>
    </SiswaLayout>
  );
}
