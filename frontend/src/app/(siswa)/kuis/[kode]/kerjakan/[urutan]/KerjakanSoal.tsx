"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SoalBersusun } from "@/components/soal/SoalBersusun";
import { DataDemoBadge } from "@/components/ui/DataDemoBadge";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Tombol } from "@/components/ui/Tombol";
import { namaOperasi } from "@/lib/format";
import type { Attempt, Respons, SesiSiswa, Soal } from "@/lib/types";
import { simpanRespons, simpanUrutan } from "@/services/kirana";
import { LayarDitutup, LayarJaringan, LayarMemuat, LayarTidakValid } from "../../LayarStatus";
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
        : !urutanValid
          ? `/kuis/${kode}/kerjakan/1`
          : null;
  useEffect(() => {
    if (tujuan) router.replace(tujuan);
  }, [tujuan, router]);

  if (keadaan.fase === "memuat") return <LayarMemuat />;
  if (keadaan.fase === "tidak_valid") return <LayarTidakValid />;
  if (keadaan.fase === "jaringan") return <LayarJaringan pesan={keadaan.pesan} onCobaLagi={muatUlang} />;
  if (keadaan.sesi.status !== "terbuka") return <LayarDitutup kode={keadaan.sesi.kode} />;
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
  const total = soal.length;
  const [pilihan, setPilihan] = useState<Pilihan>(() => pilihanAwal(attempt.respons.find((r) => r.soalId === s.id)));
  const [pindah, setPindah] = useState(false);
  const judulRef = useRef<HTMLHeadingElement>(null);

  // Catat posisi terakhir agar siswa bisa melanjutkan setelah memuat ulang.
  const kode = sesi.kode;
  useEffect(() => {
    simpanUrutan(kode, urutan).then(onTersimpan);
    judulRef.current?.focus();
  }, [kode, urutan, onTersimpan]);

  const dijawab = attempt.respons.filter((r) => soal.some((x) => x.id === r.soalId)).length;
  const persen = Math.round((dijawab / total) * 100);

  async function simpan(r: Respons) {
    onTersimpan(await simpanRespons(kode, r, urutan));
  }

  function pilihOpsi(opsiId: string) {
    setPilihan({ jenis: "opsi", opsiId });
    simpan({ jenis: "opsi", soalId: s.id, opsiId });
  }

  function pilihLuar() {
    setPilihan({ jenis: "di_luar_opsi" });
    simpan({ jenis: "di_luar_opsi", soalId: s.id });
  }

  function berikutnya() {
    setPindah(true);
    router.push(urutan < total ? `/kuis/${kode}/kerjakan/${urutan + 1}` : `/kuis/${kode}/konfirmasi`);
  }

  async function lewati() {
    if (pindah) return;
    setPilihan(null);
    await simpan({ jenis: "dilewati", soalId: s.id });
    berikutnya();
  }

  function lanjut() {
    if (!pilihan || pindah) return;
    berikutnya();
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
          <DataDemoBadge />
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
        <p className="m-0 mb-6 text-xs text-slate-500">Kerjakan sesuai cara yang kamu pahami.</p>

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

        <div className="flex w-full items-center justify-end gap-2 border-t border-slate-100 pt-6 max-[600px]:sticky max-[600px]:bottom-0 max-[600px]:bg-white max-[600px]:pb-[env(safe-area-inset-bottom,0px)]">
          <Tombol varian="garis" tinggi={48} onClick={lewati} aria-disabled={pindah} className="max-[600px]:flex-1">
            Lewati
          </Tombol>
          <Tombol
            varian="biru"
            tinggi={48}
            onClick={lanjut}
            disabled={!pilihan}
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
