/**
 * SIMULASI BACKEND — jangan diimpor dari komponen.
 *
 * Bank paket soal. Setiap paket berisi 15 soal unik dengan 4 opsi berposisi
 * tetap, kunci jawaban, dan pemetaan opsi ke pola. Di produksi semua ini
 * disimpan dan dihitung di backend.
 *
 * Paket "P-01" memakai bank soal dari design-reference/screens/D2-detail-diagnosis.html.
 */
import { JUMLAH_SOAL, type Operasi, type Opsi } from "@/lib/types";
import { jawabanBenar, polaUntuk } from "./pola";

export interface SoalPaket {
  id: string;
  urutan: number;
  operandAtas: number;
  operandBawah: number;
  opsi: Opsi[];
  kunci: number;
  kunciOpsiId: string;
  /** opsiId -> id pola yang menghasilkan nilai opsi tersebut. */
  polaOpsi: Record<string, string[]>;
}

export interface Paket {
  id: string;
  operasi: Operasi;
  soal: SoalPaket[];
}

const DEFINISI: { id: string; operasi: Operasi; pasangan: [number, number][] }[] = [
  {
    id: "P-01",
    operasi: "pengurangan",
    pasangan: [
      [58, 23], [71, 38], [46, 12], [83, 46], [52, 27],
      [38, 38], [64, 19], [77, 35], [62, 38], [45, 19],
      [96, 41], [81, 56], [70, 24], [85, 52], [93, 67],
    ],
  },
  {
    id: "P-02",
    operasi: "pengurangan",
    pasangan: [
      [63, 28], [54, 21], [92, 47], [40, 15], [75, 32],
      [86, 59], [57, 57], [31, 14], [68, 24], [90, 36],
      [44, 19], [79, 53], [62, 45], [87, 38], [50, 22],
    ],
  },
  {
    id: "J-01",
    operasi: "penjumlahan",
    pasangan: [
      [47, 36], [25, 13], [58, 27], [34, 45], [66, 19],
      [52, 31], [38, 48], [71, 18], [29, 29], [63, 24],
      [45, 37], [56, 42], [19, 68], [74, 15], [37, 55],
    ],
  },
  {
    id: "J-02",
    operasi: "penjumlahan",
    pasangan: [
      [28, 35], [41, 26], [57, 38], [33, 44], [46, 27],
      [62, 17], [18, 59], [24, 73], [39, 46], [51, 32],
      [65, 28], [14, 63], [49, 39], [36, 52], [27, 67],
    ],
  },
];

/** Hash string sederhana dan deterministik (FNV-1a 32-bit). */
function hash(teks: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < teks.length; i++) {
    h ^= teks.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function bangunSoal(paketId: string, operasi: Operasi, urutan: number, a: number, b: number): SoalPaket {
  const id = `${paketId}-${String(urutan).padStart(2, "0")}`;
  const kunci = jawabanBenar(operasi, a, b);
  const pola = polaUntuk(operasi);

  // Kandidat: kunci, jawaban dari tiap pola, lalu pengecoh umum.
  const kandidat: number[] = [kunci];
  for (const p of pola) {
    const v = p.terapkan(a, b);
    if (v !== null) kandidat.push(v);
  }
  kandidat.push(kunci + 10, kunci - 1, kunci + 1, kunci - 10, kunci + 2, kunci + 11);

  const nilai: number[] = [];
  for (const v of kandidat) {
    if (v >= 0 && !nilai.includes(v)) nilai.push(v);
    if (nilai.length === 4) break;
  }

  // Posisi tetap per soal, tetapi kunci tidak selalu di posisi yang sama.
  nilai.sort((x, y) => hash(`${id}:${x}`) - hash(`${id}:${y}`));

  const opsi: Opsi[] = nilai.map((v, i) => ({ id: `${id}-o${i + 1}`, nilai: v }));
  const kunciOpsiId = opsi.find((o) => o.nilai === kunci)!.id;

  const polaOpsi: Record<string, string[]> = {};
  for (const o of opsi) {
    if (o.nilai === kunci) continue;
    const cocok = pola.filter((p) => p.terapkan(a, b) === o.nilai).map((p) => p.id);
    if (cocok.length) polaOpsi[o.id] = cocok;
  }

  return { id, urutan, operandAtas: a, operandBawah: b, opsi, kunci, kunciOpsiId, polaOpsi };
}

export const DAFTAR_PAKET: Paket[] = DEFINISI.map((d) => {
  if (d.pasangan.length !== JUMLAH_SOAL) {
    throw new Error(`Paket ${d.id} harus berisi ${JUMLAH_SOAL} soal.`);
  }
  return {
    id: d.id,
    operasi: d.operasi,
    soal: d.pasangan.map(([a, b], i) => bangunSoal(d.id, d.operasi, i + 1, a, b)),
  };
});

export function ambilPaket(id: string): Paket {
  const p = DAFTAR_PAKET.find((x) => x.id === id);
  if (!p) throw new Error(`Paket ${id} tidak ada.`);
  return p;
}

export function paketUntukOperasi(operasi: Operasi): Paket[] {
  return DAFTAR_PAKET.filter((p) => p.operasi === operasi);
}
