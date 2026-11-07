"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SoalBersusun } from "@/components/soal/SoalBersusun";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { Tombol, TombolLink } from "@/components/ui/Tombol";
import { namaOperasi, namaOperasiBersusun } from "@/lib/format";
import { KiranaError, namaKategori, type NumberCategory, type Operasi, type Sesi } from "@/lib/types";
import { buatSesi } from "@/services/kirana";

type Fase = "diam" | "memuat" | "gagal" | "berhasil";

const PILIHAN: { op: Operasi; tanda: "+" | "−"; atas: number; bawah: number; isi: string; kelasIkon: string }[] = [
  {
    op: "penjumlahan",
    tanda: "+",
    atas: 47,
    bawah: 36,
    isi: "Mengamati prosedur penjumlahan bersusun, termasuk menyimpan bila relevan.",
    kelasIkon: "bg-amber-50 text-amber-700",
  },
  {
    op: "pengurangan",
    tanda: "−",
    atas: 71,
    bawah: 38,
    isi: "Mengamati prosedur pengurangan bersusun, termasuk meminjam bila relevan.",
    kelasIkon: "bg-turquoise-light text-turquoise-ink",
  },
];

function Langkah({ no, label, selesai, aktif }: { no: number; label: string; selesai: boolean; aktif: boolean }) {
  return (
    <li className={`flex items-center gap-2.5 text-sm font-bold ${aktif || selesai ? "text-navy" : "text-slate-500"}`}>
      {selesai ? (
        <span className="flex size-7 items-center justify-center rounded-full bg-turquoise text-navy">
          <Icon nama="centang" ukuran={14} tebal={3} />
          <span className="sr-only">Selesai:</span>
        </span>
      ) : (
        <span
          className={`box-border flex size-7 items-center justify-center rounded-full border-2 ${
            aktif ? "border-turquoise text-turquoise-ink" : "border-slate-300 text-slate-600"
          }`}
        >
          {no}
        </span>
      )}
      {label}
    </li>
  );
}

