"use client";

import { useParams, useRouter } from "next/navigation";
import { LabelDiagnosis } from "@/components/diagnosis/LabelDiagnosis";
import { Tombol, TombolLink } from "@/components/ui/Tombol";
import { formatJam, formatTanggal, namaOperasi } from "@/lib/format";
import type { HasilSiswa, Sesi } from "@/lib/types";
import { useMuat } from "@/lib/useMuat";
import { daftarHasil, daftarSesi } from "@/services/kirana";

/** D1 · Hasil & diagnosis per sesi: layout dan styling lama sepenuhnya. */
export function HasilSesi() {
  const params = useParams<{ sessionId?: string }>();
  const router = useRouter();
  const { hasil: daftar, muatUlang } = useMuat(daftarSesi, "hasil-daftar-sesi");

  const semua = daftar.status === "siap" ? daftar.data : [];
  const terpilih = params.sessionId ? semua.find((s) => s.id === params.sessionId) : semua[0];

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[clamp(26px,3vw,32px)] font-extrabold tracking-[-0.02em]">Hasil &amp; Diagnosis</h1>
        <p className="m-0 text-[15px] text-muted">
          Pilih sesi, lalu buka detail siswa untuk melihat dugaan pola dan buktinya.
        </p>
      </div>

      {daftar.status === "memuat" && (
        <div role="status" aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">Memuat hasil</span>
          <div className="h-[86px] rounded-card bg-[#E4E8EF]" />
          <div className="h-64 rounded-card bg-[#E4E8EF]" />
        </div>
      )}

      {daftar.status === "gagal" && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-surface p-6">
          <span className="text-[15px] font-semibold text-danger-ink">Daftar sesi belum berhasil dimuat.</span>
          <Tombol varian="sekunder" onClick={muatUlang}>
            Coba lagi
          </Tombol>
        </div>
      )}

      {daftar.status === "siap" && semua.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-surface p-9 text-center">
          <strong className="text-[17px]">Belum ada sesi kuis.</strong>
          <span className="text-[15px] text-muted">Buat sesi pertamamu untuk mulai mengamati hasil pengerjaan siswa.</span>
          <TombolLink href="/guru/sesi/buat" className="mt-2">
            Buat Sesi Baru
          </TombolLink>
        </div>
      )}

      {daftar.status === "siap" && semua.length > 0 && !terpilih && (
        <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-surface p-9 text-center">
          <strong className="text-[17px]">Sesi tidak ditemukan.</strong>
          <TombolLink href="/guru/hasil" varian="sekunder" className="mt-2">
            Lihat sesi terbaru
          </TombolLink>
        </div>
      )}

      {terpilih && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4 rounded-card border border-border bg-surface px-5 py-[18px] max-[700px]:flex-col max-[700px]:items-stretch">
            <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5 max-[700px]:flex-none">
              <label htmlFor="pilih-sesi" className="text-[13px] font-bold text-ink-2">
                Sesi
              </label>
              <select
                id="pilih-sesi"
                value={terpilih.id}
                onChange={(e) => router.push(`/guru/hasil/${e.target.value}`)}
                className="box-border h-12 w-full min-w-0 rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-[15px] text-ink"
              >
                {semua.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.kode} · {namaOperasi(s.operasi)} · {formatTanggal(s.dibuatPada)} ·{" "}
                    {s.status === "terbuka" ? "Terbuka" : "Ditutup"}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm text-ink-2">
                <strong className="angka">{terpilih.jumlahPengumpulan}</strong> pengumpulan · {terpilih.jumlahSoal} soal
              </span>
              <TombolLink href={`/guru/sesi/${terpilih.id}`} varian="sekunder" tinggi={44} className="text-sm!">
                Detail sesi
              </TombolLink>
            </div>
          </div>

          <TabelHasil key={terpilih.id} sesi={terpilih} />
        </>
      )}
    </>
  );
}

const th = "border-b border-border px-3.5 py-3 text-left text-[13px] font-bold text-muted";
const td = "border-b border-divider p-3.5 text-[15px]";
const tdAngka = `${td} angka text-right font-semibold`;

