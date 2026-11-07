import type { ReactNode } from "react";

type Ukuran = "besar" | "sedang" | "kecil" | "mini";

const UKURAN: Record<Ukuran, { font: string; garis: string }> = {
  // C2: clamp(44px, 7vw, 60px)
  besar: { font: "text-[clamp(44px,7vw,60px)]", garis: "my-1.5 border-t-[4px]" },
  // Hero landing
  sedang: { font: "text-[40px]", garis: "my-1 border-t-[3px]" },
  // Kartu operasi B3, info sesi C1
  kecil: { font: "text-2xl", garis: "my-0.5 border-t-2" },
  // Tabel contoh bukti D2
  mini: { font: "text-[17px]", garis: "border-t-2" },
};

/**
 * Soal bersusun vertikal: angka rata kanan, digit sejajar menurut nilai
 * tempat (tabular-nums), tanda operasi di kiri baris bawah.
 *
 *     71
 *   − 38
 *   ────
 *      ?
 *
 * - `hasil={null}` menyembunyikan garis dan baris hasil (cukup dua operand).
 * - `gaya="baru"` memakai warna navy dan tanda tanya turquoise.
 * Pembaca layar membaca label, bukan susunan digit.
 */
export function SoalBersusun({
  atas,
  bawah,
  tanda,
  hasil = "?",
  ukuran = "besar",
  gaya = "lama",
}: {
  atas: number;
  bawah: number;
  tanda: "+" | "−";
  hasil?: ReactNode | null;
  ukuran?: Ukuran;
  gaya?: "lama" | "baru";
}) {
  const u = UKURAN[ukuran];
  const label = `Soal: ${atas} ${tanda === "+" ? "ditambah" : "dikurangi"} ${bawah}`;
  const warna = gaya === "baru" ? "text-navy" : "text-ink";
  const warnaGaris = gaya === "baru" ? "border-navy" : "border-ink";
  const warnaHasil = gaya === "baru" ? "text-turquoise-ink" : "text-faint";
  const tampilHasil = hasil !== null;
  const lebarAngka = Math.max(String(atas).length, String(bawah).length, 2) + 0.4;

  return (
    <span role="img" aria-label={label} className="inline-block">
      <span
        aria-hidden="true"
        style={{ gridTemplateColumns: `0.9em ${lebarAngka}ch` }}
        className={`angka grid font-semibold leading-[1.15] ${warna} ${u.font}`}
      >
        <span />
        <span className="text-right">{atas}</span>
        <span className="text-left">{tanda}</span>
        <span className="text-right">{bawah}</span>
        {tampilHasil ? (
          <>
            <span className={`col-span-2 h-0 ${warnaGaris} ${u.garis}`} />
            <span />
            <span className={`text-right ${warnaHasil}`}>{hasil}</span>
          </>
        ) : (
          ukuran === "mini" && <span className={`col-span-2 h-0 ${warnaGaris} ${u.garis}`} />
        )}
      </span>
    </span>
  );
}
