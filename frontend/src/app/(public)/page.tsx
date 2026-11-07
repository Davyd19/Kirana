import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { SoalBersusun } from "@/components/soal/SoalBersusun";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: { absolute: "Kirana — Asesmen diagnostik penjumlahan & pengurangan bersusun" },
};

const LANGKAH = [
  { judul: "Pilih Operasi", isi: "Guru memilih penjumlahan atau pengurangan bersusun lalu membuat sesi." },
  { judul: "Bagikan QR atau Kode", isi: "Siswa memindai QR, membuka tautan atau mengetik kode sesi." },
  {
    judul: "Siswa Mengerjakan 15 Soal",
    isi: "Tanpa akun, satu soal per layar, boleh melewati atau menandai hasil di luar opsi.",
  },
  { judul: "Periksa Dugaan Pola", isi: "Guru melihat dugaan pola kesalahan beserta jawaban yang mendukungnya." },
];

const KEUNGGULAN = [
  { judul: "Siswa tidak perlu akun", isi: "Cukup pindai QR dan isi nama panggilan." },
  { judul: "Satu paket soal per sesi", isi: "Semua siswa dengan kode yang sama mengerjakan 15 soal yang sama." },
  { judul: "Lebih dari jumlah benar", isi: "Pilihan salah, hasil di luar opsi, dan soal dilewati dicatat terpisah." },
  { judul: "Dugaan disertai bukti", isi: "Setiap dugaan pola menampilkan contoh soal dan jawaban siswa yang mendukungnya." },
  { judul: "Saran pemeriksaan lanjutan", isi: "Satu langkah konkret untuk mengecek dugaan bersama siswa." },
];

const kelasCta =
  "inline-flex min-h-[52px] items-center gap-2 rounded-2xl px-6 text-sm font-extrabold text-white no-underline shadow-md transition-colors";

export default function LandingPage() {
  return (
    <div id="beranda" className="gaya-baru min-h-screen bg-white">
      <PublicNavbar />

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 py-12 md:grid-cols-12 md:py-16">
          <div className="flex flex-col gap-6 md:col-span-7">
            <span className="self-start rounded-full border border-turquoise/30 bg-turquoise-light px-3.5 py-1.5 text-xs font-bold text-turquoise-ink">
              Inklusi Digital SD • FIRETECH 2026
            </span>
            <h1 className="m-0 text-3xl leading-tight font-black text-navy md:text-5xl">
              Bukan sekadar jawaban salah, pahami{" "}
              <span className="text-turquoise-ink underline decoration-sun-yellow decoration-wavy decoration-[3px] underline-offset-[6px]">
                cara berpikir
              </span>{" "}
              siswa.
            </h1>
            <p className="m-0 text-sm leading-relaxed font-medium text-slate-600 md:text-base">
              Kirana membantu guru mengamati dugaan pola kesalahan dalam penjumlahan dan pengurangan bersusun melalui
              kuis visual sederhana dan bukti jawaban siswa.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/login" className={`${kelasCta} bg-navy hover:bg-navy-hover`}>
                Mulai sebagai Guru
                <Icon nama="panah-kanan" ukuran={16} tebal={2.5} />
              </Link>
              <Link href="/join" className={`${kelasCta} bg-coral-red hover:bg-coral-red-hover`}>
                Masuk Kuis Siswa
              </Link>
            </div>
          </div>

          {/* Pratinjau produk: soal bersusun dan contoh dugaan pola */}
          <div className="relative flex flex-col items-center rounded-3xl border border-slate-200/80 bg-slate-50 p-6 text-center shadow-soft md:col-span-5">
            <div className="animasi-melayang mb-2 flex h-28 items-center justify-center">
              <Logo tinggi={104} tanpaNama dekoratif prioritas />
            </div>
            <div className="mb-3 flex w-full justify-center rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-xs">
              <SoalBersusun atas={71} bawah={38} tanda="−" ukuran="sedang" gaya="baru" />
            </div>
            <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs font-medium text-amber-900">
              <div className="mb-0.5 flex items-center gap-1.5 font-bold text-amber-950">
                <Icon nama="segitiga" ukuran={14} tebal={2.5} />
                DUGAAN POLA CONTOH
              </div>
              “Lupa mengurangi angka setelah meminjam” (4 dari 5 kesempatan mendukung).
            </div>
          </div>
        </section>

        {/* Cara kerja */}
        <section
          id="cara-kerja"
          aria-labelledby="ck-judul"
          className="scroll-mt-20 border-y border-slate-100 bg-slate-50 px-6 py-16"
        >
          <div className="mx-auto max-w-6xl">
            <h2 id="ck-judul" className="m-0 mb-10 text-center text-2xl font-extrabold text-navy md:text-3xl">
              Cara Kerja Kirana
            </h2>
            <ol className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {LANGKAH.map((l, i) => (
                <li key={l.judul} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                  <span className="mb-3 flex size-8 items-center justify-center rounded-full bg-turquoise/20 font-extrabold text-turquoise-ink">
                    {i + 1}
                  </span>
                  <h3 className="m-0 mb-1 text-sm font-bold text-navy">{l.judul}</h3>
                  <p className="m-0 text-xs leading-relaxed text-slate-600">{l.isi}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Keunggulan */}
        <section aria-labelledby="kg-judul" className="px-6 py-16">
          <div className="mx-auto flex max-w-6xl flex-col gap-8">
            <h2 id="kg-judul" className="m-0 text-center text-2xl font-extrabold text-navy md:text-3xl">
              Yang membuat Kirana berguna di kelas
            </h2>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4 p-0">
              {KEUNGGULAN.map((k) => (
                <li key={k.judul} className="flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <span className="flex size-8 flex-none items-center justify-center rounded-full bg-meadow-green/20 text-emerald-800">
                    <Icon nama="centang" ukuran={16} tebal={3} />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="m-0 text-sm font-bold text-navy">{k.judul}</h3>
                    <p className="m-0 text-xs leading-relaxed text-slate-600">{k.isi}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Tentang */}
        <section id="tentang" aria-labelledby="tt-judul" className="scroll-mt-20 px-6 pb-16">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 rounded-3xl border border-slate-200 bg-slate-50 p-[clamp(24px,4vw,40px)] shadow-soft">
            <div className="flex flex-[1_1_480px] flex-col gap-2.5">
              <h2 id="tt-judul" className="m-0 text-2xl font-extrabold text-navy">
                Tentang Kirana
              </h2>
              <p className="m-0 text-sm leading-relaxed text-slate-600 md:text-base">
                Kirana tidak memberi vonis. Hasilnya adalah dugaan berdasarkan pola jawaban, sebagai titik awal
                percakapan guru dengan siswa tentang langkah pengerjaannya.
              </p>
            </div>
            <Link href="/login" className={`${kelasCta} bg-navy hover:bg-navy-hover`}>
              Mulai sebagai Guru
              <Icon nama="panah-kanan" ukuran={16} tebal={2.5} />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
