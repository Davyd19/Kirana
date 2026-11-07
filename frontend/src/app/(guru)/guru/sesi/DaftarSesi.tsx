"use client";
import { namaKategori } from "@/lib/types";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tombol, TombolLink } from "@/components/ui/Tombol";
import { formatTanggal, namaOperasi } from "@/lib/format";
import type { Operasi, Sesi, StatusSesi } from "@/lib/types";
import { useMuat } from "@/lib/useMuat";
import { daftarSesi } from "@/services/kirana";

const kelasKontrol =
  "box-border h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-navy focus:border-turquoise";

/** Cocokkan kode tanpa memedulikan huruf besar, spasi, atau tanda hubung. */
function cocokKode(kode: string, q: string): boolean {
  const bersih = (t: string) => t.toUpperCase().replace(/[\s-]/g, "");
  return !q.trim() || bersih(kode).includes(bersih(q));
}

/** B2 · Daftar sesi: header, pencarian, filter gaya baru; tabel gaya lama + kolom Aksi. */
export function DaftarSesi() {
  const { hasil, muatUlang } = useMuat(daftarSesi, "daftar-sesi");
  const [q, setQ] = useState("");
  const [op, setOp] = useState<"semua" | Operasi>("semua");
  const [st, setSt] = useState<"semua" | StatusSesi>("semua");

  const semua = hasil.status === "siap" ? hasil.data : [];
  const baris = semua.filter(
    (s) => cocokKode(s.kode, q) && (op === "semua" || s.operasi === op) && (st === "semua" || s.status === st),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="gaya-baru flex items-end justify-between gap-5 max-[700px]:flex-col max-[700px]:items-stretch">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] font-extrabold text-navy">Sesi Kuis</h1>
          <p className="m-0 text-sm text-slate-500">Semua sesi milikmu, terbaru di atas.</p>
        </div>
        <TombolLink href="/guru/sesi/buat" varian="navy" tinggi={48}>
          <Icon nama="tambah" ukuran={18} tebal={2.5} />
          Buat Sesi Baru
        </TombolLink>
      </div>

      <div role="search" className="gaya-baru flex flex-wrap items-end gap-3">
        <div className="flex flex-[2_1_260px] flex-col gap-1">
          <label htmlFor="cari" className="text-xs font-bold text-navy">
            Cari kode sesi
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-3.5 left-3.5 text-slate-500">
              <Icon nama="cari" ukuran={18} />
            </span>
            <input
              id="cari"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Contoh: KRN-ABC234"
              className={`${kelasKontrol} angka pl-11`}
            />
          </div>
        </div>
        <div className="flex flex-[1_1_160px] flex-col gap-1">
          <label htmlFor="f-op" className="text-xs font-bold text-navy">
            Operasi
          </label>
          <select id="f-op" value={op} onChange={(e) => setOp(e.target.value as typeof op)} className={kelasKontrol}>
            <option value="semua">Semua operasi</option>
            <option value="penjumlahan">Penjumlahan</option>
            <option value="pengurangan">Pengurangan</option>
          </select>
        </div>
        <div className="flex flex-[1_1_160px] flex-col gap-1">
          <label htmlFor="f-st" className="text-xs font-bold text-navy">
            Status
          </label>
          <select id="f-st" value={st} onChange={(e) => setSt(e.target.value as typeof st)} className={kelasKontrol}>
            <option value="semua">Semua status</option>
            <option value="terbuka">Terbuka</option>
            <option value="ditutup">Ditutup</option>
          </select>
        </div>
      </div>

      <p aria-live="polite" className="gaya-baru m-0 -mt-3 min-h-5 text-sm text-slate-600">
        {hasil.status === "siap" ? `Menampilkan ${baris.length} dari ${semua.length} sesi` : ""}
      </p>

      {hasil.status === "memuat" && (
        <div role="status" aria-busy="true" className="flex flex-col gap-2.5">
          <span className="sr-only">Memuat daftar sesi</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-input bg-[#E4E8EF]" />
          ))}
        </div>
      )}

      {hasil.status === "gagal" && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-surface p-6">
          <span className="flex items-center gap-2.5 text-[15px] font-semibold text-danger-ink">
            <Icon nama="peringatan" />
            Daftar sesi belum berhasil dimuat.
          </span>
          <Tombol varian="sekunder" onClick={muatUlang}>
            Coba lagi
          </Tombol>
        </div>
      )}

      {hasil.status === "siap" && baris.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-surface p-8 text-center">
          <strong className="text-[17px]">{semua.length === 0 ? "Belum ada sesi kuis" : "Tidak ada sesi yang cocok"}</strong>
          <span className="text-[15px] text-muted">
            {semua.length === 0
              ? "Buat sesi pertamamu untuk mulai mengamati hasil pengerjaan siswa."
              : "Ubah kata kunci atau filter untuk melihat sesi lain."}
          </span>
        </div>
      )}

      {hasil.status === "siap" && baris.length > 0 && <TabelSesi baris={baris} />}
    </div>
  );
}

const th = "border-b border-border px-4 py-3 text-left text-[13px] font-bold text-muted";
const td = "border-b border-divider px-4 py-3.5 text-[15px]";
const kelasAksi = "gaya-baru inline-flex min-h-11 items-center px-1.5 text-sm font-bold text-royal-blue hover:underline";

/** Tabel gaya lama (B2), dengan kolom Aksi gaya baru. */
function TabelSesi({ baris }: { baris: Sesi[] }) {
  return (
    <div>
      <div className="overflow-x-auto rounded-card border border-border bg-surface max-[700px]:hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th scope="col" className={th}>Kode Sesi</th>
              <th scope="col" className={th}>Operasi</th>
              <th scope="col" className={th}>Dibuat</th>
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={`${th} text-right!`}>Soal</th>
              <th scope="col" className={`${th} text-right!`}>Mengumpulkan</th>
              <th scope="col" className={`${th} text-right!`}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((s) => (
              <tr key={s.id}>
                <th scope="row" className={`${td} angka text-left font-semibold`}>{s.kode}</th>
                <td className={td}>{namaOperasi(s.operasi)} · {namaKategori(s.numberCategory)}</td>
                <td className={`${td} text-muted`}>{formatTanggal(s.dibuatPada)}</td>
                <td className={td}><StatusBadge status={s.status} /></td>
                <td className={`${td} angka text-right`}>{s.jumlahSoal}</td>
                <td className={`${td} angka text-right`}>{s.jumlahPengumpulan}</td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <Link href={`/guru/sesi/${s.id}`} aria-label={`Lihat detail sesi ${s.kode}`} className={kelasAksi}>
                    Lihat Detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="m-0 hidden list-none flex-col gap-3 p-0 max-[700px]:flex">
        {baris.map((s) => (
          <li key={s.id} className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="angka text-[17px] font-semibold">{s.kode}</span>
              <StatusBadge status={s.status} />
            </div>
            <span className="text-sm text-muted">
              {namaOperasi(s.operasi)} · {namaKategori(s.numberCategory)} · {s.jumlahSoal} soal · {formatTanggal(s.dibuatPada)} · {s.jumlahPengumpulan}{" "}
              pengumpulan
            </span>
            {/* Hasil dibuka dari halaman Detail Sesi (tombol "Lihat Hasil" di sana). */}
            <TombolLink href={`/guru/sesi/${s.id}`} aria-label={`Lihat detail sesi ${s.kode}`} varian="sekunder" tinggi={44} penuh className="text-sm!">
              Lihat Detail
            </TombolLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
