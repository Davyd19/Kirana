import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { TombolLink } from "@/components/ui/Tombol";
import { BATAS_KELAS, MIN_PENGUMPULAN, gambaranKelas, hitungRekap, type PolaRekap, type RekapKelas as Rekap } from "@/lib/rekapKelas";
import type { HasilSiswa, Sesi } from "@/lib/types";
import { namaKategori } from "@/lib/types";
import { namaOperasi } from "@/lib/format";

const kartu = "flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 max-[700px]:p-4";
const judulBagian = "m-0 text-[15px] font-extrabold text-navy";
const catatan = "m-0 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900";

/** Rekap kelas: hanya tersedia setelah sesi ditutup, agar keputusan guru diambil dari data lengkap. */
export function RekapKelas({ sesi, hasil }: { sesi: Sesi; hasil: HasilSiswa[] }) {
  if (sesi.status === "terbuka") {
    return (
      <section aria-labelledby="rekap-judul" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <div className="flex flex-col gap-1">
          <h2 id="rekap-judul" className="m-0 text-base font-extrabold text-navy">Rekap kelas tersedia setelah sesi ditutup</h2>
          <p className="m-0 text-sm text-slate-600">
            <strong className="angka">{hasil.length}</strong> siswa sudah mengumpulkan. Tutup sesi agar rekap dihitung dari data yang lengkap.
          </p>
        </div>
        <TombolLink href={`/guru/sesi/${sesi.id}`} varian="garis" tinggi={44} className="text-sm!">
          Buka Detail Sesi untuk menutup
        </TombolLink>
      </section>
    );
  }

  const r = hitungRekap(hasil);
  const g = gambaranKelas(r, sesi.numberCategory);

  return (
    <section aria-labelledby="rekap-judul" className={kartu}>
      <div className="flex flex-col gap-1">
        <h2 id="rekap-judul" className="m-0 text-lg font-extrabold text-navy">Gambaran kelas</h2>
        <p className="m-0 text-sm text-slate-600">
          {namaOperasi(sesi.operasi)} · {namaKategori(sesi.numberCategory)} · <strong className="angka">{r.jumlah}</strong> siswa · perkiraan dari skor model, bukan kepastian
        </p>
      </div>

      {r.dataSedikit && (
        <p role="status" className={catatan}>
          <Icon nama="peringatan" ukuran={16} />
          <span>Baru {r.jumlah} siswa mengumpulkan. Gambaran kelas kurang dapat diandalkan di bawah {MIN_PENGUMPULAN} siswa; gunakan sebagai gambaran awal.</span>
        </p>
      )}

      <p className="m-0 rounded-xl bg-turquoise-light px-4 py-3.5 text-[16px] font-semibold leading-relaxed text-navy">{g.kesimpulan}</p>

      <Sebaran r={r} />

      <div className="flex flex-col gap-2">
        <h3 className={judulBagian}>Langkah yang disarankan</h3>
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {g.langkah.map((teks, i) => (
            <li key={teks} className="flex gap-2.5 text-[15px] text-navy">
              <span className="angka flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{i + 1}</span>
              <span>{teks}</span>
            </li>
          ))}
        </ol>
      </div>

      <details className="group rounded-xl border border-slate-200">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 text-sm font-bold text-navy">
          <span aria-hidden="true" className="inline-flex transition-transform group-open:rotate-90">
            <Icon nama="panah-kanan" ukuran={14} tebal={2.5} />
          </span>
          Rincian per pola dan per siswa
        </summary>
        <div className="flex flex-col gap-5 border-t border-slate-200 p-4">
          <Rincian r={r} sesi={sesi} />
        </div>
      </details>
    </section>
  );
}

