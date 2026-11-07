"use client";
import { namaKategori } from "@/lib/types";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SoalBersusun } from "@/components/soal/SoalBersusun";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Tombol } from "@/components/ui/Tombol";
import { namaOperasi } from "@/lib/format";
import type { Attempt, Respons, SesiSiswa, Soal } from "@/lib/types";
import { simpanRespons } from "@/services/kirana";
import { LayarJaringan, LayarMemuat, LayarTidakValid } from "../../LayarStatus";
import { useKuis } from "../../KuisProvider";

/** C2 · Siswa mengerjakan satu soal per layar (desain baru, tanpa bantuan dan avatar). */
export function KerjakanSoal() {
  const params = useParams<{ urutan: string }>();
  const urutan = Number(params.urutan);
  const { kode, keadaan, muatUlang, setAttempt } = useKuis();
  const router = useRouter();

  const siap = keadaan.fase === "siap" ? keadaan : null;
  const urutanValid = Number.isInteger(urutan) && urutan >= 1 && urutan <= (siap?.soal.length ?? 15);

  // Penjaga rute: belum isi nama, sudah mengumpulkan, atau nomor soal tidak valid.
  const tujuan = !siap || !kode
    ? null
    : !siap.attempt
      ? `/kuis/${kode}`
      : siap.attempt.dikumpulkanPada
        ? `/kuis/${kode}/selesai`
        : siap.attempt.respons.length === 15
          ? `/kuis/${kode}/konfirmasi`
          : !urutanValid || urutan !== siap.attempt.urutanTerakhir
          ? `/kuis/${kode}/kerjakan/${siap.attempt.urutanTerakhir}`
          : null;
  useEffect(() => {
    if (tujuan) router.replace(tujuan);
  }, [tujuan, router]);

  if (keadaan.fase === "memuat") return <LayarMemuat />;
  if (keadaan.fase === "tidak_valid") return <LayarTidakValid />;
  if (keadaan.fase === "jaringan") return <LayarJaringan pesan={keadaan.pesan} onCobaLagi={muatUlang} />;
  if (tujuan || !keadaan.attempt) return <LayarMemuat teks="Mengarahkan…" />;

  return (
    <LayarSoal
      key={urutan}
      sesi={keadaan.sesi}
      soal={keadaan.soal}
      urutan={urutan}
      attempt={keadaan.attempt}
      onTersimpan={setAttempt}
    />
  );
}

type Pilihan = { jenis: "opsi"; opsiId: string } | { jenis: "di_luar_opsi" } | null;

function pilihanAwal(respons: Respons | undefined): Pilihan {
  if (!respons || respons.jenis === "dilewati") return null;
  return respons.jenis === "opsi" ? { jenis: "opsi", opsiId: respons.opsiId } : { jenis: "di_luar_opsi" };
}