function TabelHasil({ sesi }: { sesi: Sesi }) {
  const { hasil, muatUlang } = useMuat(() => daftarHasil(sesi.id), sesi.id);

  if (hasil.status === "memuat") {
    return (
      <div role="status" aria-busy="true" className="flex flex-col gap-2.5">
        <span className="sr-only">Memuat hasil siswa</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-input bg-[#E4E8EF]" />
        ))}
      </div>
    );
  }
  if (hasil.status === "gagal") {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-surface p-6">
        <span className="text-[15px] font-semibold text-danger-ink">Hasil siswa belum berhasil dimuat.</span>
        <Tombol varian="sekunder" onClick={muatUlang}>
          Coba lagi
        </Tombol>
      </div>
    );
  }

  // Urutan pengumpulan dari yang paling awal, seperti desain lama.
  const baris: HasilSiswa[] = [...hasil.data].sort((a, b) => a.dikumpulkanPada.localeCompare(b.dikumpulkanPada));

  if (baris.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-surface p-9 text-center">
        <strong className="text-[17px]">Belum ada siswa yang mengumpulkan jawaban.</strong>
        <span className="text-[15px] text-muted">Hasil akan muncul di sini setelah siswa mengumpulkan.</span>
      </div>
    );
  }

  const urlDetail = (p: HasilSiswa) => `/guru/hasil/${sesi.id}/siswa/${p.pesertaId}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-card border border-border bg-surface max-[700px]:hidden">
        <table className="w-full border-collapse">
          <caption className="sr-only">Hasil siswa sesi {sesi.kode}</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>Siswa</th>
              <th scope="col" className={`${th} text-right!`}>Benar</th>
              <th scope="col" className={`${th} text-right!`}>Pilihan salah</th>
              <th scope="col" className={`${th} text-right!`}>Di luar opsi</th>
              <th scope="col" className={`${th} text-right!`}>Dilewati</th>
              <th scope="col" className={th}>Hasil diagnosis</th>
              <th scope="col" className={th}>
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {baris.map((p) => (
              <tr key={p.pesertaId}>
                <th scope="row" className={`${td} text-left`}>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold">{p.nama}</span>
                    <span className="text-[13px] font-medium text-muted">Dikumpulkan {formatJam(p.dikumpulkanPada)}</span>
                  </div>
                </th>
                <td className={tdAngka}>{p.ringkasan.benar}</td>
                <td className={tdAngka}>{p.ringkasan.salah}</td>
                <td className={tdAngka}>{p.ringkasan.diLuarOpsi}</td>
                <td className={tdAngka}>{p.ringkasan.dilewati}</td>
                <td className={td}>
                  <LabelDiagnosis status={p.status} jumlahPola={p.jumlahPola} />
                </td>
                <td className={`${td} text-right`}>
                  <TombolLink
                    href={urlDetail(p)}
                    varian="sekunder"
                    aria-label={`Lihat detail ${p.nama}`}
                    className="h-10! px-3.5! text-sm!"
                  >
                    Lihat Detail
                  </TombolLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="m-0 hidden list-none flex-col gap-3 p-0 max-[700px]:flex">
        {baris.map((p) => (
          <li key={p.pesertaId} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
            <div className="flex items-baseline justify-between gap-2">
              <strong className="text-[17px]">{p.nama}</strong>
              <span className="text-[13px] text-muted">{formatJam(p.dikumpulkanPada)}</span>
            </div>
            <dl className="m-0 grid grid-cols-4 gap-1.5 text-center">
              {[
                ["Benar", p.ringkasan.benar],
                ["Salah", p.ringkasan.salah],
                ["Di luar", p.ringkasan.diLuarOpsi],
                ["Lewat", p.ringkasan.dilewati],
              ].map(([l, n]) => (
                <div key={l}>
                  <dt className="text-xs text-muted">{l}</dt>
                  <dd className="angka m-0 text-lg font-semibold">{n}</dd>
                </div>
              ))}
            </dl>
            <div>
              <LabelDiagnosis status={p.status} jumlahPola={p.jumlahPola} />
            </div>
            <TombolLink href={urlDetail(p)} varian="sekunder" tinggi={44} className="text-sm!">
              Lihat Detail
            </TombolLink>
          </li>
        ))}
      </ul>

      <p className="m-0 text-[13px] text-muted">
        Hasil diagnosis adalah dugaan berdasarkan pola jawaban. Pastikan dengan berbicara langsung bersama siswa.
      </p>
    </div>
  );
}
