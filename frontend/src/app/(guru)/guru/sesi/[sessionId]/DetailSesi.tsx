"use client";
import { namaKategori } from "@/lib/types";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tombol, TombolLink } from "@/components/ui/Tombol";
import { formatJam, formatTanggalJam, namaOperasiBersusun } from "@/lib/format";
import type { Pengumpulan, Sesi } from "@/lib/types";
import { useMuat } from "@/lib/useMuat";
import { ambilSesi, daftarPengumpulan, tutupSesi } from "@/services/kirana";

async function muatDetail(id: string): Promise<{ sesi: Sesi; pengumpulan: Pengumpulan[]; diperbarui: string }> {
  const [sesi, pengumpulan] = await Promise.all([ambilSesi(id), daftarPengumpulan(id)]);
  return { sesi, pengumpulan, diperbarui: new Date().toISOString() };
}

/** B4 · Detail sesi: layout & styling lama, bagian pengumpulan gaya baru. */
export function DetailSesi() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { hasil, muatUlang, segarkan, menyegarkan } = useMuat(() => muatDetail(sessionId), sessionId);

  if (hasil.status === "memuat") {
    return (
      <div role="status" aria-busy="true" className="flex flex-col gap-6">
        <span className="sr-only">Memuat detail sesi</span>
        <div className="h-10 w-72 max-w-full rounded-xl bg-[#E4E8EF]" />
        <div className="flex flex-wrap gap-6">
          <div className="h-72 flex-[999_1_520px] rounded-2xl bg-[#E4E8EF]" />
          <div className="h-72 flex-[1_1_300px] rounded-2xl bg-[#E4E8EF]" />
        </div>
      </div>
    );
  }

  if (hasil.status === "gagal") {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6">
        <strong className="text-[17px]">{hasil.pesan}</strong>
        <div className="flex flex-wrap gap-2.5">
          <Tombol varian="garis" onClick={muatUlang}>
            Coba lagi
          </Tombol>
          <TombolLink href="/guru/sesi" varian="garis">
            Kembali ke daftar sesi
          </TombolLink>
        </div>
      </div>
    );
  }

  return (
    <IsiDetail
      data={hasil.data}
      onSegarkan={segarkan}
      menyegarkan={menyegarkan}
    />
  );
}

