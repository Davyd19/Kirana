"use client";
import { KartuStat } from "@/components/ui/KartuStat";

import Link from "next/link";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tombol, TombolLink } from "@/components/ui/Tombol";
import { formatTanggal, namaOperasi } from "@/lib/format";
import type { Sesi } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { useMuat } from "@/lib/useMuat";
import { daftarSesi } from "@/services/kirana";

const JUMLAH_TERBARU = 5;

function salam(): string {
  const jam = Number(
    new Intl.DateTimeFormat("id-ID", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date()),
  );
  if (jam < 11) return "Selamat pagi";
  if (jam < 15) return "Selamat siang";
  if (jam < 19) return "Selamat sore";
  return "Selamat malam";
}

/** B1 · Dashboard guru: layout lama, styling baru. */
export function Dashboard() {
  const auth = useAuth();
  const { hasil, muatUlang } = useMuat(daftarSesi, "dashboard");

  return (
    <div className="gaya-baru flex flex-col gap-7">
      <div className="flex items-end justify-between gap-5 max-[700px]:flex-col max-[700px]:items-stretch">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] font-extrabold text-navy">
            {salam()}, {auth?.guru.nama ?? "Guru"}
          </h1>
          <p className="m-0 text-sm text-slate-500">Ringkasan sesi kuis dan pengumpulan jawaban siswa.</p>
        </div>
        <TombolLink href="/guru/sesi/buat" varian="navy" tinggi={48}>
          <Icon nama="tambah" ukuran={18} tebal={2.5} />
          Buat Sesi Baru
        </TombolLink>
      </div>

      {hasil.status === "memuat" && <KerangkaMemuat />}
      {hasil.status === "gagal" && (
        <ErrorBanner
          aksi={
            <Tombol varian="garis" tinggi={44} onClick={muatUlang}>
              Coba lagi
            </Tombol>
          }
        >
          Ringkasan belum berhasil dimuat. {hasil.pesan}
        </ErrorBanner>
      )}
      {hasil.status === "siap" && (hasil.data.length === 0 ? <Kosong /> : <IsiDashboard sesi={hasil.data} />)}
    </div>
  );
}

function KerangkaMemuat() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Memuat ringkasan</span>
      <div className="grid grid-cols-4 gap-4 max-[700px]:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-56 rounded-2xl bg-slate-100" />
    </div>
  );
}

function Kosong() {
  return (
    <section className="flex flex-col items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-[clamp(28px,6vw,56px)] text-center shadow-xs">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-turquoise-light text-turquoise-ink">
        <Icon nama="sesi" ukuran={28} />
      </span>
      <h2 className="m-0 text-xl font-extrabold text-navy">Belum ada sesi kuis</h2>
      <p className="m-0 max-w-[440px] text-sm leading-relaxed text-slate-600">
        Belum ada sesi kuis. Buat sesi pertamamu untuk mulai mengamati hasil pengerjaan siswa.
      </p>
      <TombolLink href="/guru/sesi/buat" varian="navy" tinggi={48} className="mt-1.5">
        <Icon nama="tambah" ukuran={18} tebal={2.5} />
        Buat Sesi Baru
      </TombolLink>
    </section>
  );
}

function IsiDashboard({ sesi }: { sesi: Sesi[] }) {
  const terbuka = sesi.filter((s) => s.status === "terbuka").length;
  const totalKumpul = sesi.reduce((n, s) => n + s.jumlahPengumpulan, 0);
  const terbaru = sesi.slice(0, JUMLAH_TERBARU);

  return (
    <div className="flex flex-col gap-7">
      <dl className="m-0 grid grid-cols-4 gap-4 max-[700px]:grid-cols-2">
        <KartuStat label="Total Sesi" nilai={sesi.length} keterangan="Semua sesi yang pernah dibuat" aksen="border-t-turquoise" />
        <KartuStat label="Sesi Terbuka" nilai={terbuka} keterangan="Masih menerima siswa baru" aksen="border-t-meadow-green" />
        <KartuStat
          label="Total Pengumpulan"
          nilai={totalKumpul}
          keterangan="Jumlah submission, bukan siswa unik lintas sesi"
          aksen="border-t-sun-yellow"
        />
        <KartuStat label="Sesi Ditutup" nilai={sesi.length - terbuka} keterangan="Hasil tetap bisa dilihat" aksen="border-t-slate-300" />
      </dl>

      <section aria-labelledby="terbaru" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="terbaru" className="m-0 text-base font-bold text-navy">
            Sesi Terbaru
          </h2>
          <Link href="/guru/sesi" className="text-sm font-bold text-turquoise-ink hover:underline">
            Lihat semua sesi
          </Link>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-5 py-2 shadow-xs max-[700px]:hidden">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                <th scope="col" className="py-3 pr-3 font-semibold">Kode Sesi</th>
                <th scope="col" className="py-3 pr-3 font-semibold">Operasi</th>
                <th scope="col" className="py-3 pr-3 font-semibold">Dibuat</th>
                <th scope="col" className="py-3 pr-3 font-semibold">Status</th>
                <th scope="col" className="py-3 pr-3 text-right font-semibold">Soal</th>
                <th scope="col" className="py-3 pr-3 text-right font-semibold">Mengumpulkan</th>
                <th scope="col" className="py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {terbaru.map((s) => (
                <tr key={s.id}>
                  <th scope="row" className="angka py-3 pr-3 font-bold text-navy">{s.kode}</th>
                  <td className="py-3 pr-3">{namaOperasi(s.operasi)}</td>
                  <td className="py-3 pr-3 text-slate-500">{formatTanggal(s.dibuatPada)}</td>
                  <td className="py-3 pr-3"><StatusBadge status={s.status} gaya="baru" /></td>
                  <td className="angka py-3 pr-3 text-right">{s.jumlahSoal}</td>
                  <td className="py-3 pr-3 text-right"><span className="angka">{s.jumlahPengumpulan}</span> siswa</td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/guru/sesi/${s.id}`}
                      aria-label={`Lihat detail sesi ${s.kode}`}
                      className="inline-flex min-h-11 items-center font-bold text-royal-blue hover:underline"
                    >
                      Lihat Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="m-0 hidden list-none flex-col gap-3 p-0 max-[700px]:flex">
          {terbaru.map((s) => (
            <li key={s.id} className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="angka text-base font-bold text-navy">{s.kode}</span>
                <StatusBadge status={s.status} gaya="baru" />
              </div>
              <span className="text-sm text-slate-600">
                {namaOperasi(s.operasi)} · {s.jumlahSoal} soal · {formatTanggal(s.dibuatPada)} · {s.jumlahPengumpulan} siswa
                mengumpulkan
              </span>
              <TombolLink href={`/guru/sesi/${s.id}`} varian="garis" tinggi={44} className="text-sm">
                Lihat Detail
              </TombolLink>
            </li>
          ))}
        </ul>
      </section>

      <aside className="flex items-start gap-3.5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
        <span className="flex size-9 flex-none items-center justify-center rounded-xl bg-white text-amber-700">
          <Icon nama="info" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-sm font-bold text-amber-950">Hasil diagnosis adalah dugaan</h2>
          <p className="m-0 text-sm leading-relaxed text-amber-900">
            Kirana menyusun dugaan pola dari bukti respons siswa. Periksa kembali bersama siswa dengan memintanya
            menunjukkan langkah pengerjaan.{" "}
            <Link href="/guru/panduan" className="font-bold text-amber-950 underline">
              Baca panduan
            </Link>
          </p>
        </div>
      </aside>
    </div>
  );
}