/** Bar sebaran: setiap siswa masuk tepat satu kelompok, jadi ketiga angka berjumlah total siswa. */
function Sebaran({ r }: { r: Rekap }) {
  const bagian = [
    { label: "Pola pasti terdeteksi", n: r.adaPasti, warna: "bg-coral-red" },
    { label: "Perlu dicek", n: r.siswaDicek.length, warna: "bg-sun-yellow" },
    { label: "Tanpa tanda kesalahan berulang", n: r.tanpaTanda.length, warna: "bg-meadow-green" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div role="img" aria-label={bagian.map((b) => `${b.label} ${b.n} siswa`).join(", ")} className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
        {bagian.map((b) => b.n > 0 && <div key={b.label} className={`${b.warna} h-full border-r-2 border-white last:border-r-0`} style={{ width: `${(100 * b.n) / r.jumlah}%` }} />)}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm text-slate-700">
        {bagian.map((b) => (
          <li key={b.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`size-3 rounded-sm ${b.warna}`} />
            {b.label} <strong className="angka">{b.n}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Rincian({ r, sesi }: { r: Rekap; sesi: Sesi }) {
  const urlSiswa = (h: HasilSiswa) => `/guru/hasil/${sesi.id}/siswa/${h.pesertaId}`;
  const kelompok = r.pola.filter((p) => p.pasti.length + p.perluDicek.length > 0);
  return (
    <>
      {!r.modelAktif && (
        <p role="status" className={catatan}>
          <Icon nama="peringatan" ukuran={16} />
          <span>Model diagnosis belum aktif untuk sebagian hasil, sehingga prioritas kelas tidak dapat diperkirakan. Kelompok di bawah hanya memakai status per siswa.</span>
        </p>
      )}

      {r.modelAktif && (
        <div className="flex flex-col gap-2.5">
          <h3 className={judulBagian}>Prioritas untuk diajarkan ulang ke kelas</h3>
          {r.prioritas.length > 0 ? (
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {r.prioritas.map((p, i) => (
                <li key={p.pola} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl bg-slate-50 px-4 py-3">
                  <span className="angka text-sm font-extrabold text-navy">{i + 1}.</span>
                  <strong className="text-[15px] text-navy">{p.pola} · {p.nama}</strong>
                  <span className="text-sm text-slate-600">— {ringkasPola(p)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="m-0 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Tidak ada pola yang diperkirakan dialami {Math.round(BATAS_KELAS * 100)}% siswa atau lebih.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <h3 className={judulBagian}>Kelompok kecil per pola</h3>
        {kelompok.length > 0 ? (
          <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 max-[900px]:grid-cols-1">
            {kelompok.map((p) => (
              <li key={p.pola} className="flex flex-col gap-1.5 rounded-xl border border-slate-200 px-4 py-3">
                <strong className="text-sm text-navy">{p.pola} · {p.nama}</strong>
                <span className="text-xs text-slate-500">{ringkasPola(p)}</span>
                <DaftarNama label="Pasti" siswa={p.pasti} url={urlSiswa} />
                <DaftarNama label="Perlu dicek" siswa={p.perluDicek} url={urlSiswa} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-slate-600">Belum ada siswa dengan tanda pola.</p>
        )}
      </div>

      {r.siswaDicek.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className={judulBagian}>Perlu dicek guru · peringatan dini ({r.siswaDicek.length} siswa)</h3>
          <p className="m-0 text-xs text-slate-500">Siswa ini belum punya pola pasti, tetapi ada tanda awal. Minta siswa mengerjakan ulang soal bukti sambil menjelaskan langkahnya.</p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {r.siswaDicek.map(({ siswa, pola }) => (
              <li key={siswa.pesertaId} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <Link href={urlSiswa(siswa)} className="font-bold text-royal-blue hover:underline">{siswa.nama}</Link>
                <span className="text-slate-600">
                  — kemungkinan {pola.map((p) => `${p.pola}${p.soal.length ? ` (soal ${p.soal.join(", ")})` : ""}`).join(" atau ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <h3 className={judulBagian}>Tidak ada tanda kesalahan berulang ({r.tanpaTanda.length} siswa)</h3>
        {r.tanpaTanda.length > 0 && <p className="m-0 text-sm text-slate-600">{r.tanpaTanda.map((h) => h.nama).join(", ")}</p>}
      </div>

      <p className="m-0 border-t border-slate-100 pt-3 text-xs text-slate-500">
        Prioritas kelas = pola dengan perkiraan ≥{Math.round(BATAS_KELAS * 100)}% siswa (maksimal 3), dihitung dari jumlah skor model ML seluruh siswa.
        Seorang siswa bisa masuk lebih dari satu kelompok. Rincian per siswa ada di tabel di bawah.
      </p>
    </>
  );
}

function ringkasPola(p: PolaRekap) {
  const rincian = `${p.pasti.length} pasti, ${p.perluDicek.length} perlu dicek`;
  return p.perkiraan === null ? rincian : `perkiraan ≈ ${Math.round(p.perkiraan)} siswa (${rincian})`;
}

function DaftarNama({ label, siswa, url }: { label: string; siswa: HasilSiswa[]; url: (h: HasilSiswa) => string }) {
  if (siswa.length === 0) return null;
  return (
    <p className="m-0 text-sm">
      <span className="font-semibold text-slate-600">{label}: </span>
      {siswa.map((h, i) => (
        <span key={h.pesertaId}>
          {i > 0 && ", "}
          <Link href={url(h)} className="text-royal-blue hover:underline">{h.nama}</Link>
        </span>
      ))}
    </p>
  );
}
