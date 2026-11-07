"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

const BAGIAN: { judul: string; isi: ReactNode }[] = [
  {
    judul: "Membuat Sesi",
    isi: (
      <>
        Buka <strong>Buat Sesi Baru</strong>, pilih Penjumlahan atau Pengurangan, periksa ringkasan, lalu tekan{" "}
        <strong>Buat Sesi Kuis</strong>. Kirana menyiapkan satu paket 15 soal untuk sesi itu.
      </>
    ),
  },
  {
    judul: "Membagikan Kuis",
    isi: (
      <>
        Di halaman detail sesi, tampilkan QR di proyektor dengan <strong>Layar penuh</strong>, kirim tautan lewat grup
        kelas, atau tulis kode di papan. Siswa cukup mengisi nama panggilan, tanpa akun.
      </>
    ),
  },
  {
    judul: "Memantau Sesi",
    isi: (
      <>
        Jumlah pengumpulan tampil di detail sesi. Tekan <strong>Muat ulang</strong> untuk data terbaru. Setelah semua
        selesai, tekan <strong>Tutup Sesi</strong> agar tidak ada peserta baru. Hasil tetap bisa dilihat.
      </>
    ),
  },
  {
    judul: "Membaca Hasil",
    isi: (
      <>
        Setiap siswa punya empat jumlah yang totalnya 15: <strong>benar</strong>, <strong>pilihan angka salah</strong>,{" "}
        <strong>hasil di luar opsi</strong> (siswa menghitung, tetapi hasilnya tidak ada di pilihan), dan{" "}
        <strong>dilewati</strong>.
      </>
    ),
  },
  {
    judul: "Memahami Diagnosis",
    isi: (
      <>
        <strong>Pola didukung</strong>: cukup jawaban yang cocok dengan satu prosedur keliru.{" "}
        <strong>Kemungkinan ambigu</strong>: jawaban cocok dengan lebih dari satu prosedur.{" "}
        <strong>Bukti belum cukup</strong>: soal yang relevan terlalu sedikit dijawab, jadi belum bisa disimpulkan apa
        pun. <strong>Belum ada pola</strong>: pengamatan cukup dan tidak ditemukan pola.
      </>
    ),
  },
  {
    judul: "Melakukan Pemeriksaan Lanjutan",
    isi: (
      <>
        Dugaan bukan vonis. Ajak siswa mengerjakan satu contoh soal sambil menjelaskan langkahnya, lalu bandingkan
        dengan saran pemeriksaan di halaman detail.
      </>
    ),
  },
];

/** D3 · Panduan penggunaan: enam accordion, layout dan styling lama. */
export function Panduan() {
  const [buka, setBuka] = useState(0);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[clamp(26px,3vw,32px)] font-extrabold tracking-[-0.02em]">Panduan Penggunaan</h1>
        <p className="m-0 text-[15px] text-muted">Enam hal yang perlu diketahui untuk memakai Kirana di kelas.</p>
      </div>
      <ol className="m-0 flex max-w-[820px] list-none flex-col gap-3 p-0">
        {BAGIAN.map((b, i) => {
          const aktif = buka === i;
          return (
            <li key={b.judul} className="overflow-hidden rounded-card border border-border bg-surface">
              <h2 className="m-0">
                <button
                  type="button"
                  id={`kepala-${i}`}
                  aria-expanded={aktif}
                  aria-controls={`panel-${i}`}
                  onClick={() => setBuka(aktif ? -1 : i)}
                  className="flex min-h-[60px] w-full items-center justify-between gap-3 border-0 bg-transparent px-5 text-left text-[17px] font-extrabold text-ink"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-[30px] flex-none items-center justify-center rounded-[9px] bg-primary-soft text-sm text-primary-ink">
                      {i + 1}
                    </span>
                    {b.judul}
                  </span>
                  <span className={`flex-none transition-transform duration-150 ${aktif ? "rotate-180" : ""}`}>
                    <Icon nama="chevron-bawah" />
                  </span>
                </button>
              </h2>
              <div
                id={`panel-${i}`}
                role="region"
                aria-labelledby={`kepala-${i}`}
                hidden={!aktif}
                className="pr-5 pb-5 pl-[62px] text-[15px] leading-[1.6] text-ink-2 max-[600px]:pl-5"
              >
                {b.isi}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
