"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { KotakBukti } from "@/components/diagnosis/KotakBukti";
import { SoalBersusun } from "@/components/soal/SoalBersusun";
import { Icon, type NamaIcon } from "@/components/ui/Icon";
import { Tombol, TombolLink } from "@/components/ui/Tombol";
import { formatJam, namaOperasi } from "@/lib/format";
import type {
  ContohBukti,
  ContohKondisi,
  DetailDiagnosis as Detail,
  HasilDiagnosis,
  KelompokAmbigu,
  PolaDidukung,
  RincianJawaban,
} from "@/lib/types";
import { useMuat } from "@/lib/useMuat";
import { daftarContohKondisi, getDiagnosis } from "@/services/kirana";

async function muat(sesiId: string, pesertaId: string) {
  const [detail, contoh] = await Promise.all([getDiagnosis(sesiId, pesertaId), daftarContohKondisi()]);
  return { detail, contoh };
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

  return <IsiDetail detail={hasil.data.detail} contoh={hasil.data.contoh} pesertaId={pesertaId} />;
}

function IsiDetail({ detail, contoh, pesertaId }: { detail: Detail; contoh: ContohKondisi[]; pesertaId: string }) {
  const router = useRouter();
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
            {namaOperasi(sesi.operasi)} · <span className="angka">{sesi.kode}</span> · dikumpulkan{" "}
            {formatJam(pengumpulan.dikumpulkanPada)}
          </span>
        </div>
      </div>

      {contoh.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-luar bg-demo-soft px-4 py-3">
          <label htmlFor="contoh-kondisi" className="text-sm font-bold text-demo-ink">
            Data demo · tampilkan contoh kondisi
          </label>
          <select
            id="contoh-kondisi"
            value={contoh.some((c) => c.pesertaId === pesertaId) ? pesertaId : ""}
            onChange={(e) => {
              const c = contoh.find((x) => x.pesertaId === e.target.value);
              if (c) router.push(`/guru/hasil/${c.sesiId}/siswa/${c.pesertaId}`);
            }}
            className="box-border h-11 min-w-0 flex-[1_1_220px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-navy"
          >
            <option value="" disabled>
              Pilih kondisi…
            </option>
            {contoh.map((c) => (
              <option key={c.pesertaId} value={c.pesertaId}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <section aria-labelledby="ringkasan-judul" className="flex flex-col gap-3.5">
        <h2 id="ringkasan-judul" className="m-0 text-lg font-extrabold">
          Ringkasan sesi <span className="text-[15px] font-medium text-slate-600">· {sesi.jumlahSoal} soal</span>
        </h2>
        <dl className="m-0 grid grid-cols-4 gap-4 max-[700px]:grid-cols-2">
          <KartuRingkasan ikon="centang" label="Jawaban benar" nilai={r.benar} warna="border-emerald-200 bg-emerald-50" warnaIkon="text-emerald-700" />
          <KartuRingkasan ikon="tutup" label="Pilihan angka salah" nilai={r.salah} warna="border-rose-200 bg-rose-50" warnaIkon="text-rose-700" />
          <KartuRingkasan ikon="tanya" label="Hasil di luar opsi" nilai={r.diLuarOpsi} warna="border-amber-200 bg-amber-50" warnaIkon="text-amber-700" />
          <KartuRingkasan ikon="panah-kanan" label="Dilewati" nilai={r.dilewati} warna="border-slate-200 bg-slate-100" warnaIkon="text-slate-600" />
        </dl>
      </section>

      <section aria-labelledby="pola-judul" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
          <h2 id="pola-judul" className="m-0 text-lg font-extrabold">
            Dugaan pola kesalahan
          </h2>
          <span className="text-[13px] text-slate-600">Perlu pemeriksaan lanjutan · urutan dari layanan diagnosis</span>
        </div>
        <IsiDugaan hasil={hasil} />
      </section>

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

function KartuRingkasan({
  ikon,
  label,
  nilai,
  warna,
  warnaIkon,
}: {
  ikon: NamaIcon;
  label: string;
  nilai: number;
  warna: string;
  warnaIkon: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 rounded-[14px] border px-5 py-[18px] ${warna}`}>
      <dt className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <span className={warnaIkon}>
          <Icon nama={ikon} ukuran={16} tebal={2.75} />
        </span>
        {label}
      </dt>
      <dd className="angka m-0 text-[34px] font-semibold">{nilai}</dd>
    </div>
  );
}

function IsiDugaan({ hasil }: { hasil: HasilDiagnosis }) {
  switch (hasil.status) {
    case "pola_didukung":
      return (
        <>
          {hasil.pola.map((p, i) => (
            <KartuPola key={p.id} no={i + 1} pola={p} />
          ))}
        </>
      );
    case "ambigu":
      return (
        <>
          {hasil.ambigu.map((k, i) => (
            <KartuAmbigu key={i} kelompok={k} />
          ))}
        </>
      );
    case "belum_cukup":
      return (
        <article className="flex flex-col gap-3.5 rounded-2xl border-[1.5px] border-dashed border-slate-400 bg-white px-7 py-6 max-[700px]:px-5">
          <span className="text-[13px] font-bold tracking-[0.04em] text-slate-700 uppercase">Bukti belum cukup</span>
          <h3 className="m-0 text-[22px] font-extrabold">Belum bisa menyimpulkan pola</h3>
          <p className="m-0 text-base leading-[1.55] text-slate-700">{hasil.alasanBelumCukup}</p>
          {hasil.saranBelumCukup && <KotakSaran judul="Saran pemeriksaan">{hasil.saranBelumCukup}</KotakSaran>}
        </article>
      );
    case "tanpa_pola":
      return (
        <article className="flex items-start gap-[18px] rounded-2xl border border-slate-200 bg-white px-7 py-6 max-[700px]:px-5">
          <span className="flex size-11 flex-none items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <Icon nama="centang" ukuran={22} tebal={2.75} />
          </span>
          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-[22px] font-extrabold">Belum ada pola yang terdeteksi pada sesi ini</h3>
            <p className="m-0 text-base leading-[1.55] text-slate-700">{hasil.keteranganTanpaPola}</p>
          </div>
        </article>
      );
  }
}

function KotakSaran({ judul, children, warna = "amber" }: { judul: string; children: ReactNode; warna?: "amber" | "turquoise" }) {
  const kelas =
    warna === "amber"
      ? { kotak: "border-amber-200 bg-amber-50", judul: "text-amber-800", ikon: "text-amber-700", isi: "text-amber-950" }
      : { kotak: "border-turquoise/30 bg-turquoise-light", judul: "text-turquoise-ink", ikon: "text-turquoise-ink", isi: "text-navy" };
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-[18px] py-4 ${kelas.kotak}`}>
      <span className={`mt-0.5 flex-none ${kelas.ikon}`}>
        <Icon nama="lampu" />
      </span>
      <div className="flex flex-col gap-1">
        <span className={`text-[13px] font-bold tracking-[0.04em] uppercase ${kelas.judul}`}>{judul}</span>
        <span className={`text-base leading-normal ${kelas.isi}`}>{children}</span>
      </div>
    </div>
  );
}

function KartuPola({ no, pola }: { no: number; pola: PolaDidukung }) {
  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white px-7 py-6 shadow-soft max-[700px]:px-5">
      <div className="flex items-start justify-between gap-6 max-[700px]:flex-col max-[700px]:gap-4">
        <div className="flex items-start gap-4">
          <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-turquoise-light text-[17px] font-extrabold text-turquoise-ink">
            {no}
          </span>
          <div className="flex flex-col gap-1">
            <span className="self-start rounded-full bg-amber-100 px-2.5 py-0.5 text-[12px] font-extrabold tracking-[0.04em] text-amber-900 uppercase">
              Pola didukung
            </span>
            <h3 className="m-0 text-[22px] font-extrabold tracking-[-0.01em]">{pola.nama}</h3>
          </div>
        </div>
        <div className="flex flex-none flex-col items-start gap-2">
          <span className="text-[15px]">
            <strong className="angka text-xl">{pola.jumlahPendukung}</strong> dari {pola.jumlahKesempatan} kesempatan
          </span>
          <KotakBukti pendukung={pola.jumlahPendukung} kesempatan={pola.jumlahKesempatan} ukuran={18} gaya="baru" />
        </div>
      </div>

      <TabelContoh contoh={pola.contoh} />

      <KotakSaran judul="Saran pemeriksaan">{pola.saran}</KotakSaran>
    </article>
  );
}

function TabelContoh({ contoh }: { contoh: ContohBukti[] }) {
  const th = "border-b border-slate-200 px-3 py-2 font-bold";
  const td = "border-b border-slate-100 px-3 py-2.5";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[15px]">
        <caption className="pb-2 text-left text-sm font-bold text-slate-700">Contoh jawaban pendukung</caption>
        <thead>
          <tr className="text-left text-[13px] text-slate-600">
            <th scope="col" className={th}>Soal</th>
            <th scope="col" className={th}>Bersusun</th>
            <th scope="col" className={th}>Pilihan siswa</th>
            <th scope="col" className={th}>Jawaban benar</th>
          </tr>
        </thead>
        <tbody>
          {contoh.map((e) => (
            <tr key={e.soalId}>
              <td className={`${td} text-slate-600`}>Soal {e.urutan}</td>
              <td className={td}>
                <SoalBersusun atas={e.operandAtas} bawah={e.operandBawah} tanda={e.tanda} hasil={null} ukuran="mini" gaya="baru" />
              </td>
              <td className={td}>
                <span className="angka rounded-lg bg-blue-50 px-2.5 py-1 text-lg font-semibold text-royal-blue">{e.pilihanSiswa}</span>
              </td>
              <td className={`${td} angka text-lg font-semibold`}>{e.jawabanBenar}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KartuAmbigu({ kelompok }: { kelompok: KelompokAmbigu }) {
  const huruf = ["A", "B", "C", "D"];
  return (
    <article className="flex flex-col gap-5 rounded-2xl border-[1.5px] border-dashed border-amber-500 bg-white px-7 py-6 max-[700px]:px-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold tracking-[0.04em] text-amber-800 uppercase">Kemungkinan ambigu</span>
        <h3 className="m-0 text-[22px] font-extrabold">{kelompok.judul}</h3>
        <p className="m-0 text-[15px] leading-normal text-slate-600">{kelompok.keterangan}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
        {kelompok.pola.map((p, i) => (
          <div key={p.id} className="flex flex-col gap-1 rounded-xl border border-slate-200 px-[18px] py-4">
            <span className="text-[13px] font-bold text-slate-600">Kemungkinan {huruf[i]}</span>
            <span className="text-[17px] font-extrabold">{p.nama}</span>
          </div>
        ))}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0 text-[15px]">
        {kelompok.contoh.map((e) => (
          <li key={e.soalId} className="rounded-[10px] bg-slate-100 px-3 py-2">
            <span className="angka font-semibold">
              {e.operandAtas} {e.tanda} {e.operandBawah}
            </span>{" "}
            → pilih <strong className="angka">{e.pilihanSiswa}</strong> (benar {e.jawabanBenar})
          </li>
        ))}
      </ul>
      <KotakSaran judul="Soal pembeda">{kelompok.saranPembeda}</KotakSaran>
    </article>
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
