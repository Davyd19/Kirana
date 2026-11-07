/**
 * SIMULASI BACKEND — jangan diimpor dari komponen.
 *
 * Data awal demo, mengikuti isi design-reference (B1, B2, B4, D2):
 * - Guru demo Bu Wulan (guru@kirana.demo).
 * - 4 sesi: KRN-4821 terbuka (6 pengumpulan), KRN-3307, KRN-2190, KRN-1856 ditutup.
 * - Total 23 pengumpulan.
 *
 * Jawaban siswa ditulis sebagai kode 15 huruf, satu huruf per soal:
 *   B = pilih jawaban benar
 *   F = pilih jawaban dari pola pertama operasi (lupa_pinjam / lupa_simpan)
 *   S = pilih jawaban dari pola kedua operasi (kecil_dari_besar / tulis_semua)
 *   X = pilih kunci + 10 (pengecoh umum)
 *   L = hasil di luar opsi
 *   K = dilewati
 * Kode untuk Rara, Bima, Sekar, Dimas, Ayu sama dengan D2-detail-diagnosis.html.
 */
import type { Guru, Operasi, Respons, StatusSesi } from "@/lib/types";
import { ambilPaket } from "./paket-soal";
import { polaUntuk } from "./pola";

export const GURU_DEMO: Guru = { nama: "Bu Wulan", email: "guru@kirana.demo" };

export interface SesiDb {
  id: string;
  kode: string;
  operasi: Operasi;
  paketId: string;
  status: StatusSesi;
  dibuatPada: string;
  ditutupPada: string | null;
}

export interface PengumpulanDb {
  pesertaId: string;
  sesiId: string;
  nama: string;
  dikumpulkanPada: string;
  respons: Respons[];
}

function responsDariKode(paketId: string, kode: string): Respons[] {
  const paket = ambilPaket(paketId);
  const [polaF, polaS] = polaUntuk(paket.operasi);
  return paket.soal.map((soal, i) => {
    const huruf = kode[i];
    const opsiDenganNilai = (nilai: number | null) => {
      const o = soal.opsi.find((x) => x.nilai === nilai);
      if (!o) throw new Error(`Seed: soal ${soal.id} tidak punya opsi ${nilai} (huruf ${huruf}).`);
      return o.id;
    };
    switch (huruf) {
      case "B":
        return { jenis: "opsi", soalId: soal.id, opsiId: soal.kunciOpsiId };
      case "F":
        return { jenis: "opsi", soalId: soal.id, opsiId: opsiDenganNilai(polaF.terapkan(soal.operandAtas, soal.operandBawah)) };
      case "S":
        return { jenis: "opsi", soalId: soal.id, opsiId: opsiDenganNilai(polaS.terapkan(soal.operandAtas, soal.operandBawah)) };
      case "X":
        return { jenis: "opsi", soalId: soal.id, opsiId: opsiDenganNilai(soal.kunci + 10) };
      case "L":
        return { jenis: "di_luar_opsi", soalId: soal.id };
      case "K":
        return { jenis: "dilewati", soalId: soal.id };
      default:
        throw new Error(`Seed: huruf tidak dikenal "${huruf}".`);
    }
  });
}

const SESI: SesiDb[] = [
  {
    id: "sesi-4821",
    kode: "KRN-4821",
    operasi: "pengurangan",
    paketId: "P-01",
    status: "terbuka",
    dibuatPada: "2026-11-07T08:52:00+07:00",
    ditutupPada: null,
  },
  {
    id: "sesi-3307",
    kode: "KRN-3307",
    operasi: "penjumlahan",
    paketId: "J-01",
    status: "ditutup",
    dibuatPada: "2026-11-05T10:05:00+07:00",
    ditutupPada: "2026-11-05T11:10:00+07:00",
  },
  {
    id: "sesi-2190",
    kode: "KRN-2190",
    operasi: "pengurangan",
    paketId: "P-02",
    status: "ditutup",
    dibuatPada: "2026-11-01T09:30:00+07:00",
    ditutupPada: "2026-11-01T10:40:00+07:00",
  },
  {
    id: "sesi-1856",
    kode: "KRN-1856",
    operasi: "penjumlahan",
    paketId: "J-02",
    status: "ditutup",
    dibuatPada: "2026-10-28T13:00:00+07:00",
    ditutupPada: "2026-10-28T14:00:00+07:00",
  },
];

