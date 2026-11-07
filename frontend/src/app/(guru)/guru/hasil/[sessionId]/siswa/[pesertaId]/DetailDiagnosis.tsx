"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { KartuStat } from "@/components/ui/KartuStat";
import { GrafikBukti, PenilaianPola } from "@/components/diagnosis/GrafikBukti";
import { namaKategori } from "@/lib/types";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { Tombol, TombolLink } from "@/components/ui/Tombol";
import { formatJam, namaOperasi } from "@/lib/format";
import type {
  DetailDiagnosis as Detail,
  RincianJawaban,
} from "@/lib/types";
import { useMuat } from "@/lib/useMuat";
import { getDiagnosis } from "@/services/kirana";

async function muat(sesiId: string, pesertaId: string) {
  return { detail: await getDiagnosis(sesiId, pesertaId) };
}

/**
 * D2 · Detail diagnosis siswa: struktur lama, palet warna baru.
 * Semua kondisi (pola tunggal/beberapa, ambigu, bukti belum cukup, tanpa pola)
 * berasal dari service; komponen hanya menampilkan.
 */
export function DetailDiagnosis() {
  const { sessionId, pesertaId } = useParams<{ sessionId: string; pesertaId: string }>();
  const { hasil, muatUlang } = useMuat(() => muat(sessionId, pesertaId), `${sessionId}/${pesertaId}`);

  if (hasil.status === "memuat") {
    return (
      <div role="status" aria-busy="true" className="flex flex-col gap-6">
        <span className="sr-only">Memuat detail diagnosis</span>
        <div className="h-12 w-80 max-w-full rounded-xl bg-slate-100" />
        <div className="grid grid-cols-4 gap-4 max-[700px]:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-[14px] bg-slate-100" />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (hasil.status === "gagal") {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 text-navy">
        <strong className="text-[17px]">{hasil.pesan}</strong>
        <div className="flex flex-wrap gap-2.5">
          <Tombol varian="garis" onClick={muatUlang}>
            Coba lagi
          </Tombol>
          <TombolLink href={`/guru/hasil/${sessionId}`} varian="garis">
            Kembali ke hasil sesi
          </TombolLink>
        </div>
      </div>
    );
  }

  return <IsiDetail detail={hasil.data.detail} />;
}

function IsiDetail({ detail }: { detail: Detail }) {
  const { sesi, pengumpulan, hasil } = detail;
  const r = hasil.ringkasan;

  return (
    <div className="flex flex-col gap-7 text-navy">
      <div className="flex flex-col gap-2.5">
        <Link
          href={`/guru/hasil/${sesi.id}`}
          className="flex min-h-8 items-center gap-1.5 self-start text-sm font-bold text-royal-blue no-underline hover:underline"
        >
          <Icon nama="panah-kiri" ukuran={16} tebal={2.5} />
          <span>
            Kembali ke hasil sesi <span className="angka">{sesi.kode}</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
          <h1 className="m-0 text-[clamp(26px,3vw,32px)] font-extrabold tracking-[-0.02em]">{pengumpulan.nama}</h1>
          <span className="text-[15px] text-slate-600">
            {namaOperasi(sesi.operasi)} · {namaKategori(sesi.numberCategory)} · <span className="angka">{sesi.kode}</span> · dikumpulkan{" "}
            {formatJam(pengumpulan.dikumpulkanPada)}
          </span>
        </div>
      </div>

      <p className="text-sm text-slate-600">Model dievaluasi pada data sintetis; akurasi pada siswa nyata belum divalidasi.</p>
      <section aria-labelledby="ringkasan-judul" className="flex flex-col gap-3.5">
        <h2 id="ringkasan-judul" className="m-0 text-lg font-extrabold">
          Ringkasan sesi <span className="text-[15px] font-medium text-slate-600">· {sesi.jumlahSoal} soal</span>
        </h2>
        <dl className="m-0 grid grid-cols-4 gap-4 max-[700px]:grid-cols-2">
          <KartuStat label="Jawaban benar" nilai={r.benar} keterangan="Dari 15 soal" aksen="border-t-turquoise" />
          <KartuStat label="Pilihan angka salah" nilai={r.salah} keterangan="Dari 15 soal" aksen="border-t-turquoise" />
          <KartuStat label="Hasil di luar opsi" nilai={r.diLuarOpsi} keterangan="Dari 15 soal" aksen="border-t-turquoise" />
          <KartuStat label="Dilewati" nilai={r.dilewati} keterangan="Dari 15 soal" aksen="border-t-turquoise" />
        </dl>
      </section>

      <section aria-labelledby="pola-judul" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
          <h2 id="pola-judul" className="m-0 text-lg font-extrabold">
            Dugaan pola kesalahan
          </h2>
          <span className="text-[13px] text-slate-600">Perlu pemeriksaan lanjutan · urutan dari layanan diagnosis</span>
        </div>
        <PenilaianPola hasil={hasil} tanda={sesi.operasi === "penjumlahan" ? "+" : "−"} />
      </section>

      <GrafikBukti hasil={hasil} tanda={sesi.operasi === "penjumlahan" ? "+" : "−"} />

      <section aria-labelledby="rincian-judul" className="flex flex-col gap-3.5">
        <h2 id="rincian-judul" className="m-0 text-lg font-extrabold">
          Rincian {hasil.rincian.length} jawaban
        </h2>
        <ol className="m-0 grid list-none grid-cols-5 gap-3 p-0 max-[900px]:grid-cols-3 max-[700px]:grid-cols-2">
          {hasil.rincian.map((x) => (
            <KartuRincian key={x.urutan} r={x} />
          ))}
        </ol>
      </section>
    </div>
  );
}

function KartuRincian({ r }: { r: RincianJawaban }) {
  let isi: ReactNode;
  switch (r.jenis) {
    case "benar":
      isi = (
        <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
          <Icon nama="centang" ukuran={14} tebal={3} />
          <span>
            Pilih <span className="angka">{r.pilihanSiswa}</span> · benar
          </span>
        </span>
      );
      break;
    case "salah":
      isi = (
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-rose-700">
          <Icon nama="tutup" ukuran={14} tebal={3} />
          <span>
            Pilih <span className="angka">{r.pilihanSiswa}</span> · benar <span className="angka">{r.jawabanBenar}</span>
          </span>
        </span>
      );
      break;
    case "di_luar_opsi":
      isi = (
        <span className="flex items-center gap-1.5 text-sm font-bold text-amber-800">
          <Icon nama="tanya" ukuran={14} tebal={3} />
          Di luar opsi
        </span>
      );
      break;
    case "dilewati":
      isi = (
        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-600">
          <Icon nama="panah-kanan" ukuran={14} tebal={2.75} />
          Dilewati
        </span>
      );
      break;
  }
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <div className="flex justify-between gap-2 text-[13px] text-slate-600">
        <span>Soal {r.urutan}</span>
        <span className="angka font-semibold text-navy">
          {r.operandAtas} {r.tanda} {r.operandBawah}
        </span>
      </div>
      {isi}
    </li>
  );
}