function LayarSoal({
  sesi,
  soal,
  urutan,
  attempt,
  onTersimpan,
}: {
  sesi: SesiSiswa;
  soal: Soal[];
  urutan: number;
  attempt: Attempt;
  onTersimpan: (a: Attempt) => void;
}) {
  const router = useRouter();
  const s = soal[urutan - 1];
  const total = sesi.jumlahSoal;
  const [pilihan, setPilihan] = useState<Pilihan>(() => pilihanAwal(attempt.respons.find((r) => r.soalId === s.id)));
  const [pindah, setPindah] = useState(false);
  const [galat, setGalat] = useState("");
  const mengirim = useRef(false);
  const judulRef = useRef<HTMLHeadingElement>(null);

  const kode = sesi.kode;
  useEffect(() => { judulRef.current?.focus(); }, [urutan]);
  const dijawab = attempt.respons.length;
  const persen = Math.round((dijawab / total) * 100);
  function pilihOpsi(opsiId: string) { if (!mengirim.current) setPilihan({ jenis: "opsi", opsiId }); }
  function pilihLuar() { if (!mengirim.current) setPilihan({ jenis: "di_luar_opsi" }); }
  async function kirim(respons: Respons) {
    if (mengirim.current) return;
    mengirim.current = true;
    setPindah(true); setGalat("");
    try {
      onTersimpan(await simpanRespons(kode, respons, urutan));
      router.replace(urutan < total ? `/kuis/${kode}/kerjakan/${urutan + 1}` : `/kuis/${kode}/konfirmasi`);
    } catch (error) {
      setGalat(error instanceof Error ? error.message : "Jawaban belum terkirim. Coba lagi.");
      setPindah(false); mengirim.current = false;
    }
  }
  function lewati() { void kirim({ jenis: "dilewati", soalId: s.id }); }
  function lanjut() {
    if (!pilihan) return;
    void kirim(pilihan.jenis === "opsi" ? { jenis: "opsi", soalId: s.id, opsiId: pilihan.opsiId } : { jenis: "di_luar_opsi", soalId: s.id });
  }

  // Enter pada pilihan = lanjut (Spasi = memilih), sesuai petunjuk keyboard.
  function onKeyPilihan(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      lanjut();
    }
  }

  const opsiTerpilih = pilihan?.jenis === "opsi" ? s.opsi.find((o) => o.id === pilihan.opsiId) : undefined;
  const statusTeks = !pilihan
    ? "Belum memilih. Pilih satu hasil, atau tekan Lewati."
    : pilihan.jenis === "di_luar_opsi"
      ? "Pilihanmu: hasil tidak ada di pilihan · masih bisa diganti"
      : `Pilihanmu: ${opsiTerpilih?.nilai} · masih bisa diganti`;

  return (
    <div className="gaya-baru box-border min-h-screen bg-white px-4 pt-4 pb-6">
      {/* Bar atas: logo, progres, identitas siswa (teks sederhana) */}
      <header className="mx-auto mb-4 flex max-w-2xl flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <Logo tinggi={34} />
        <div className="order-3 w-full sm:order-none sm:w-auto sm:max-w-xs sm:flex-1">
          <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-500">
            <span>
              Soal {urutan} dari {total}
            </span>
            <span>{persen}% terjawab</span>
          </div>
          <div
            role="progressbar"
            aria-label="Soal terjawab"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={dijawab}
            aria-valuetext={`${dijawab} dari ${total} soal terjawab`}
            className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
          >
            <div className="h-full rounded-full bg-royal-blue transition-[width]" style={{ width: `${persen}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">

          <span className="text-xs font-bold text-navy">
            {attempt.nama} · <span className="angka">{kode}</span>
          </span>
        </div>
      </header>

      {/* Kartu soal */}
      <main className="mx-auto flex max-w-2xl flex-col items-center rounded-3xl border-2 border-slate-200 bg-white p-6 text-center shadow-soft sm:p-8 max-[600px]:border-0 max-[600px]:p-2 max-[600px]:shadow-none">
        <span className="mb-2 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black tracking-wider text-royal-blue uppercase">
          Soal {urutan}
        </span>
        <h1 ref={judulRef} tabIndex={-1} className="m-0 mb-1 text-xl font-extrabold text-navy focus:outline-none">
          Hitung {namaOperasi(sesi.operasi).toLowerCase()} berikut
        </h1>
        <p className="m-0 mb-6 text-xs text-slate-500">{namaKategori(sesi.numberCategory)} · Kerjakan sesuai cara yang kamu pahami.</p>

        <div className="mx-auto mb-8 flex w-full max-w-xs justify-center rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
          <SoalBersusun atas={s.operandAtas} bawah={s.operandBawah} tanda={s.tanda} gaya="baru" />
        </div>

        <div className="mb-4 w-full text-left">
          <span id="label-opsi" className="mb-2 block text-xs font-bold text-navy">
            Pilih hasilmu
          </span>
          <div role="radiogroup" aria-labelledby="label-opsi" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {s.opsi.map((o) => {
              const aktif = pilihan?.jenis === "opsi" && pilihan.opsiId === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={aktif}
                  onClick={() => pilihOpsi(o.id)}
                  onKeyDown={onKeyPilihan}
                  className={`flex min-h-20 flex-col items-center justify-center rounded-2xl p-3 text-center transition-all ${
                    aktif
                      ? "scale-[1.02] border-[3px] border-royal-blue bg-blue-50 shadow-[0_4px_16px_rgba(37,99,235,0.15)]"
                      : "border-2 border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(34,199,201,0.15)]"
                  }`}
                >
                  <span className="angka text-2xl font-bold text-navy">{o.nilai}</span>
                  {aktif && (
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-royal-blue">
                      <Icon nama="centang" ukuran={12} tebal={3} />
                      Dipilih
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          aria-pressed={pilihan?.jenis === "di_luar_opsi"}
          onClick={pilihLuar}
          onKeyDown={onKeyPilihan}
          className={`mb-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-dashed text-sm font-bold transition-all ${
            pilihan?.jenis === "di_luar_opsi"
              ? "border-[3px] border-royal-blue bg-blue-50 text-royal-blue"
              : "border-2 border-slate-300 bg-white text-slate-600 hover:border-slate-400"
          }`}
        >
          {pilihan?.jenis === "di_luar_opsi" && <Icon nama="centang" ukuran={14} tebal={3} />}
          Hasil saya tidak ada di pilihan
          {pilihan?.jenis === "di_luar_opsi" && <span className="text-xs">· Dipilih</span>}
        </button>

        <p
          aria-live="polite"
          className={`m-0 mb-6 flex items-center justify-center gap-1 text-xs font-semibold ${
            pilihan ? "text-emerald-700" : "text-slate-500"
          }`}
        >
          {pilihan && <Icon nama="centang" ukuran={12} tebal={3} />}
          {statusTeks}
        </p>

        {galat && <ErrorBanner>{galat} Pilihanmu tetap ada; tekan Lanjut atau Lewati untuk mencoba lagi.</ErrorBanner>}
        <div className="flex w-full items-center justify-end gap-2 border-t border-slate-100 pt-6 max-[600px]:sticky max-[600px]:bottom-0 max-[600px]:bg-white max-[600px]:pb-[env(safe-area-inset-bottom,0px)]">
          <Tombol varian="garis" tinggi={48} onClick={lewati} disabled={pindah} className="max-[600px]:flex-1">
            Lewati
          </Tombol>
          <Tombol
            varian="biru"
            tinggi={48}
            onClick={lanjut}
            disabled={!pilihan || pindah}
            aria-busy={pindah}
            className="max-[600px]:flex-1"
          >
            {urutan < total ? "Lanjut" : "Selesai"}
            <Icon nama="panah-kanan" ukuran={16} tebal={2.5} />
          </Tombol>
        </div>
      </main>

      <p className="mt-4 text-center text-[11px] text-slate-500 max-[600px]:hidden">
        Di laptop: tekan <kbd className="rounded bg-slate-100 px-1 py-0.5 font-sans">Tab</kbd> untuk berpindah pilihan,{" "}
        <kbd className="rounded bg-slate-100 px-1 py-0.5 font-sans">Spasi</kbd> untuk memilih,{" "}
        <kbd className="rounded bg-slate-100 px-1 py-0.5 font-sans">Enter</kbd> untuk lanjut.
      </p>
    </div>
  );
}
