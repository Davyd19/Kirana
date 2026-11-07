"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

const BAGIAN: { judul: string; isi: ReactNode }[] = [
  {
    judul: "Membuat Sesi",
    isi: (
      <>
        Buka <strong>Buat Sesi Baru</strong>, pilih Penjumlahan atau Pengurangan dan kategori Puluhan, Ratusan, atau Ribuan, periksa ringkasan, lalu tekan{" "}
        <strong>Buat Sesi Kuis</strong>. Kirana menyiapkan 9 soal inti yang sama dan 6 soal lanjutan adaptif untuk setiap siswa. Kategori berdasarkan operand terbesar, bukan hasil; seluruh soal tetap dalam kategori pilihan guru.
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
        Jumlah pengumpulan tampil di detail sesi. Data diperbarui otomatis setiap 5 detik; tersedia juga tombol <strong>Muat ulang</strong>. Setelah semua
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
        <strong>Pola didukung</strong>: minimal dua kecocokan, satu pembeda, dan skor melewati ambang model.{" "}
        <strong>Dugaan awal</strong>: ada minimal dua kecocokan, tetapi syarat model atau pembeda belum lengkap.{" "}
        <strong>Belum dapat dibedakan</strong>: jawaban bersama mendukung beberapa kandidat tanpa bukti pembeda; bukan kepastian semua pola dialami siswa.{" "}
        <strong>Tidak terukur</strong>: kategori soal tidak menyediakan kesempatan mengamati pola itu.{" "}
        <strong>Bukti belum cukup</strong>: bukti sesi masih terbatas. <strong>Tidak ada pola terdeteksi</strong> tidak berarti semua materi pasti dikuasai.
        Jika model kategori belum tersedia, hanya bukti aturan yang ditampilkan. Model dievaluasi pada data sintetis, belum pada siswa nyata.
      </>
    ),
  },
  {
    judul: "Melakukan Pemeriksaan Lanjutan",
    isi: (
      <>
        Dugaan bukan vonis. Ajak siswa mengerjakan satu contoh soal sambil menjelaskan langkahnya, lalu bandingkan
        dengan saran pemeriksaan di halaman detail. Grafik batang menunjukkan skor model atau jumlah kecocokan sesuai labelnya. Grafik soal 1–15 menunjukkan perkembangan bukti kumulatif, bukan perubahan probabilitas diagnosis. Pilih titik atau nomor soal untuk melihat responsnya.
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
        <p className="m-0 text-[15px] text-slate-500">Enam hal yang perlu diketahui untuk memakai Kirana di kelas.</p>
      </div>
      <ol className="m-0 flex max-w-[820px] list-none flex-col gap-3 p-0">
        {BAGIAN.map((b, i) => {
          const aktif = buka === i;
          return (
            <li key={b.judul} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <h2 className="m-0">
                <button
                  type="button"
                  id={`kepala-${i}`}
                  aria-expanded={aktif}
                  aria-controls={`panel-${i}`}
                  onClick={() => setBuka(aktif ? -1 : i)}
                  className="flex min-h-[60px] w-full items-center justify-between gap-3 border-0 bg-transparent px-5 text-left text-[17px] font-extrabold text-navy"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-[30px] flex-none items-center justify-center rounded-[9px] bg-turquoise-light text-sm text-turquoise-ink">
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
                className="pr-5 pb-5 pl-[62px] text-[15px] leading-[1.6] text-slate-600 max-[600px]:pl-5"
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