/** B3 · Buat sesi: layout lama (pilih → info → konfirmasi), styling baru. */
export function BuatSesi() {
  const router = useRouter();
  const [category, setCategory] = useState<NumberCategory | null>(null);
  const [op, setOp] = useState<Operasi | null>(null);
  const [fase, setFase] = useState<Fase>("diam");
  const [pesan, setPesan] = useState("");
  const [dibuat, setDibuat] = useState<Sesi | null>(null);
  const sedangMembuat = useRef(false);

  const sibuk = fase === "memuat" || fase === "berhasil";

  function pilih(o: Operasi) {
    if (sibuk) return;
    setOp(o);
    if (fase === "gagal") setFase("diam");
  }

  async function buat() {
    // Kunci ganda: state untuk tampilan, ref untuk klik ganda yang sangat cepat.
    if (!op || !category || sedangMembuat.current || sibuk) return;
    sedangMembuat.current = true;
    setFase("memuat");
    try {
      const sesi = await buatSesi(op, category);
      setDibuat(sesi);
      setFase("berhasil");
      router.push(`/guru/sesi/${sesi.id}?baru=1`);
    } catch (err) {
      setPesan(err instanceof KiranaError ? err.message : "Sesi belum berhasil dibuat. Silakan coba lagi.");
      setFase("gagal");
      sedangMembuat.current = false;
    }
  }

  return (
    <div className="gaya-baru flex flex-col gap-7">
      <Link
        href="/guru/sesi"
        className="flex min-h-8 items-center gap-1.5 self-start text-sm font-bold text-turquoise-ink no-underline hover:underline"
      >
        <Icon nama="panah-kiri" ukuran={16} tebal={2.5} />
        Kembali ke daftar sesi
      </Link>

      <div className="-mt-3 flex flex-col gap-1.5">
        <h1 className="m-0 text-[clamp(24px,3vw,30px)] font-extrabold text-navy">Buat Sesi Kuis Baru</h1>
        <p className="m-0 text-sm text-slate-500">QR, tautan, dan kode akan muncul setelah sesi berhasil dibuat.</p>
      </div>

      <ol aria-label="Langkah" className="m-0 flex list-none flex-wrap gap-x-7 gap-y-3 border-b border-slate-200 p-0 pb-4">
        <Langkah no={1} label="Pilih Operasi" selesai={!!op} aktif={!op} />
        <Langkah no={2} label="Informasi Paket" selesai={!!op} aktif={false} />
        <Langkah no={3} label="Konfirmasi" selesai={fase === "berhasil"} aktif={!!op && fase !== "berhasil"} />
      </ol>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-6">
          <section aria-labelledby="l1" className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-[clamp(20px,3vw,28px)] shadow-soft">
            <h2 id="l1" className="m-0 text-base font-extrabold text-navy">
              1 · Pilih operasi
            </h2>
            <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
              {PILIHAN.map((p) => {
                const aktif = op === p.op;
                return (
                  <button
                    key={p.op}
                    type="button"
                    aria-pressed={aktif}
                    onClick={() => pilih(p.op)}
                    disabled={sibuk && !aktif}
                    className={`relative box-border flex h-full w-full flex-col gap-2.5 rounded-3xl text-left text-navy transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                      aktif
                        ? "border-[3px] border-turquoise bg-turquoise-light/40 p-[18.5px] shadow-soft"
                        : "border-2 border-slate-200 bg-white p-5 hover:border-turquoise"
                    }`}
                  >
                    {aktif && (
                      <span className="absolute top-4 right-4 flex items-center gap-1.5 text-xs font-bold text-turquoise-ink">
                        <Icon nama="centang" ukuran={14} tebal={3} />
                        Dipilih
                      </span>
                    )}
                    <span
                      aria-hidden="true"
                      className={`flex size-10 items-center justify-center rounded-xl text-lg font-bold ${p.kelasIkon}`}
                    >
                      {p.tanda}
                    </span>
                    <span className="text-lg font-extrabold">{namaOperasiBersusun(p.op)}</span>
                    <span className="text-xs leading-relaxed text-slate-600">{p.isi}</span>
                    <span className="mt-1 flex justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <SoalBersusun atas={p.atas} bawah={p.bawah} tanda={p.tanda} ukuran="kecil" gaya="baru" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
            <legend className="px-2 font-bold text-navy">Kategori bilangan (wajib)</legend>
            <div className="flex flex-wrap gap-3">{(["tens", "hundreds", "thousands"] as NumberCategory[]).map(c => <label key={c} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4"><input type="radio" name="category" value={c} checked={category === c} disabled={sibuk} onChange={() => setCategory(c)} />{namaKategori(c)}</label>)}</div>
            <p className="mt-3 text-xs text-slate-500">Berdasarkan bilangan terbesar pada soal. Hasil boleh memiliki jumlah digit berbeda; seluruh 15 soal tetap dalam kategori ini.</p>
          </fieldset>

          <section aria-labelledby="l2" className="flex flex-col gap-3.5 rounded-3xl border border-slate-200 bg-white p-[clamp(20px,3vw,28px)] shadow-soft">
            <h2 id="l2" className="m-0 text-base font-extrabold text-navy">
              2 · Informasi paket
            </h2>
            {op ? (
              <ul className="m-0 flex flex-col gap-2 pl-5 text-sm leading-relaxed text-slate-700">
                <li>
                  <strong className="text-navy">{namaOperasiBersusun(op)}</strong> · 15 soal pilihan ganda, satu soal per
                  layar
                </li>
                <li>9 soal inti disiapkan saat sesi dibuat</li>
                <li>6 soal lanjutan dipilih berdasarkan respons setiap siswa</li>
                <li>Jawaban dikunci setelah siswa menekan Lanjut</li>
              </ul>
            ) : (
              <p className="m-0 text-sm text-slate-600">Pilih operasi terlebih dahulu untuk melihat informasi paket.</p>
            )}
          </section>
        </div>

        <aside
          aria-labelledby="l3"
          className="flex flex-[1_1_300px] flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-[clamp(20px,3vw,28px)] shadow-soft"
        >
          <h2 id="l3" className="m-0 text-base font-extrabold text-navy">
            3 · Konfirmasi
          </h2>
          <dl className="m-0">
            {[
              ["Operasi", op ? namaOperasi(op) : "Belum dipilih"],
              ["Kategori", category ? namaKategori(category) : "Belum dipilih"],
              ["Jumlah soal", "15"],
              ["Format", "Pilihan ganda"],
              ["Akses siswa", "Tamu, tanpa akun"],
            ].map(([dt, dd]) => (
              <div key={dt} className="flex justify-between gap-4 border-b border-slate-100 py-2.5">
                <dt className="text-sm text-slate-500">{dt}</dt>
                <dd className="m-0 text-right text-sm font-bold text-navy">{dd}</dd>
              </div>
            ))}
          </dl>

          {fase === "gagal" && <ErrorBanner>{pesan}</ErrorBanner>}

          {fase === "berhasil" && dibuat ? (
            <div role="status" className="flex flex-col gap-2.5">
              <span className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                <Icon nama="centang" ukuran={18} tebal={3} />
                <span>
                  Sesi <span className="angka">{dibuat.kode}</span> berhasil dibuat. Mengalihkan…
                </span>
              </span>
              <TombolLink href={`/guru/sesi/${dibuat.id}?baru=1`} varian="coral" penuh tinggi={52}>
                Buka detail sesi
              </TombolLink>
            </div>
          ) : (
            <Tombol
              varian="coral"
              penuh
              tinggi={52}
              onClick={buat}
              disabled={!op || !category}
              aria-busy={fase === "memuat"}
              aria-disabled={fase === "memuat"}
            >
              {fase === "memuat" ? "Membuat sesi…" : fase === "gagal" ? "Coba buat lagi" : "Buat Sesi Kuis"}
              {fase !== "memuat" && <Icon nama="panah-kanan" ukuran={16} tebal={2.5} />}
            </Tombol>
          )}
          {!op && <span className="text-xs text-slate-500">Tombol aktif setelah operasi dipilih.</span>}
        </aside>
      </div>
    </div>
  );
}