function IsiDetail({
  data,
  onSegarkan,
  menyegarkan,
}: {
  data: { sesi: Sesi; pengumpulan: Pengumpulan[]; diperbarui: string };
  onSegarkan: () => void;
  menyegarkan: boolean;
}) {
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState(searchParams.get("baru") === "1");
  const [sesi, setSesi] = useState(data.sesi);
  const [dialogTutup, setDialogTutup] = useState(false);
  const [menutup, setMenutup] = useState(false);
  const [galat, setGalat] = useState("");
  const [layarPenuh, setLayarPenuh] = useState(false);
  const [tersalin, setTersalin] = useState<"kode" | "tautan" | null>(null);
  const kanvasRef = useRef<HTMLCanvasElement>(null);

  // Status terbaru bisa datang dari tombol Tutup Sesi (state lokal) atau Muat ulang.
  const status = sesi.status === "ditutup" || data.sesi.status === "ditutup" ? "ditutup" : "terbuka";
  const terbuka = status === "terbuka";
  const tautan = data.sesi.joinUrl;

  async function salin(teks: string, jenis: "kode" | "tautan") {
    try {
      await navigator.clipboard.writeText(teks);
    } catch {
      // Cadangan untuk browser tanpa izin clipboard.
      const t = document.createElement("textarea");
      t.value = teks;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setTersalin(jenis);
    setTimeout(() => setTersalin((j) => (j === jenis ? null : j)), 2000);
  }

  function unduhQr() {
    const kanvas = kanvasRef.current;
    if (!kanvas) return;
    const a = document.createElement("a");
    a.href = kanvas.toDataURL("image/png");
    a.download = `QR-${sesi.kode}.png`;
    a.click();
  }

  async function konfirmasiTutup() {
    if (menutup) return;
    setMenutup(true);
    setGalat("");
    try {
      setSesi(await tutupSesi(sesi.id));
      setBanner(false);
      setDialogTutup(false);
    } catch (error) {
      setGalat(error instanceof Error ? error.message : "Sesi belum dapat ditutup. Coba lagi.");
    } finally {
      setMenutup(false);
    }
  }

  const kelasTombolKecil = "h-11! px-3! text-sm!";

  return (
    <>
      <Link
        href="/guru/sesi"
        className="flex min-h-8 items-center gap-1.5 self-start text-sm font-bold text-turquoise-ink no-underline hover:text-navy"
      >
        <Icon nama="panah-kiri" ukuran={16} tebal={2.5} />
        Kembali ke daftar sesi
      </Link>

      {banner && terbuka && (
        <div role="status" className="-mt-3 flex items-center justify-between gap-3 rounded-xl bg-success-soft px-4 py-3.5 text-[15px] font-semibold text-[#0F4A2A]">
          <span className="flex items-center gap-2.5">
            <Icon nama="centang" ukuran={20} tebal={2.5} />
            Sesi berhasil dibuat. Bagikan kode atau QR kepada siswa.
          </span>
          <button
            type="button"
            onClick={() => setBanner(false)}
            aria-label="Tutup pemberitahuan"
            className="flex size-11 flex-none items-center justify-center rounded-badge border-0 bg-transparent text-inherit"
          >
            <Icon nama="tutup" ukuran={18} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-5 max-[700px]:flex-col max-[700px]:items-stretch">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-[clamp(26px,3vw,32px)] font-extrabold tracking-[-0.02em]">
              Sesi <span className="angka">{sesi.kode}</span>
            </h1>
            <StatusBadge status={status} />
          </div>
          <p className="m-0 text-[15px] text-slate-500">
            {namaOperasiBersusun(sesi.operasi)} · {namaKategori(sesi.numberCategory)} · {sesi.jumlahSoal} soal · dibuat {formatTanggalJam(sesi.dibuatPada)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <TombolLink href={`/guru/hasil/${sesi.id}`} varian="navy">
            Lihat Hasil
          </TombolLink>
          {terbuka && (
            <Tombol varian="garis" onClick={() => setDialogTutup(true)}>
              <Icon nama="gembok" ukuran={18} tebal={2.2} />
              Tutup Sesi
            </Tombol>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-labelledby="bagikan"
          className="flex min-w-0 flex-[999_1_520px] flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-[clamp(20px,3vw,28px)]"
        >
          <h2 id="bagikan" className="m-0 text-lg font-extrabold">
            Bagikan ke siswa
          </h2>
          {terbuka ? (
            <>
              <div className="flex flex-wrap items-center gap-6">
                <figure className="mx-auto my-0 flex flex-none flex-col items-center gap-2">
                  <div className="rounded-opsi border-[1.5px] border-slate-300 bg-white p-3.5">
                    <QRCodeCanvas
                      ref={kanvasRef}
                      value={tautan}
                      size={176}
                      marginSize={0}
                      level="M"
                      role="img"
                      aria-label={`QR untuk membuka kuis ${sesi.kode}`}
                    />
                  </div>
                  <figcaption className="text-[13px] text-slate-500">Pindai dengan kamera HP</figcaption>
                </figure>
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-slate-500">Kode sesi</span>
                    <span className="angka text-[clamp(32px,4vw,42px)] font-semibold tracking-[0.08em]">{sesi.kode}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="tautan" className="text-sm font-semibold text-slate-500">
                      Tautan bergabung
                    </label>
                    <input
                      id="tautan"
                      readOnly
                      value={tautan}
                      onFocus={(e) => e.currentTarget.select()}
                      className="angka box-border h-12 w-full min-w-0 rounded-[10px] border-[1.5px] border-slate-300 bg-slate-50 px-3.5 text-sm text-navy"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Tombol varian="garis" className={kelasTombolKecil} onClick={() => salin(sesi.kode, "kode")}>
                      <Icon nama={tersalin === "kode" ? "centang" : "salin"} ukuran={16} />
                      {tersalin === "kode" ? "Kode tersalin" : "Salin kode"}
                    </Tombol>
                    <Tombol varian="garis" className={kelasTombolKecil} onClick={() => salin(tautan, "tautan")}>
                      <Icon nama={tersalin === "tautan" ? "centang" : "salin"} ukuran={16} />
                      {tersalin === "tautan" ? "Tautan tersalin" : "Salin tautan"}
                    </Tombol>
                    <Tombol varian="garis" className={kelasTombolKecil} onClick={unduhQr}>
                      <Icon nama="unduh" ukuran={16} />
                      Unduh QR
                    </Tombol>
                    <Tombol varian="garis" className={kelasTombolKecil} onClick={() => setLayarPenuh(true)}>
                      <Icon nama="layar-penuh" ukuran={16} />
                      Layar penuh
                    </Tombol>
                  </div>
                  <p aria-live="polite" className="m-0 min-h-[18px] text-[13px] font-bold text-success">
                    {tersalin === "kode"
                      ? `Kode ${sesi.kode} disalin ke papan klip.`
                      : tersalin === "tautan"
                        ? "Tautan disalin ke papan klip."
                        : ""}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-500">Peserta bergabung: {data.sesi.jumlahPeserta}. Siswa yang sudah mulai tetap boleh menyelesaikan kuis setelah sesi ditutup.</p>
            </>
          ) : (
            <div className="flex items-start gap-3.5 rounded-xl bg-slate-50 p-[18px]">
              <span className="flex-none text-slate-600">
                <Icon nama="gembok" ukuran={22} />
              </span>
              <div className="flex flex-col gap-1">
                <strong className="text-base">Sesi sudah ditutup</strong>
                <span className="text-[15px] leading-normal text-slate-600">
                  Kode <span className="angka">{sesi.kode}</span> dan QR tidak lagi menerima peserta baru. Hasil yang
                  sudah terkumpul tetap bisa dilihat.
                </span>
              </div>
            </div>
          )}
        </section>

        <BagianPengumpulan
          sesiId={sesi.id}
          pengumpulan={data.pengumpulan}
          diperbarui={data.diperbarui}
          onSegarkan={onSegarkan}
          menyegarkan={menyegarkan}
        />
      </div>

      <Dialog
        buka={dialogTutup}
        onTutup={() => !menutup && setDialogTutup(false)}
        labelledBy="dlg-judul"
        describedBy="dlg-isi"
      >
        {galat && <p role="alert" className="text-danger">{galat}</p>}
        <h2 id="dlg-judul" className="m-0 text-[22px] font-extrabold">
          Tutup sesi <span className="angka">{sesi.kode}</span>?
        </h2>
        <p id="dlg-isi" className="m-0 text-[15px] leading-[1.55] text-slate-600">
          Siswa baru tidak bisa bergabung lagi. Hasil {data.pengumpulan.length} siswa yang sudah mengumpulkan tetap
          tersimpan. Sesi yang ditutup tidak bisa dibuka kembali.
        </p>
        <div className="mt-1.5 flex flex-wrap justify-end gap-2.5">
          <Tombol varian="garis" onClick={() => setDialogTutup(false)} disabled={menutup}>
            Batal
          </Tombol>
          <Tombol
            onClick={konfirmasiTutup}
            aria-busy={menutup}
            aria-disabled={menutup}
            className="bg-danger! text-white! hover:bg-danger-ink!"
          >
            {menutup ? "Menutup…" : "Ya, tutup sesi"}
          </Tombol>
        </div>
      </Dialog>

      <Dialog buka={layarPenuh && terbuka} onTutup={() => setLayarPenuh(false)} layarPenuh labelledBy="qr-judul">
        <span id="qr-judul" className="text-[clamp(20px,3vw,28px)] font-extrabold">
          Pindai untuk mulai kuis
        </span>
        <QRCodeSVG
          value={tautan}
          size={320}
          marginSize={0}
          level="M"
          className="h-auto w-[min(70vw,52vh,360px)]"
          role="img"
          aria-label={`QR untuk membuka kuis ${sesi.kode}`}
        />
        <span className="angka text-[clamp(36px,7vw,72px)] font-semibold tracking-[0.08em]">{sesi.kode}</span>
        <span className="text-lg text-slate-500">
          atau buka <span className="angka">{window.location.host}/join</span> lalu ketik kode di atas
        </span>
        <Tombol varian="garis" onClick={() => setLayarPenuh(false)}>
          <Icon nama="tutup" ukuran={18} />
          Tutup layar penuh
        </Tombol>
      </Dialog>
    </>
  );
}

/** Bagian pengumpulan dengan item grid gaya baru. Diperbarui lewat tombol Muat ulang (tidak real-time). */
function BagianPengumpulan({
  sesiId,
  pengumpulan,
  diperbarui,
  onSegarkan,
  menyegarkan,
}: {
  sesiId: string;
  pengumpulan: Pengumpulan[];
  diperbarui: string;
  onSegarkan: () => void;
  menyegarkan: boolean;
}) {
  return (
    <section
      aria-labelledby="pantau"
      className="gaya-baru flex flex-[1_1_300px] flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="pantau" className="m-0 text-sm font-bold text-navy">
          Pengumpulan ({pengumpulan.length} siswa)
        </h2>
        <button
          type="button"
          onClick={onSegarkan}
          aria-busy={menyegarkan}
          className="flex min-h-11 flex-none items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-bold whitespace-nowrap text-navy hover:bg-slate-50 aria-busy:opacity-70"
        >
          <Icon nama="muat-ulang" ukuran={14} tebal={2.5} />
          {menyegarkan ? "Memuat…" : "Muat ulang"}
        </button>
      </div>
      <p aria-live="polite" className="m-0 text-xs text-slate-500">
        Terakhir diperbarui {formatJam(diperbarui)} · diperbarui otomatis setiap 5 detik
      </p>

      {pengumpulan.length === 0 ? (
        <p className="m-0 rounded-xl bg-slate-50 p-4 text-center text-xs font-semibold text-slate-600">
          Belum ada siswa yang mengumpulkan jawaban.
        </p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-3 p-0">
          {pengumpulan.map((p) => (
            <li key={p.pesertaId} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-navy">
              <span aria-hidden="true" className="mt-1 size-2 flex-none rounded-full bg-emerald-500" />
              <span className="min-w-0 break-words">
                {p.nama}{" "}
                <span className="angka font-semibold whitespace-nowrap text-slate-500">
                  <span className="sr-only">mengumpulkan pukul </span>({formatJam(p.dikumpulkanPada)})
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {pengumpulan.length > 0 && (
        <Link href={`/guru/hasil/${sesiId}`} className="text-sm font-bold text-royal-blue hover:underline">
          Lihat semua hasil
        </Link>
      )}
    </section>
  );
}