const PENGUMPULAN_MENTAH: { sesiId: string; nama: string; jam: string; kode: string }[] = [
  // KRN-4821 · Pengurangan · P-01 (7 Nov 2026)
  { sesiId: "sesi-4821", nama: "Rara", jam: "2026-11-07T09:14:00+07:00", kode: "BFBFFBLBBKBKFBF" },
  { sesiId: "sesi-4821", nama: "Bima", jam: "2026-11-07T09:15:00+07:00", kode: "BFKFFBFBSSLFFBS" },
  { sesiId: "sesi-4821", nama: "Sekar", jam: "2026-11-07T09:16:00+07:00", kode: "BKBKFBFBLLBFBBB" },
  { sesiId: "sesi-4821", nama: "Dimas", jam: "2026-11-07T09:17:00+07:00", kode: "BKBKBBKBKKXLKBF" },
  { sesiId: "sesi-4821", nama: "Ayu", jam: "2026-11-07T09:18:00+07:00", kode: "BBBBBBBBBBXBBBB" },
  { sesiId: "sesi-4821", nama: "Fajar", jam: "2026-11-07T09:20:00+07:00", kode: "BSBBBBSBBBBSBBB" },

  // KRN-3307 · Penjumlahan · J-01 (5 Nov 2026)
  { sesiId: "sesi-3307", nama: "Nadia", jam: "2026-11-05T10:21:00+07:00", kode: "FBFBFBBBBBFBBBB" },
  { sesiId: "sesi-3307", nama: "Raka", jam: "2026-11-05T10:23:00+07:00", kode: "BBBBBBBBBBBBBBB" },
  { sesiId: "sesi-3307", nama: "Putri", jam: "2026-11-05T10:24:00+07:00", kode: "SBBBSBSBBBBBKBB" },
  { sesiId: "sesi-3307", nama: "Gilang", jam: "2026-11-05T10:26:00+07:00", kode: "BBFBBBFBLBBBFBK" },
  { sesiId: "sesi-3307", nama: "Salsa", jam: "2026-11-05T10:27:00+07:00", kode: "BBBBBXBBBBBBBBB" },
  { sesiId: "sesi-3307", nama: "Yoga", jam: "2026-11-05T10:29:00+07:00", kode: "KKBBFBBBKBFBBBB" },
  { sesiId: "sesi-3307", nama: "Intan", jam: "2026-11-05T10:31:00+07:00", kode: "BBBBBBBBBBBBLBB" },
  { sesiId: "sesi-3307", nama: "Dafa", jam: "2026-11-05T10:34:00+07:00", kode: "FBSBBBBBBBFBSBB" },
  { sesiId: "sesi-3307", nama: "Citra", jam: "2026-11-05T10:36:00+07:00", kode: "BBBBBBBBBBBBBBS" },

  // KRN-2190 · Pengurangan · P-02 (1 Nov 2026)
  { sesiId: "sesi-2190", nama: "Nayla", jam: "2026-11-01T09:48:00+07:00", kode: "FBFBBBBBBBBBBBB" },
  { sesiId: "sesi-2190", nama: "Arka", jam: "2026-11-01T09:50:00+07:00", kode: "BBBFBFBFBBBBBBB" },
  { sesiId: "sesi-2190", nama: "Tiara", jam: "2026-11-01T09:51:00+07:00", kode: "SBBBBBBBBSBBSBB" },
  { sesiId: "sesi-2190", nama: "Rizky", jam: "2026-11-01T09:53:00+07:00", kode: "BBBBBBBBBBBBBBB" },
  { sesiId: "sesi-2190", nama: "Zahra", jam: "2026-11-01T09:55:00+07:00", kode: "BBKBBKBBBBLBBBB" },
  { sesiId: "sesi-2190", nama: "Fikri", jam: "2026-11-01T09:57:00+07:00", kode: "FBFSBFBFBFBBBBK" },
  { sesiId: "sesi-2190", nama: "Hana", jam: "2026-11-01T09:58:00+07:00", kode: "BBBBBBXBBBBBBBB" },
  { sesiId: "sesi-2190", nama: "Galih", jam: "2026-11-01T10:02:00+07:00", kode: "BBBBBBBBBBFBFFB" },
];

export function buatSeed(): { sesi: SesiDb[]; pengumpulan: PengumpulanDb[] } {
  const pengumpulan = PENGUMPULAN_MENTAH.map((p, i) => {
    const sesi = SESI.find((s) => s.id === p.sesiId)!;
    return {
      pesertaId: `peserta-${sesi.kode.slice(4)}-${String(i + 1).padStart(2, "0")}`,
      sesiId: p.sesiId,
      nama: p.nama,
      dikumpulkanPada: p.jam,
      respons: responsDariKode(sesi.paketId, p.kode),
    };
  });
  return { sesi: SESI.map((s) => ({ ...s })), pengumpulan };
}

/**
 * Pintasan mode demo di D2: satu siswa contoh untuk tiap kondisi diagnosis.
 * pesertaId mengikuti urutan PENGUMPULAN_MENTAH di atas.
 */
export const CONTOH_KONDISI: { label: string; sesiId: string; pesertaId: string }[] = [
  { label: "Satu pola · Rara", sesiId: "sesi-4821", pesertaId: "peserta-4821-01" },
  { label: "Beberapa pola · Bima", sesiId: "sesi-4821", pesertaId: "peserta-4821-02" },
  { label: "Kemungkinan ambigu · Sekar", sesiId: "sesi-4821", pesertaId: "peserta-4821-03" },
  { label: "Bukti belum cukup · Dimas", sesiId: "sesi-4821", pesertaId: "peserta-4821-04" },
  { label: "Tanpa pola · Ayu", sesiId: "sesi-4821", pesertaId: "peserta-4821-05" },
];
