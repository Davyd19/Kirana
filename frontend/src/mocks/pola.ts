/**
 * SIMULASI BACKEND — jangan diimpor dari komponen.
 *
 * Definisi dugaan pola kesalahan dan aturan yang menghasilkan jawaban dari
 * pola tersebut. Aturan pengurangan mengikuti design-reference/screens/
 * D2-detail-diagnosis.html (fungsi `lupa` dan `kecil`).
 */
import type { Operasi } from "@/lib/types";

export interface DefinisiPola {
  id: string;
  operasi: Operasi;
  nama: string;
  saran: string;
  /** Jawaban yang dihasilkan pola ini, atau null jika tidak relevan untuk soal tsb. */
  terapkan: (atas: number, bawah: number) => number | null;
}

const puluhan = (n: number) => Math.floor(n / 10);
const satuan = (n: number) => n % 10;

/** Satuan dipinjam dengan benar, tetapi puluhan atas tidak dikurangi 1. */
function lupaMengurangiSetelahMeminjam(a: number, b: number): number | null {
  if (satuan(a) >= satuan(b)) return null; // tidak ada peminjaman
  const s = satuan(a) + 10 - satuan(b);
  const p = puluhan(a) - puluhan(b);
  return p < 0 ? null : p * 10 + s;
}

/** Pada tiap kolom, angka kecil dikurangkan dari angka besar. */
function kecilDariBesar(a: number, b: number): number | null {
  if (satuan(a) >= satuan(b)) return null;
  const p = puluhan(a) - puluhan(b);
  return p < 0 ? null : p * 10 + Math.abs(satuan(a) - satuan(b));
}

/** Satuan ditulis benar, tetapi angka simpanan tidak ditambahkan ke puluhan. */
function lupaMenambahkanSimpanan(a: number, b: number): number | null {
  const s = satuan(a) + satuan(b);
  if (s < 10) return null;
  return (puluhan(a) + puluhan(b)) * 10 + (s % 10);
}

/** Jumlah satuan (dua digit) ditulis utuh di samping jumlah puluhan. */
function menulisSeluruhHasil(a: number, b: number): number | null {
  const s = satuan(a) + satuan(b);
  if (s < 10) return null;
  return Number(`${puluhan(a) + puluhan(b)}${s}`);
}

export const DAFTAR_POLA: DefinisiPola[] = [
  {
    id: "lupa_pinjam",
    operasi: "pengurangan",
    nama: "Lupa mengurangi angka setelah meminjam",
    saran: "Minta siswa menunjukkan angka mana yang berubah setelah meminjam.",
    terapkan: lupaMengurangiSetelahMeminjam,
  },
  {
    id: "kecil_dari_besar",
    operasi: "pengurangan",
    nama: "Mengurangi angka kecil dari angka besar",
    saran:
      "Minta siswa membaca soal satuan dengan suara keras: angka atas dikurangi angka bawah. Apa yang terjadi jika angka atas lebih kecil?",
    terapkan: kecilDariBesar,
  },
  {
    id: "lupa_simpan",
    operasi: "penjumlahan",
    nama: "Lupa menambahkan angka simpanan",
    saran:
      "Minta siswa menunjukkan di mana angka simpanan ditulis dan kapan angka itu ditambahkan.",
    terapkan: lupaMenambahkanSimpanan,
  },
  {
    id: "tulis_semua",
    operasi: "penjumlahan",
    nama: "Menulis seluruh hasil satuan tanpa menyimpan",
    saran:
      "Minta siswa menjelaskan hasil penjumlahan satuan, lalu tanyakan angka mana yang seharusnya pindah ke puluhan.",
    terapkan: menulisSeluruhHasil,
  },
];

export function polaUntuk(operasi: Operasi): DefinisiPola[] {
  return DAFTAR_POLA.filter((p) => p.operasi === operasi);
}

export function jawabanBenar(operasi: Operasi, a: number, b: number): number {
  return operasi === "penjumlahan" ? a + b : a - b;
}
